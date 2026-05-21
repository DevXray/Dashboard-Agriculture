<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
include 'koneksi.php';

$res = $conn->query("SELECT suhuUdara, kelUdara, kelTanah, kecerahan, waktu 
                     FROM DataSensor ORDER BY id DESC LIMIT 1");
$row = $res ? $res->fetch_assoc() : null;

echo $row ? json_encode($row) : json_encode(['error' => 'no data']);
$conn->close();