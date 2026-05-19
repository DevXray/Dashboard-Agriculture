<?php
/**
 * control.php — AgroMonitor v3
 * Endpoint kontrol relay pompa via database
 * Dipanggil AJAX dari script.js: fetch('control.php?mode=ON')
 */

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-cache, no-store');

include 'koneksi.php';

$allowed = ['ON', 'OFF', 'AUTO'];

if (isset($_GET['mode'])) {
    $mode = strtoupper(trim($_GET['mode']));
    if (in_array($mode, $allowed, true)) {
        $stmt = $conn->prepare("UPDATE DeviceConfig SET setting_value = ? WHERE setting_name = 'relay_mode'");
        $stmt->bind_param('s', $mode);
        $stmt->execute();
        $stmt->close();
    }
}

$res = $conn->query("SELECT setting_value FROM DeviceConfig WHERE setting_name = 'relay_mode'");
$current = ($res && $row = $res->fetch_assoc()) ? strtoupper(trim($row['setting_value'])) : 'OFF';

echo in_array($current, $allowed) ? $current : 'OFF';
$conn->close();
?>
