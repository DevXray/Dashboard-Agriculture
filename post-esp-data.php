<?php
/**
 * post-esp-data.php — AgroMonitor v3
 * Endpoint POST dari firmware ESP32 untuk simpan data sensor
 *
 * Contoh request dari Arduino/ESP32:
 *   POST http://server/esp32_sensor/post-esp-data.php
 *   Body: suhuUdara=28.5&kelUdara=65&kelTanah=72&kecerahan=80&latitude=-5.1477&longitude=119.4327
 */

header('Content-Type: application/json; charset=utf-8');

include 'koneksi.php';

// Tambahkan baris ini di atas pengecekan $required
$valid_api_key = "12345abcde"; // Samakan dengan di Arduino

if (!isset($_POST['api_key']) || $_POST['api_key'] !== $valid_api_key) {
    http_response_code(401);
    echo json_encode(['status'=>'error','message'=>'API Key Tidak Sah']);
    exit;
}

$required = ['suhuUdara','kelUdara','kelTanah','kecerahan'];
foreach ($required as $field) {
    if (!isset($_POST[$field])) {
        http_response_code(400);
        echo json_encode(['status'=>'error','message'=>"Field '$field' wajib diisi."]);
        exit;
    }
}

$suhu = (float) $_POST['suhuUdara'];
$ku   = (float) $_POST['kelUdara'];
$kt   = (float) $_POST['kelTanah'];
$kc   = (float) $_POST['kecerahan'];
$lat  = isset($_POST['latitude'])  ? (float)$_POST['latitude']  : 0;
$lon  = isset($_POST['longitude']) ? (float)$_POST['longitude'] : 0;

$stmt = $conn->prepare("
    INSERT INTO DataSensor (suhuUdara, kelUdara, kelTanah, kecerahan, latitude, longitude, waktu)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param('dddddd', $suhu, $ku, $kt, $kc, $lat, $lon);

if ($stmt->execute()) {
    echo json_encode(['status'=>'ok','message'=>'Data berhasil disimpan.','id'=>$conn->insert_id]);
} else {
    http_response_code(500);
    echo json_encode(['status'=>'error','message'=>'Gagal menyimpan: '.$conn->error]);
}

$stmt->close();
$conn->close();
?>
