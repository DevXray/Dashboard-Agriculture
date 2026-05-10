<?php
/**
 * sse.php — AgroMonitor v3
 * Server-Sent Events untuk Real-Time Data Push
 */
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');

// Matikan buffering agar data langsung mengalir ke browser
if (ob_get_level()) ob_end_clean();

include 'koneksi.php';

// Ambil ID terakhir saat klien baru terkoneksi
$lastId = 0;
$res = $conn->query("SELECT MAX(id) as max_id FROM DataSensor");
if ($res && $row = $res->fetch_assoc()) {
    $lastId = (int)$row['max_id'];
}

// Buka koneksi selama 60 detik (browser akan otomatis reconnect setelah ini)
$startTime = time();
while (time() - $startTime < 60) {
    // Cari data yang ID-nya lebih besar dari ID terakhir yang dikirim
    $query = "SELECT * FROM DataSensor WHERE id > $lastId ORDER BY id ASC";
    $result = $conn->query($query);

    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
            // Tembakkan data ke browser dalam format JSON
            echo "data: " . json_encode($row) . "\n\n";
            $lastId = (int)$row['id'];
        }
        flush(); // Paksa dorong output ke browser
    }
    
    // Jeda 1 detik sebelum mengecek ulang untuk menghemat beban CPU
    sleep(1); 
}
?>