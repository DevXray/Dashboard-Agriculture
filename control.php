<?php
/**
 * control.php — AgroMonitor v3
 * Endpoint kontrol relay pompa via file relay_status.txt
 * Dipanggil AJAX dari script.js: fetch('control.php?mode=ON')
 */

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-cache, no-store');

$file    = 'relay_status.txt';
$allowed = ['ON', 'OFF', 'AUTO'];

if (isset($_GET['mode'])) {
    $mode = strtoupper(trim($_GET['mode']));
    if (in_array($mode, $allowed, true)) {
        file_put_contents($file, $mode);
    }
}

$current = file_exists($file) ? strtoupper(trim(file_get_contents($file))) : 'OFF';
echo in_array($current, $allowed) ? $current : 'OFF';
?>
