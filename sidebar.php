<?php
/**
 * sidebar.php — AgroMonitor v3 (Emerald Night)
 * BUG FIX #3: $isPumpOn / $isPumpAuto dijaga dengan isset() 
 *             sehingga aman dipanggil dari riwayat.php
 */
$currentPage = basename($_SERVER['PHP_SELF']);

// State tumbuhan (safe terhadap riwayat.php yang tidak punya $data)
$plantState   = 'happy';
$plantMessage = 'Hore! Kondisi saya optimal. 🌿';

if (isset($data)) {
    $pumpNow = isset($isPumpOn) && $isPumpOn;
    if ($pumpNow) {
        $plantState   = 'drinking';
        $plantMessage = 'Gluk gluk... Segarnya! 💧';
    } elseif (isset($data['kelTanah']) && (float)$data['kelTanah'] < 60) {
        $plantState   = 'sad';
        $plantMessage = 'Hiks.. haus, tanah mulai kering. 😢';
    } elseif (isset($data['suhuUdara']) && (float)$data['suhuUdara'] > 32) {
        $plantState   = 'hot';
        $plantMessage = 'Fiuh.. Tolong, saya kepanasan! 🥵';
    } elseif (isset($data['kecerahan']) && (float)$data['kecerahan'] < 10000) {
        $plantState   = 'sad';
        $plantMessage = 'Gelap sekali... butuh cahaya. 🌑';
    }
}

// Leaf colors berdasarkan state
$leafColors = [
    'happy'    => ['l'=>'#059669','r'=>'#34d399','t'=>'#6ee7b7'],
    'drinking' => ['l'=>'#059669','r'=>'#34d399','t'=>'#6ee7b7'],
    'sad'      => ['l'=>'#65a30d','r'=>'#84cc16','t'=>'#a3e635'],
    'hot'      => ['l'=>'#d97706','r'=>'#fbbf24','t'=>'#fcd34d'],
];
$lc = $leafColors[$plantState] ?? $leafColors['happy'];
?>
<aside class="agro-sidebar">

    <!-- Logo -->
    <div class="logo-mark">
        <div class="logo-icon">
            <img src="img/kangkung.png" alt="Logo"
                 onerror="this.outerHTML='<span style=font-size:18px>🌱</span>'">
        </div>
        <div>
            <div class="logo-text">Agro<span>Monitor</span></div>
            <div class="logo-sub">ESP32 Dashboard v3</div>
        </div>
    </div>

    <!-- Live Clock -->
    <div class="sidebar-clock">
        <div class="clock-time" id="sidebarClock"><?= date('H:i:s') ?></div>
        <div class="clock-date">
<?php
// Fallback jika Intl extension belum diaktifkan di XAMPP/VPS
$hari = ['Sunday'=>'Minggu','Monday'=>'Senin','Tuesday'=>'Selasa','Wednesday'=>'Rabu','Thursday'=>'Kamis','Friday'=>'Jumat','Saturday'=>'Sabtu'];
$bulan = ['January'=>'Januari','February'=>'Februari','March'=>'Maret','April'=>'April','May'=>'Mei','June'=>'Juni','July'=>'Juli','August'=>'Agustus','September'=>'September','October'=>'Oktober','November'=>'November','December'=>'Desember'];
echo strtr(date('l, d F Y'), array_merge($hari, $bulan));
?>
        </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-menu">
        <a href="index.php"
           class="side-nav-item <?= ($currentPage === 'index.php' || $currentPage === '') ? 'active' : '' ?>">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            Dashboard
        </a>
        <a href="riwayat.php"
           class="side-nav-item <?= ($currentPage === 'riwayat.php') ? 'active' : '' ?>">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Riwayat Data
        </a>
    </nav>

    <!-- Mascot Kangkung Animasi -->
    <div class="mascot-container">
        <div class="mascot-wrapper <?= $plantState ?>">
            <svg viewBox="0 0 100 120" width="100%" height="110" class="plant-svg" style="overflow:visible">
                <!-- Pot -->
                <path d="M25 80 L75 80 L65 110 L35 110 Z" fill="#92400e" stroke="#78350f" stroke-width="1.5"/>
                <path d="M20 70 L80 70 L80 80 L20 80 Z" fill="#b45309" stroke="#92400e" stroke-width="1.5"/>
                <!-- Tanah -->
                <ellipse cx="50" cy="70" rx="26" ry="5" fill="<?= $plantState==='sad'?'#a16207':'#065f46' ?>" opacity="0.6"/>
                <!-- Batang -->
                <path class="plant-stem"
                      d="M50 70 Q48 45 50 18"
                      stroke="<?= $lc['l'] ?>" stroke-width="4" fill="none" stroke-linecap="round"/>
                <!-- Daun Kiri -->
                <path class="plant-leaf-l"
                      d="M50 52 Q28 33 14 46 Q28 60 50 52"
                      fill="<?= $lc['l'] ?>" opacity="0.9"
                      style="transform-origin:50px 52px;<?= $plantState==='sad'?'transform:rotate(-28deg) translateY(4px)':($plantState==='hot'?'transform:rotate(-10deg)':'') ?>"/>
                <!-- Daun Kanan -->
                <path class="plant-leaf-r"
                      d="M50 36 Q72 16 86 29 Q72 44 50 36"
                      fill="<?= $lc['r'] ?>" opacity="0.9"
                      style="transform-origin:50px 36px;<?= $plantState==='sad'?'transform:rotate(28deg) translateY(4px)':($plantState==='hot'?'transform:rotate(10deg)':'') ?>"/>
                <!-- Daun Atas -->
                <path class="plant-leaf-t"
                      d="M50 20 Q36 2 50 -8 Q64 2 50 20"
                      fill="<?= $lc['t'] ?>" opacity="0.9"/>

                <!-- Wajah: Happy / Drinking -->
                <?php if ($plantState === 'happy' || $plantState === 'drinking'): ?>
                <path d="M40 91 Q43 88 46 91" stroke="#451a03" fill="none" stroke-width="2" stroke-linecap="round"/>
                <path d="M54 91 Q57 88 60 91" stroke="#451a03" fill="none" stroke-width="2" stroke-linecap="round"/>
                <?php if ($plantState === 'happy'): ?>
                <path d="M45 97 Q50 103 55 97" stroke="#451a03" fill="none" stroke-width="2" stroke-linecap="round"/>
                <?php else: ?>
                <ellipse cx="50" cy="98" rx="3" ry="4" fill="#451a03" style="animation:sip .5s infinite alternate"/>
                <?php endif; ?>
                <?php else: ?>
                <!-- Sad / Hot eyes -->
                <line x1="41" y1="91" x2="45" y2="91" stroke="#451a03" stroke-width="2" stroke-linecap="round"/>
                <line x1="55" y1="91" x2="59" y2="91" stroke="#451a03" stroke-width="2" stroke-linecap="round"/>
                <path d="M46 100 Q50 96 54 100" stroke="#451a03" fill="none" stroke-width="2" stroke-linecap="round"/>
                <?php endif; ?>

                <!-- Keringat (hot) -->
                <?php if ($plantState === 'hot'): ?>
                <circle cx="34" cy="48" r="2.5" fill="#38bdf8" style="animation:drop-sweat 1.4s infinite"/>
                <circle cx="66" cy="38" r="2"   fill="#38bdf8" style="animation:drop-sweat 1.4s .45s infinite"/>
                <?php endif; ?>
            </svg>
        </div>
        <div class="mascot-dialog"><?= htmlspecialchars($plantMessage) ?></div>
    </div>

    <!-- Bottom: refresh + health + theme -->
    <div class="sidebar-bottom">

        <!-- Auto-refresh countdown -->
        <div class="refresh-wrap">
            <div class="refresh-label">
                <span>Auto-refresh</span>
                <span id="lastRefresh"><?= date('H:i:s') ?></span>
            </div>
            <div class="refresh-track"><div id="refreshBar"></div></div>
        </div>

        <!-- Mini health (tanah + suhu) -->
        <?php if (isset($data)): ?>
        <div class="health-bar-wrap" style="margin-bottom:7px">
            <div class="health-label">
                <span>Tanah</span>
                <span><?= number_format((float)$data['kelTanah'],0) ?>%</span>
            </div>
            <div class="health-bar">
                <div class="health-fill fill-green"
                     data-pct="<?= min(100,(float)$data['kelTanah']) ?>"></div>
            </div>
        </div>
        <div class="health-bar-wrap" style="margin-bottom:12px">
            <div class="health-label">
                <span>Suhu Optimal</span>
                <span><?= number_format(max(0,100-abs((float)$data['suhuUdara']-28)*8),0) ?>%</span>
            </div>
            <div class="health-bar">
                <div class="health-fill fill-amber"
                     data-pct="<?= max(0,100-abs((float)$data['suhuUdara']-28)*8) ?>"></div>
            </div>
        </div>
        <?php endif; ?>

        <!-- Status -->
        <div class="status-row">
            <span class="status-dot"></span>
            <span>Live · ESP32 terhubung</span>
        </div>

        <!-- Theme toggle -->
        <div class="theme-toggle-container" style="display:flex; justify-content:center; margin-top:20px; min-height: 50px;">
            <div class="toggleWrapper">
              <input class="input" id="dn" type="checkbox" />
              <label class="toggle" for="dn" id="themeToggleLabel">
                <span class="toggle__handler">
                  <span class="crater crater--1"></span>
                  <span class="crater crater--2"></span>
                  <span class="crater crater--3"></span>
                </span>
                <span class="star star--1"></span>
                <span class="star star--2"></span>
                <span class="star star--3"></span>
                <span class="star star--4"></span>
                <span class="star star--5"></span>
                <span class="star star--6"></span>
              </label>
            </div>
        </div>
    </div>

</aside>

<style>
@keyframes sip       { from{transform:scaleY(1)} to{transform:scaleY(1.35)} }
@keyframes drop-sweat{ 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(20px);opacity:0} }
</style>

<script>
/* Live clock */
(function () {
    function tick() {
        const el = document.getElementById('sidebarClock');
        if (el) el.textContent = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }
    tick();
    setInterval(tick, 1000);
})();
</script>
