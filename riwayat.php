<?php
/**
 * riwayat.php — AgroMonitor v3 (Emerald Night)
 * BUG FIX #3: $data, $isPumpOn, $isPumpAuto dideklarasikan
 *             agar sidebar.php tidak error saat diinclude
 */
include 'koneksi.php';

// BUG FIX: Sediakan variabel yang dibutuhkan sidebar.php
$data       = null;
$isPumpOn   = false;
$isPumpAuto = false;

// Baca status pompa (opsional, agar mascot merespons)
if (file_exists('relay_status.txt')) {
    $ps      = strtoupper(trim(file_get_contents('relay_status.txt')));
    $isPumpOn   = ($ps === 'ON');
    $isPumpAuto = ($ps === 'AUTO');
}

// ── Query data hari ini ──────────────────────────────────────────
$filter    = isset($_GET['filter']) ? $conn->real_escape_string($_GET['filter']) : 'today';
$search    = isset($_GET['search']) ? $conn->real_escape_string(trim($_GET['search'])) : '';
$page      = max(1, (int)($_GET['page'] ?? 1));
$perPage   = 20;
$offset    = ($page - 1) * $perPage;

$whereClauses = [];
switch ($filter) {
    case 'week':  $whereClauses[] = "waktu >= NOW() - INTERVAL 7 DAY"; break;
    case 'month': $whereClauses[] = "waktu >= NOW() - INTERVAL 30 DAY"; break;
    default:      $whereClauses[] = "DATE(waktu) = CURDATE()"; break;
}
if ($search !== '') {
    $whereClauses[] = "(suhuUdara LIKE '%{$search}%' OR kelTanah LIKE '%{$search}%'
                        OR kelUdara LIKE '%{$search}%' OR kecerahan LIKE '%{$search}%'
                        OR waktu LIKE '%{$search}%')";
}
$whereSQL = $whereClauses ? 'WHERE ' . implode(' AND ', $whereClauses) : '';

// Total count
$countRes  = $conn->query("SELECT COUNT(*) as total FROM DataSensor {$whereSQL}");
$totalRows = $countRes ? (int)$countRes->fetch_assoc()['total'] : 0;
$totalPages= max(1, (int)ceil($totalRows / $perPage));

// Data page
$result = $conn->query("
    SELECT * FROM DataSensor {$whereSQL}
    ORDER BY id DESC
    LIMIT {$perPage} OFFSET {$offset}
");

$lastRefresh = date('H:i:s');
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AgroMonitor — Riwayat Data</title>
    <link rel="icon" href="img/kangkung.png">
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>

<?php include 'sidebar.php'; ?>

<div id="app-content">
<div class="riwayat-content">

    <!-- Page header -->
    <div class="page-header">
        <div>
            <div class="page-title">📊 Riwayat Data Sensor</div>
            <div class="page-count"><?= number_format($totalRows) ?> rekord ditemukan</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <!-- Filter pills -->
            <?php foreach (['today'=>'Hari Ini','week'=>'7 Hari','month'=>'30 Hari'] as $fk=>$fl): ?>
            <a href="?filter=<?= $fk ?>&search=<?= urlencode($search) ?>"
               class="filter-pill <?= $filter===$fk?'active':'' ?>">
                <?= $fl ?>
            </a>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
        <form method="GET" style="display:flex;gap:10px;flex:1" onsubmit="return true">
            <input type="hidden" name="filter" value="<?= htmlspecialchars($filter) ?>">
            <input class="search-input" id="searchInput" name="search"
                   placeholder="🔍 Cari nilai atau waktu…"
                   value="<?= htmlspecialchars($search) ?>">
            <button type="submit" class="export-btn" style="min-width:80px">Cari</button>
        </form>
        <button class="export-btn" onclick="exportCSV()">⬇ CSV</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
        <table class="data-table" id="dataTable">
            <thead>
                <tr>
                    <th data-col="0">#</th>
                    <th data-col="1">Waktu</th>
                    <th data-col="2">Suhu</th>
                    <th data-col="3">Kel. Udara</th>
                    <th data-col="4">Kel. Tanah</th>
                    <th data-col="5">Cahaya</th>
                    <th data-col="6">Latitude</th>
                    <th data-col="7">Longitude</th>
                </tr>
            </thead>
            <tbody>
            <?php if ($result && $result->num_rows > 0):
                $no = $offset + 1;
                while ($row = $result->fetch_assoc()):
            ?>
                <tr>
                    <td class="td-dim"><?= $no++ ?></td>
                    <td class="td-muted"><?= htmlspecialchars($row['waktu']) ?></td>
                    <td><span class="val-badge badge-amber"><?= number_format((float)$row['suhuUdara'],1) ?>°C</span></td>
                    <td><span class="val-badge badge-cyan"><?= number_format((float)$row['kelUdara'],0) ?>%</span></td>
                    <td><span class="val-badge badge-green"><?= number_format((float)$row['kelTanah'],0) ?>%</span></td>
                    <td><span class="val-badge badge-lime"><?= number_format((float)$row['kecerahan'],0) ?>%</span></td>
                    <td class="td-dim"><?= htmlspecialchars($row['latitude']) ?></td>
                    <td class="td-dim"><?= htmlspecialchars($row['longitude']) ?></td>
                </tr>
            <?php endwhile; else: ?>
                <tr>
                    <td colspan="8" style="text-align:center;padding:28px;color:var(--tx-low)">
                        Belum ada data untuk periode ini.
                    </td>
                </tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    <?php if ($totalPages > 1): ?>
    <div class="pagination">
        <?php if ($page > 1): ?>
        <a href="?filter=<?= $filter ?>&search=<?= urlencode($search) ?>&page=<?= $page-1 ?>"
           class="pg-btn">‹ Prev</a>
        <?php endif; ?>

        <?php
        $start = max(1, $page - 2);
        $end   = min($totalPages, $page + 2);
        for ($i = $start; $i <= $end; $i++):
        ?>
        <a href="?filter=<?= $filter ?>&search=<?= urlencode($search) ?>&page=<?= $i ?>"
           class="pg-btn <?= $i===$page?'active':'' ?>"><?= $i ?></a>
        <?php endfor; ?>

        <?php if ($page < $totalPages): ?>
        <a href="?filter=<?= $filter ?>&search=<?= urlencode($search) ?>&page=<?= $page+1 ?>"
           class="pg-btn">Next ›</a>
        <?php endif; ?>

        <span class="pg-info">
            Hal <?= $page ?> / <?= $totalPages ?>
            &nbsp;(<?= number_format($totalRows) ?> baris)
        </span>
    </div>
    <?php endif; ?>

</div><!-- /riwayat-content -->
</div><!-- /#app-content -->

<script id="page-script">
    if (typeof initRiwayat === 'function') initRiwayat();
</script>
<script src="script.js?v=<?= time() ?>"></script>

</body>
</html>
<?php $conn->close(); ?>
