#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ===== WIFI =====
const char* ssid = "ilmi";
const char* password = "31102006";

// ===== SERVER =====
const char* serverName = "http://10.106.195.16/esp32_sensorV3/post-esp-data.php";
const char* controlURL  = "http://10.106.195.16/esp32_sensorV3/control.php";

// ===== API =====
String apiKey = "12345abcde";

// ===== PIN =====
#define DHTPIN 5
#define DHTTYPE DHT22
#define SOIL_PIN 34
#define LDR_PIN 35
#define RELAY_PIN 2

DHT dht(DHTPIN, DHTTYPE);

// ===== KALIBRASI =====
int SOIL_KERING = 3000;
int SOIL_BASAH  = 1200;

// ===== RELAY LOGIC =====
// Ubah ke true jika modul relay aktif LOW.
const bool RELAY_ACTIVE_LOW = false;
const int RELAY_ON_LEVEL  = RELAY_ACTIVE_LOW ? LOW : HIGH;
const int RELAY_OFF_LEVEL = RELAY_ACTIVE_LOW ? HIGH : LOW;

// ===== WIFI =====
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");
  int count = 0;

  while (WiFi.status() != WL_CONNECTED && count < 20) {
    delay(500);
    Serial.print(".");
    count++;
  }

  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED ? "WiFi Connected" : "WiFi Failed");
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(2000);

  dht.begin();

  pinMode(RELAY_PIN, OUTPUT);

  // OFF awal sesuai polaritas relay
  digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);

  analogReadResolution(12);

  connectWiFi();
}

// ===== LOOP =====
void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  float suhu = dht.readTemperature();
  float hum  = dht.readHumidity();

  int soil = analogRead(SOIL_PIN);
  int ldr  = analogRead(LDR_PIN);

  int soilPersen = map(soil, SOIL_KERING, SOIL_BASAH, 0, 100);
  soilPersen = constrain(soilPersen, 0, 100);

  int cahaya = map(ldr, 4095, 0, 0, 100);
  cahaya = constrain(cahaya, 0, 100);

  Serial.println("===== SENSOR =====");
  Serial.print("Soil %: "); Serial.println(soilPersen);
  Serial.print("Suhu: "); Serial.println(suhu);
  Serial.print("Kelembapan: "); Serial.println(hum);
  Serial.print("Cahaya: ");
  Serial.print(cahaya);
  Serial.println(" LUX");

  // ===== AUTO RULE =====
  bool autoON = (soilPersen < 60);

  // ===== DEFAULT MODE =====
  String mode = "AUTO";

  // ===== AMBIL MODE WEB =====
  HTTPClient http;
  http.setTimeout(3000);
  http.begin(controlURL);

  int code = http.GET();

  if (code == 200) {
    String tmp = http.getString();
    tmp.trim();
    tmp.toUpperCase();

    if (tmp == "ON" || tmp == "OFF" || tmp == "AUTO") {
      mode = tmp;
    }
  }

  http.end();

  Serial.println("===== MODE WEB=====");
  Serial.println(mode);

  // ===== PRIORITY SYSTEM =====

  if (mode == "ON") {
    digitalWrite(RELAY_PIN, RELAY_ON_LEVEL);
    Serial.println("Relay ON (MANUAL WEB)");
  }

  else if (mode == "OFF") {
    digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);
    Serial.println("Relay OFF (MANUAL WEB)");
  }

  else {
    Serial.println("MODE AUTO (sensor priority)");

    if (autoON) {
      digitalWrite(RELAY_PIN, RELAY_ON_LEVEL);
      Serial.println("Relay ON (AUTO soil < 60)");
    } else {
      digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);
      Serial.println("Relay OFF (AUTO soil >= 60)");
    }
  }

  // ===== KIRIM DATA =====
  HTTPClient http2;

  http2.begin(serverName);
  http2.addHeader("Content-Type", "application/x-www-form-urlencoded");

  String postData =
    "api_key=" + apiKey +
    "&kelTanah=" + String(soilPersen) +
    "&kelUdara=" + String(hum, 2) +
    "&suhuUdara=" + String(suhu, 2) +
    "&kecerahan=" + String(cahaya);

  http2.POST(postData);
  http2.end();

  Serial.println("====================\n");

  delay(5000);
}