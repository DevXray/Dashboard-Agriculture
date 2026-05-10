<?php
/**
 * index.php — AgroMonitor v3 (Emerald Night)
 * Dashboard utama sensor ESP32
 */
include 'koneksi.php';

// ── Ambil data terbaru ──────────────────────────────────────────
$latest = mysqli_query($conn, "SELECT * FROM DataSensor ORDER BY id DESC LIMIT 1");
$data   = mysqli_fetch_assoc($latest);

if (!$data) {
    $data = [
        'suhuUdara' => 0, 'kelUdara' => 0, 'kelTanah' => 0,
        'kecerahan' => 0, 'latitude' => '-', 'longitude' => '-', 'waktu' => '-'
    ];
}

// ── Ambil riwayat 7 hari untuk chart ────────────────────────────
$query = mysqli_query($conn, "
    SELECT * FROM DataSensor
    WHERE waktu >= NOW() - INTERVAL 7 DAY
    ORDER BY waktu ASC
");

$waktu = []; $suhu = []; $udara = []; $tanah = []; $cahaya = [];

while ($row = mysqli_fetch_assoc($query)) {
    $waktu[]  = date('d-m H:i', strtotime($row['waktu']));
    $suhu[]   = (float) $row['suhuUdara'];
    $udara[]  = (float) $row['kelUdara'];
    $tanah[]  = (float) $row['kelTanah'];
    $cahaya[] = (float) $row['kecerahan'];
}

// ── Helper functions ─────────────────────────────────────────────
function clamp_pct($v)       { return max(0, min(100, (float)$v)); }
function last_n($arr, $n)    { return array_slice($arr, max(0, count($arr) - $n)); }
function format_trend($arr, $unit) {
    $c = count($arr);
    if ($c < 2) return "0{$unit} vs sebelumnya";
    $d = $arr[$c-1] - $arr[$c-2];
    return ($d >= 0 ? '+' : '') . number_format($d, 1) . $unit . ' vs sebelumnya';
}
function avg_last($arr, $n = 20) {
    $s = array_slice($arr, max(0, count($arr) - $n));
    return count($s) ? array_sum($s) / count($s) : 0;
}
function min_last($arr, $n = 20) { $s = array_slice($arr, max(0, count($arr)-$n)); return count($s)?min($s):0; }
function max_last($arr, $n = 20) { $s = array_slice($arr, max(0, count($arr)-$n)); return count($s)?max($s):0; }

// ── Spark data ───────────────────────────────────────────────────
$sparkSuhu   = last_n($suhu,   12);
$sparkUdara  = last_n($udara,  12);
$sparkTanah  = last_n($tanah,  12);
$sparkCahaya = last_n($cahaya, 12);

// ── Trend ────────────────────────────────────────────────────────
$trendSuhu   = format_trend($suhu,   '°C');
$trendUdara  = format_trend($udara,  '%');
$trendTanah  = format_trend($tanah,  '%');
$trendCahaya = format_trend($cahaya, '%');

// ── Pompa ────────────────────────────────────────────────────────
$pumpStatus = 'OFF';
if (file_exists('relay_status.txt')) {
    $pumpStatus = strtoupper(trim(file_get_contents('relay_status.txt')));
}
$isPumpOn   = $pumpStatus === 'ON';
$isPumpAuto = $pumpStatus === 'AUTO';

// ── Health ───────────────────────────────────────────────────────
$healthTemp  = clamp_pct(((float)$data['suhuUdara'] / 50) * 100);
$healthUdara = clamp_pct($data['kelUdara']);
$healthTanah = clamp_pct($data['kelTanah']);
$healthCahaya= clamp_pct($data['kecerahan']);
$tempOptimal = max(0, 100 - abs((float)$data['suhuUdara'] - 28) * 8);

// ── Stats (avg/min/max 20 data terakhir) ─────────────────────────
$statSuhu   = ['avg'=>number_format(avg_last($suhu),1),  'min'=>number_format(min_last($suhu),1),  'max'=>number_format(max_last($suhu),1)];
$statUdara  = ['avg'=>number_format(avg_last($udara),1), 'min'=>number_format(min_last($udara),1), 'max'=>number_format(max_last($udara),1)];
$statTanah  = ['avg'=>number_format(avg_last($tanah),1), 'min'=>number_format(min_last($tanah),1), 'max'=>number_format(max_last($tanah),1)];
$statCahaya = ['avg'=>number_format(avg_last($cahaya),1),'min'=>number_format(min_last($cahaya),1),'max'=>number_format(max_last($cahaya),1)];

// ── Rekomendasi Kangkung ─────────────────────────────────────────
$rk = [];
$su = (float)$data['suhuUdara']; $ku = (float)$data['kelUdara'];
$kt = (float)$data['kelTanah'];  $kc = (float)$data['kecerahan'];

$rk[] = [
    'icon' => '🌱', 'label' => 'Tanah', 'val' => number_format($kt,0).'%',
    'cls'  => $kt < 60 ? 'warn' : '',
    'text' => $kt < 60
        ? 'Kelembapan tanah rendah (<60%). Kangkung butuh air banyak — segera aktifkan pompa!'
        : ($kt > 80 ? 'Kondisi tanah basah/tergenang — ideal untuk kangkung semi-akuatik.' : 'Kelembapan tanah cukup dan stabil.'),
];
$rk[] = [
    'icon' => '🌡️', 'label' => 'Suhu', 'val' => number_format($su,1).'°C',
    'cls'  => ($su < 25 || $su > 32) ? 'amber' : '',
    'text' => $su < 25
        ? 'Suhu terlalu dingin. Kangkung optimal tumbuh di 25–32°C.'
        : ($su > 32 ? 'Suhu cukup panas. Tingkatkan frekuensi penyiraman agar tidak layu.' : 'Suhu udara optimal mendukung metabolisme kangkung.'),
];
$rk[] = [
    'icon' => '💨', 'label' => 'Udara', 'val' => number_format($ku,0).'%',
    'cls'  => ($ku < 50 || $ku > 90) ? 'amber' : '',
    'text' => $ku < 50
        ? 'Udara terlalu kering. Kurangi paparan angin langsung.'
        : ($ku > 90 ? 'Kelembapan sangat tinggi. Waspadai jamur/embun tepung pada daun.' : 'Kelembapan udara ideal untuk respirasi kangkung.'),
];
$rk[] = [
    'icon' => '☀️', 'label' => 'Cahaya', 'val' => number_format($kc,0).'%',
    'cls'  => $kc < 40 ? 'amber' : '',
    'text' => $kc < 40
        ? 'Cahaya kurang (<40%). Fotosintesis terhambat — daun bisa menjadi pucat.'
        : 'Cahaya matahari cukup untuk pertumbuhan daun hijau yang maksimal.',
];

// ── Waktu & koordinat ────────────────────────────────────────────
$lastUpdate  = $data['waktu'] !== '-' ? date('d M Y H:i', strtotime($data['waktu'])) : '-';
$lastRefresh = date('H:i:s');
$lat         = $data['latitude']  ?? '-';
$lon         = $data['longitude'] ?? '-';
$coordText   = ($lat !== '-' && $lon !== '-') ? $lat.', '.$lon : '-';

$healthBadgeClass = $healthTanah < 30 ? 'warn' : 'good';
$healthBadgeText  = $healthTanah < 30
    ? '⚠️ Kelembapan tanah kritis — cek irigasi segera.'
    : '✅ Kondisi lahan stabil dan normal.';

// latestData untuk JS toast alerts
$latestDataJson = json_encode([
    'suhuUdara' => $su, 'kelUdara' => $ku, 'kelTanah' => $kt, 'kecerahan' => $kc
]);
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AgroMonitor — Dashboard</title>
    <link rel="icon" href="img/kangkung.png">
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>

<?php include 'sidebar.php'; ?>

<div id="app-content">
<div class="app-layout">

<!-- ═══════ MAIN CONTENT ═══════════════════════════════════════ -->
<main class="main-content">

    <!-- Page top -->
    <div class="page-top">
        <div>
            <div class="page-title-lg">Monitoring Tanaman 🌿</div>
            <div class="page-subtitle">Kangkung Hydroponic · Greenhouse A · Update: <?= $lastUpdate ?></div>
        </div>
        <div class="node-badge">ESP32-AGRO-01</div>
    </div>

    <!-- ── Sensor Cards ──────────────────────────────────────── -->
    <section class="sensor-grid">

        <!-- Suhu -->
        <div class="sensor-card type-temp">
            <div class="card-top">
                <div>
                    <div class="card-label">Suhu Udara</div>
                    <div class="card-value"><?= number_format($su,1) ?><span class="card-unit">°C</span></div>
                    <div class="card-trend">
                        <span class="card-trend-dot"></span><?= $trendSuhu ?>
                    </div>
                </div>
                <!-- Radial gauge SVG -->
                <svg class="gauge-svg" width="52" height="52">
                    <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
                    <circle cx="26" cy="26" r="20" fill="none" stroke="var(--c-temp)" stroke-width="3"
                            stroke-linecap="round"
                            stroke-dasharray="<?= 2*M_PI*20 ?>"
                            stroke-dashoffset="<?= 2*M_PI*20*(1-min($su/50,1)) ?>"
                            style="transition:stroke-dashoffset 1.2s ease;filter:drop-shadow(0 0 4px var(--c-temp))"/>
                </svg>
            </div>
            <div class="spark-bars" data-vals='<?= htmlspecialchars(json_encode($sparkSuhu)) ?>'></div>
            <!-- Stats mini -->
            <div class="stats-mini">
                <span>AVG <?= $statSuhu['avg'] ?>°C</span>
                <span>MIN <?= $statSuhu['min'] ?></span>
                <span>MAX <?= $statSuhu['max'] ?></span>
            </div>
        </div>

        <!-- Kelembapan Udara -->
        <div class="sensor-card type-humid">
            <div class="card-top">
                <div>
                    <div class="card-label">Kelembapan Udara</div>
                    <div class="card-value"><?= number_format($ku,0) ?><span class="card-unit">%</span></div>
                    <div class="card-trend">
                        <span class="card-trend-dot"></span><?= $trendUdara ?>
                    </div>
                </div>
                <svg class="gauge-svg" width="52" height="52">
                    <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
                    <circle cx="26" cy="26" r="20" fill="none" stroke="var(--c-humid)" stroke-width="3"
                            stroke-linecap="round"
                            stroke-dasharray="<?= 2*M_PI*20 ?>"
                            stroke-dashoffset="<?= 2*M_PI*20*(1-min($ku/100,1)) ?>"
                            style="transition:stroke-dashoffset 1.2s ease;filter:drop-shadow(0 0 4px var(--c-humid))"/>
                </svg>
            </div>
            <div class="spark-bars" data-vals='<?= htmlspecialchars(json_encode($sparkUdara)) ?>'></div>
            <div class="stats-mini">
                <span>AVG <?= $statUdara['avg'] ?>%</span>
                <span>MIN <?= $statUdara['min'] ?></span>
                <span>MAX <?= $statUdara['max'] ?></span>
            </div>
        </div>

        <!-- Kelembapan Tanah -->
        <div class="sensor-card type-soil">
            <div class="card-top">
                <div>
                    <div class="card-label">Kelembapan Tanah</div>
                    <div class="card-value"><?= number_format($kt,0) ?><span class="card-unit">%</span></div>
                    <div class="card-trend">
                        <span class="card-trend-dot"></span><?= $trendTanah ?>
                    </div>
                </div>
                <svg class="gauge-svg" width="52" height="52">
                    <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
                    <circle cx="26" cy="26" r="20" fill="none" stroke="var(--c-soil)" stroke-width="3"
                            stroke-linecap="round"
                            stroke-dasharray="<?= 2*M_PI*20 ?>"
                            stroke-dashoffset="<?= 2*M_PI*20*(1-min($kt/100,1)) ?>"
                            style="transition:stroke-dashoffset 1.2s ease;filter:drop-shadow(0 0 4px var(--c-soil))"/>
                </svg>
            </div>
            <div class="spark-bars" data-vals='<?= htmlspecialchars(json_encode($sparkTanah)) ?>'></div>
            <div class="stats-mini">
                <span>AVG <?= $statTanah['avg'] ?>%</span>
                <span>MIN <?= $statTanah['min'] ?></span>
                <span>MAX <?= $statTanah['max'] ?></span>
            </div>
        </div>

        <!-- Intensitas Cahaya -->
        <div class="sensor-card type-light">
            <div class="card-top">
                <div>
                    <div class="card-label">Intensitas Cahaya</div>
                    <div class="card-value"><?= number_format($kc,0) ?><span class="card-unit">%</span></div>
                    <div class="card-trend">
                        <span class="card-trend-dot"></span><?= $trendCahaya ?>
                    </div>
                </div>
                <svg class="gauge-svg" width="52" height="52">
                    <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="3"/>
                    <circle cx="26" cy="26" r="20" fill="none" stroke="var(--c-light)" stroke-width="3"
                            stroke-linecap="round"
                            stroke-dasharray="<?= 2*M_PI*20 ?>"
                            stroke-dashoffset="<?= 2*M_PI*20*(1-min($kc/100,1)) ?>"
                            style="transition:stroke-dashoffset 1.2s ease;filter:drop-shadow(0 0 4px var(--c-light))"/>
                </svg>
            </div>
            <div class="spark-bars" data-vals='<?= htmlspecialchars(json_encode($sparkCahaya)) ?>'></div>
            <div class="stats-mini">
                <span>AVG <?= $statCahaya['avg'] ?>%</span>
                <span>MIN <?= $statCahaya['min'] ?></span>
                <span>MAX <?= $statCahaya['max'] ?></span>
            </div>
        </div>

    </section><!-- /sensor-grid -->

    <!-- ── Chart ─────────────────────────────────────────────── -->
    <section class="chart-box">
        <div class="chart-header">
            <div>
                <div class="chart-title">Grafik Sensor</div>
                <div class="chart-sub">7 hari terakhir · real-time</div>
            </div>
            <div class="chart-tabs">
                <button class="chart-tab active-temp" data-chart="suhu"   onclick="showChart('suhu')">Suhu</button>
                <button class="chart-tab"             data-chart="udara"  onclick="showChart('udara')">Udara</button>
                <button class="chart-tab"             data-chart="tanah"  onclick="showChart('tanah')">Tanah</button>
                <button class="chart-tab"             data-chart="cahaya" onclick="showChart('cahaya')">Cahaya</button>
            </div>
        </div>
        <!-- Stats bar -->
        <div id="statsBar">
            <div class="stat-cell"><span class="stat-k">AVG</span><span class="stat-v" id="statAvg"><?= $statSuhu['avg'] ?><small>°C</small></span></div>
            <div class="stat-cell"><span class="stat-k">MIN</span><span class="stat-v" id="statMin"><?= $statSuhu['min'] ?><small>°C</small></span></div>
            <div class="stat-cell"><span class="stat-k">MAX</span><span class="stat-v" id="statMax"><?= $statSuhu['max'] ?><small>°C</small></span></div>
        </div>
        <canvas id="chartSensor"></canvas>
    </section>

    <!-- ── Bottom Grid: Rekomendasi + Ringkasan ──────────────── -->
    <section class="bottom-grid">

        <!-- Rekomendasi -->
        <div class="side-box">
            <div class="side-box-title">Rekomendasi Pertanian Kangkung</div>
            <ul class="rekomendasi-list">
                <?php foreach ($rk as $item): ?>
                <li class="<?= $item['cls'] ?>">
                    <span class="rk-icon"><?= $item['icon'] ?></span>
                    <div>
                        <strong>
                            <?= $item['label'] ?>
                            <span class="rk-val-badge <?= $item['cls']===''?'rk-ok':('rk-'.$item['cls']) ?>">
                                <?= $item['val'] ?>
                            </span>
                        </strong>
                        <?= $item['text'] ?>
                    </div>
                </li>
                <?php endforeach; ?>
            </ul>
        </div>

        <!-- Ringkasan + Lokasi -->
        <div class="side-box">
            <div class="side-box-title">Ringkasan Sensor</div>
            <div class="weather-grid">
                <?php
                $wItems = [
                    ['🌡️','Suhu',     number_format($su,1).'°C'],
                    ['💧','Udara',    number_format($ku,0).'%' ],
                    ['🌱','Tanah',    number_format($kt,0).'%' ],
                    ['☀️','Cahaya',   number_format($kc,0).'%' ],
                ];
                foreach ($wItems as [$icon,$label,$val]):
                ?>
                <div class="weather-cell">
                    <div class="wicon"><?= $icon ?></div>
                    <div class="wlabel"><?= $label ?></div>
                    <div class="wval"><?= $val ?></div>
                </div>
                <?php endforeach; ?>
            </div>

            <div class="side-box-title" style="margin-top:18px">Lokasi Node Sensor</div>
            <div class="map-preview">
                <svg class="map-grid-overlay" viewBox="0 0 200 100" preserveAspectRatio="none">
                    <defs>
                        <pattern id="mgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(52,211,153,0.3)" stroke-width="0.5"/>
                        </pattern>
                    </defs>
                    <rect width="200" height="100" fill="url(#mgrid)"/>
                    <!-- Pulse rings -->
                    <circle cx="100" cy="50" r="6"  fill="var(--em-400)" opacity="0.9"/>
                    <circle cx="100" cy="50" r="12" fill="none" stroke="var(--em-400)" stroke-width="1" opacity="0.5">
                        <animate attributeName="r" from="6" to="22" dur="2s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" from="0.7" to="0" dur="2s" repeatCount="indefinite"/>
                    </circle>
                </svg>
                <div class="map-label">
                    <div class="icon" style="font-size:20px">📍</div>
                    <div class="coords">Makassar, Sulawesi Selatan</div>
                    <div class="coords-sub"><?= htmlspecialchars($coordText) ?></div>
                </div>
            </div>
        </div>

    </section><!-- /bottom-grid -->

</main><!-- /main-content -->

<!-- ═══════ RIGHT SIDEBAR ═══════════════════════════════════════ -->
<aside class="sidebar-panel">

    <!-- Kontrol Pompa -->
    <div class="side-box">
        <div class="side-box-title">Kontrol Pompa Irigasi</div>
        <div class="pump-visual">
            <div id="pumpRing" class="pump-ring <?= $isPumpOn ? 'on' : ($isPumpAuto ? 'auto' : '') ?>">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                    <line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                <div class="water-drops">
                    <span class="drop"></span>
                    <span class="drop"></span>
                    <span class="drop"></span>
                </div>
            </div>
            <span id="pumpLabel"
                  class="pump-status-text <?= $isPumpOn?'on':($isPumpAuto?'auto':'off') ?>">
                <?= $isPumpOn ? 'AKTIF' : ($isPumpAuto ? 'AUTO' : 'STANDBY') ?>
            </span>
        </div>
        <div class="pump-buttons">
            <button class="pump-btn on-btn"   onclick="setPompa('ON')">▶ Nyalakan</button>
            <button class="pump-btn off-btn"  onclick="setPompa('OFF')">■ Matikan</button>
        </div>
        <button class="pump-btn auto-btn" style="width:100%;margin-top:8px"
                onclick="setPompa('AUTO')">⟳ Mode AUTO</button>

        <!-- Jadwal Siram -->
        <div style="border-top:1px solid var(--bd-faint);margin-top:14px;padding-top:12px">
            <div class="sched-toggle">
                <span>Jadwal Siram Otomatis</span>
                <div id="scheduleToggle" class="stoggle-btn" onclick="toggleSchedule()">
                    <div class="sthumb"></div>
                </div>
            </div>
            <div id="schedulePanel">
                <div class="sched-cell">
                    <div class="sk">Mulai</div>
                    <div class="sv">06:00</div>
                </div>
                <div class="sched-cell">
                    <div class="sk">Durasi</div>
                    <div class="sv">15 mnt</div>
                </div>
            </div>
        </div>

        <div class="info-row" style="margin-top:10px">
            <span class="info-key">Status</span>
            <span class="info-val" id="statusPompa"><?= $pumpStatus ?></span>
        </div>
    </div>

    <!-- Kesehatan Lahan -->
    <div class="side-box">
        <div class="side-box-title">Kesehatan Lahan</div>
        <div class="health-bar-wrap">
            <div class="health-label"><span>Kelembapan Tanah</span><span><?= number_format($healthTanah,0) ?>%</span></div>
            <div class="health-bar"><div class="health-fill fill-green" data-pct="<?= $healthTanah ?>"></div></div>
        </div>
        <div class="health-bar-wrap">
            <div class="health-label"><span>Kelembapan Udara</span><span><?= number_format($healthUdara,0) ?>%</span></div>
            <div class="health-bar"><div class="health-fill fill-cyan" data-pct="<?= $healthUdara ?>"></div></div>
        </div>
        <div class="health-bar-wrap">
            <div class="health-label"><span>Suhu Optimal</span><span><?= number_format($tempOptimal,0) ?>%</span></div>
            <div class="health-bar"><div class="health-fill fill-amber" data-pct="<?= $tempOptimal ?>"></div></div>
        </div>
        <div class="health-bar-wrap">
            <div class="health-label"><span>Intensitas Cahaya</span><span><?= number_format($healthCahaya,0) ?>%</span></div>
            <div class="health-bar"><div class="health-fill fill-lime" data-pct="<?= $healthCahaya ?>"></div></div>
        </div>
        <div class="health-badge <?= $healthBadgeClass ?>"><?= $healthBadgeText ?></div>
    </div>

    <!-- Info Sistem -->
    <div class="side-box">
        <div class="side-box-title">Info Sistem</div>
        <?php
        $sysInfo = [
            ['Device',   'ESP32-S3'],
            ['Firmware', 'v2.4.1'],
            ['Interval', '3 menit'],
            ['Uptime',   '3d 14h'],
            ['RSSI',     '-67 dBm'],
            ['Update',   $lastUpdate],
        ];
        foreach ($sysInfo as [$k,$v]):
        ?>
        <div class="info-row">
            <span class="info-key"><?= $k ?></span>
            <span class="info-val"><?= htmlspecialchars($v) ?></span>
        </div>
        <?php endforeach; ?>
    </div>

</aside><!-- /sidebar-panel -->

</div><!-- /app-layout -->
</div><!-- /#app-content -->

<!-- ── Inject data ke JS ──────────────────────────────────────── -->
<script id="page-script">
    window.chartLabels  = <?= json_encode($waktu) ?>;
    window.dataSuhu     = <?= json_encode($suhu)   ?>;
    window.dataUdara    = <?= json_encode($udara)  ?>;
    window.dataTanah    = <?= json_encode($tanah)  ?>;
    window.dataCahaya   = <?= json_encode($cahaya) ?>;
    window.latestData   = <?= $latestDataJson ?>;
    window.chartStats   = {
        suhu:   <?= json_encode($statSuhu)   ?>,
        udara:  <?= json_encode($statUdara)  ?>,
        tanah:  <?= json_encode($statTanah)  ?>,
        cahaya: <?= json_encode($statCahaya) ?>,
    };
    if (typeof initDashboard === 'function') initDashboard();
</script>
<script src="script.js?v=<?= time() ?>"></script>

</body>
</html>
<?php $conn->close(); ?>
