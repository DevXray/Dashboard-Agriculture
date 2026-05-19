<?php
/**
 * koneksi.php — AgroMonitor v3
 * Konfigurasi koneksi database MySQL
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'sensor_esp32');

// API Key default untuk ESP32
define('ESP_API_KEY', '12345abcde');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
$conn->set_charset('utf8mb4');

if ($conn->connect_error) {
    error_log('DB Error: ' . $conn->connect_error);
    http_response_code(503);
    die(json_encode(['error' => 'Layanan sementara tidak tersedia.']));
}
?>
