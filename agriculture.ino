#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include "esp_wifi.h"   // ← untuk WiFi modem sleep

// ===== WIFI =====
const char* ssid = "ilmi";
const char* password = "31102006";

// ===== SERVER =====
const char* serverName = "http://192.168.1.6/esp32_sensorV3/post-esp-data.php";
const char* controlURL = "http://192.168.1.6/esp32_sensorV3/control.php";

// ===== API =====
String apiKey = "12345abcde";

// ===== PIN =====
#define DHTPIN    5
#define DHTTYPE   DHT22
#define SOIL_PIN  34
#define LDR_PIN   35
#define RELAY_PIN 2

DHT dht(DHTPIN, DHTTYPE);

// ===== KALIBRASI SOIL =====
int SOIL_KERING = 3000;
int SOIL_BASAH  = 1200;

// ===== MOSFET / RELAY LOGIC =====
// MOSFET N-channel: HIGH = pompa ON → false
const bool RELAY_ACTIVE_LOW = false;
const int  RELAY_ON_LEVEL   = RELAY_ACTIVE_LOW ? LOW  : HIGH;
const int  RELAY_OFF_LEVEL  = RELAY_ACTIVE_LOW ? HIGH : LOW;

// ===== CACHE NILAI DHT TERAKHIR YANG VALID =====
float lastSuhu = 0.0;
float lastHum  = 0.0;
bool  dhtPernahBerhasil = false;

// ===================================================
// FUNGSI BACA DHT — retry + cache + jeda stabilisasi
// ===================================================
bool bacaDHT(float &suhu, float &hum) {
  const int MAX_RETRY      = 5;
  const int DELAY_RETRY_MS = 800;

  // Jeda 500ms sebelum baca — beri waktu WiFi radio "tenang"
  delay(500);

  for (int i = 0; i < MAX_RETRY; i++) {
    float s = dht.readTemperature();
    float h = dht.readHumidity();

    if (!isnan(s) && !isnan(h)) {
      suhu = s;
      hum  = h;
      lastSuhu = s;
      lastHum  = h;
      dhtPernahBerhasil = true;
      if (i > 0) {
        Serial.print("[DHT] Berhasil pada retry ke-");
        Serial.println(i + 1);
      }
      return true;
    }

    Serial.print("[DHT] Retry ke-");
    Serial.print(i + 1);
    Serial.println("...");
    delay(DELAY_RETRY_MS);
  }

  // Semua retry gagal — pakai cache
  if (dhtPernahBerhasil) {
    suhu = lastSuhu;
    hum  = lastHum;
    Serial.println("[DHT] Pakai nilai cache terakhir");
    return true;
  }

  return false;
}

// ===================================================
// FUNGSI WIFI
// ===================================================
void connectWiFi() {
  WiFi.disconnect(true);
  delay(100);

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
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    // ✅ Aktifkan WiFi Modem Sleep setelah konek
    // Radio WiFi tidur di antara beacon interval → mengurangi interferensi ke DHT22
    esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
    Serial.println("WiFi Modem Sleep: ON");

  } else {
    Serial.println("WiFi Failed");
  }
}

// ===================================================
// SETUP
// ===================================================
void setup() {
  Serial.begin(115200);
  delay(2000);

  dht.begin();
  delay(2000);  // DHT22 butuh stabilisasi saat pertama nyala

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);

  analogReadResolution(12);

  connectWiFi();
}

// ===== TIMING (Non-blocking) =====
unsigned long lastSensorRead = 0;
unsigned long lastWebCheck   = 0;
const unsigned long SENSOR_INTERVAL = 5000; // Kirim tiap 5 detik
const unsigned long WEB_INTERVAL    = 3000; // Cek mode tiap 3 detik

// ===================================================
// LOOP
// ===================================================
void loop() {
  unsigned long currentMillis = millis();

  // --- Cek & reconnect WiFi ---
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi putus, reconnecting...");
    connectWiFi();
    // Beri sedikit jeda kalau sedang putus-nyambung
    delay(2000); 
    return;
  }

  // --- TASK 1: Cek Mode Kontrol (Tiap 3 detik) ---
  if (currentMillis - lastWebCheck >= WEB_INTERVAL) {
    lastWebCheck = currentMillis;
    
    String mode = "AUTO";
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
    } else {
      Serial.print("[WARN] Gagal ambil mode web, HTTP code: ");
      Serial.println(code);
    }
    http.end();

    // --- Kontrol Relay / MOSFET Sementara (berdasarkan data lalu) ---
    // Aturan autoON akan di-re-evaluasi saat baca sensor,
    // di sini kita hanya update jika ada intervensi manual web
    if (mode == "ON") {
      digitalWrite(RELAY_PIN, RELAY_ON_LEVEL);
    } else if (mode == "OFF") {
      digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);
    }
  }

  // --- TASK 2: Baca & Kirim Sensor (Tiap 5 detik) ---
  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = currentMillis;

    // --- Baca Sensor Analog ---
    int soil = analogRead(SOIL_PIN);
    int ldr  = analogRead(LDR_PIN);

    int soilPersen = map(soil, SOIL_KERING, SOIL_BASAH, 0, 100);
    soilPersen = constrain(soilPersen, 0, 100);

    int cahaya = map(ldr, 4095, 0, 0, 100);
    cahaya = constrain(cahaya, 0, 100);

    // --- Baca DHT22 ---
    float suhu, hum;
    bool dhtOK = bacaDHT(suhu, hum);

    if (!dhtOK) {
      Serial.println("[ERROR] DHT gagal, skip pengiriman");
      return; 
    }

    Serial.println("===== SENSOR =====");
    Serial.print("Soil      : "); Serial.print(soilPersen); Serial.println(" %");
    Serial.print("Suhu      : "); Serial.print(suhu, 2);    Serial.println(" C");
    Serial.print("Kelembapan: "); Serial.print(hum, 2);     Serial.println(" %");
    Serial.print("Cahaya    : "); Serial.print(cahaya);     Serial.println(" %");

    // Re-evaluasi mode auto setelah baca soil baru
    bool autoON = (soilPersen < 60);

    HTTPClient httpMode;
    httpMode.setTimeout(2000);
    httpMode.begin(controlURL);
    String currentMode = "AUTO";
    if (httpMode.GET() == 200) {
       currentMode = httpMode.getString();
       currentMode.trim();
       currentMode.toUpperCase();
    }
    httpMode.end();
    
    Serial.println("===== MODE WEB =====");
    Serial.println(currentMode);

    if (currentMode == "ON") {
      digitalWrite(RELAY_PIN, RELAY_ON_LEVEL);
      Serial.println("Relay ON  (MANUAL WEB)");
    } else if (currentMode == "OFF") {
      digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);
      Serial.println("Relay OFF (MANUAL WEB)");
    } else {
      Serial.println("MODE AUTO (sensor priority)");
      if (autoON) {
        digitalWrite(RELAY_PIN, RELAY_ON_LEVEL);
        Serial.println("Relay ON  (AUTO soil < 60)");
      } else {
        digitalWrite(RELAY_PIN, RELAY_OFF_LEVEL);
        Serial.println("Relay OFF (AUTO soil >= 60)");
      }
    }

    // --- Kirim Data ke Server ---
    HTTPClient http2;
    http2.setTimeout(3000);
    http2.begin(serverName);
    http2.addHeader("Content-Type", "application/x-www-form-urlencoded");

    String postData =
      "api_key="    + apiKey +
      "&kelTanah="  + String(soilPersen) +
      "&kelUdara="  + String(hum, 2) +
      "&suhuUdara=" + String(suhu, 2) +
      "&kecerahan=" + String(cahaya);

    int postCode = http2.POST(postData);

    if (postCode == 200) {
      Serial.println("[OK] Data terkirim ke server");
    } else {
      Serial.print("[WARN] Gagal kirim data, HTTP code: ");
      Serial.println(postCode);
    }
    http2.end();
    Serial.println("====================\n");
  }
}