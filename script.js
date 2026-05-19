/* ═══════════════════════════════════════════════════════
   AgroMonitor ESP32 — script.js  (v3 — Emerald Night)
   UPDATE: True Real-Time (Server-Sent Events) 🚀
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Chart ───────────────────────────────────────────────
let sensorChart = null;
const CHART_JS_SRC = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
let chartJsPromise = null;

function loadChartJs() {
  if (window.Chart) return Promise.resolve();
  if (chartJsPromise) return chartJsPromise;

  chartJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHART_JS_SRC;
    script.defer = true;
    script.dataset.chartjs = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat Chart.js'));
    document.head.appendChild(script);
  });

  return chartJsPromise;
}

const CHART_COLORS = {
  suhu:   { stroke: '#fb923c', cls: 'active-temp'  },
  udara:  { stroke: '#38bdf8', cls: 'active-humid' },
  tanah:  { stroke: '#34d399', cls: 'active-soil'  },
  cahaya: { stroke: '#facc15', cls: 'active-light' },
};

async function createChart(label, data, times, color, unit = '%') {
  const canvas = document.getElementById('chartSensor');
  if (!canvas) return;

  await loadChartJs();

  try { if (sensorChart) { sensorChart.destroy(); sensorChart = null; } }
  catch(e) { sensorChart = null; }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor  = isLight ? '#6b7280' : '#2d6650';
  const tooltipBg  = isLight ? '#ffffff' : '#0b1f15';
  const gridColor  = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)';

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, color + '44');
  gradient.addColorStop(1, color + '00');

  const avg = data.length ? (data.reduce((a,b) => a+b, 0) / data.length).toFixed(1) : 0;

  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: times,
      datasets: [{
        label, data,
        borderColor: color, backgroundColor: gradient,
        fill: true, tension: 0.4, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: color, borderWidth: 1,
          titleColor: color, bodyColor: color,
          padding: 10,
          callbacks: { label: ctx => `${ctx.parsed.y}${unit}` },
        }
      },
      scales: {
        x: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 }, maxTicksLimit: 8 },
        },
        y: {
          min: 0,
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 11 }, callback: v => v + unit },
        },
      },
    },
  });
}

async function showChart(type) {
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.className = btn.className.replace(/active-\w+/, '').trim();
  });
  const btn = document.querySelector(`[data-chart="${type}"]`);
  if (btn) btn.classList.add(CHART_COLORS[type]?.cls);

  const labels = window.chartLabels || [];
  switch (type) {
    case 'suhu':   await createChart('Suhu Udara',        window.dataSuhu,   labels, '#fb923c', '°C'); break;
    case 'udara':  await createChart('Kelembapan Udara',  window.dataUdara,  labels, '#38bdf8', '%');  break;
    case 'tanah':  await createChart('Kelembapan Tanah',  window.dataTanah,  labels, '#34d399', '%');  break;
    case 'cahaya': await createChart('Intensitas Cahaya', window.dataCahaya, labels, '#facc15', ' Lux');  break;
  }
}

// ── Real-Time SSE Listener (PENGGANTI AUTO-REFRESH) ──────
let sseConnection = null;

function initRealTime() {
  if (sseConnection) sseConnection.close();
  
  // Konek ke sse.php
  sseConnection = new EventSource('sse.php');

  sseConnection.onmessage = function(event) {
    const newData = JSON.parse(event.data);
    
    const suhu   = parseFloat(newData.suhuUdara);
    const udara  = parseFloat(newData.kelUdara);
    const tanah  = parseFloat(newData.kelTanah);
    const cahaya = parseFloat(newData.kecerahan);
    const waktu  = newData.waktu.substring(11, 16); // Ambil jam & menit saja (HH:mm)

    window.latestData = { suhuUdara: suhu, kelUdara: udara, kelTanah: tanah, kecerahan: cahaya };

    // 1. Update Teks & Gauge Ring di Kartu Sensor secara langsung (DOM Manipulation)
    updateSensorLive('.type-temp', suhu, '°C', 50);
    updateSensorLive('.type-humid', udara, '%', 100);
    updateSensorLive('.type-soil', tanah, '%', 100);
    updateSensorLive('.type-light', cahaya, ' Lux', 80000);

    // 2. Tambahkan data ke Chart secara dinamis
    if (window.chartLabels && sensorChart) {
      window.chartLabels.push(waktu);
      window.dataSuhu.push(suhu);
      window.dataUdara.push(udara);
      window.dataTanah.push(tanah);
      window.dataCahaya.push(cahaya);

      // Jaga agar grafik tidak terlalu padat (maksimal 50 titik terakhir)
      if (window.chartLabels.length > 50) {
        window.chartLabels.shift();
        window.dataSuhu.shift();
        window.dataUdara.shift();
        window.dataTanah.shift();
        window.dataCahaya.shift();
      }

      // Update grafik tanpa animasi berulang ('none' mode)
      sensorChart.update('none');
    }

    // 3. Update Bar Kesehatan di Sidebar
    updateHealthBarLive('.fill-green', tanah);
    updateHealthBarLive('.fill-cyan', udara);
    updateHealthBarLive('.fill-amber', Math.max(0, 100 - Math.abs(suhu - 28) * 8));
    updateHealthBarLive('.fill-lime', cahaya);

    // Cek Alert
    checkSensorAlerts();
  };

  sseConnection.onerror = function(e) {
    if (sseConnection.readyState === 2) { // EventSource.CLOSED = 2
      console.warn("Koneksi Real-time terputus. Mencoba reconnect...");
      setTimeout(initRealTime, 5000);
    }
  };
}

// Fungsi helper memanipulasi DOM kartunya langsung
function updateSensorLive(selector, val, unit, maxLimit) {
  const card = document.querySelector(selector);
  if (!card) return;

  // Update Teks Angka
  const valueText = card.querySelector('.card-value');
  if (valueText) {
    valueText.innerHTML = `${val.toFixed(selector==='.type-temp'?1:0)}<span class="card-unit">${unit}</span>`;
  }

  // Update Animasi Lingkaran (Gauge Ring)
  const gauge = card.querySelector('.gauge-svg circle:nth-child(2)');
  if (gauge) {
    const pct = Math.min(val / maxLimit, 1);
    const dashLength = 2 * Math.PI * 20; // Keliling lingkaran dengan r=20
    gauge.style.strokeDashoffset = dashLength * (1 - pct);
  }
}

// Fungsi helper memanipulasi Health Bar langsung
function updateHealthBarLive(selector, val) {
  const fill = document.querySelector(selector);
  if (fill) {
    fill.dataset.pct = val;
    fill.style.width = Math.max(0, Math.min(100, val)) + '%';
    const labelParent = fill.closest('.health-bar-wrap');
    if (labelParent) {
      const numText = labelParent.querySelector('.health-label span:last-child');
      if (numText) numText.textContent = val.toFixed(0) + '%';
    }
  }
}

// ── Pump ────────────────────────────────────────────────
function setPompa(mode) {
  const ring    = document.getElementById('pumpRing');
  const statusEl = document.getElementById('statusPompa');
  const label   = document.getElementById('pumpLabel');

  if (statusEl) statusEl.textContent = '···';

  fetch(`control.php?mode=${encodeURIComponent(mode)}&token=kangkung_123_farm_secure_token`)
    .then(res => res.text())
    .then(data => {
      const s = data.trim().toUpperCase();
      if (statusEl) statusEl.textContent = s;
      if (ring) {
        ring.classList.remove('on', 'auto');
        if (s === 'ON')   ring.classList.add('on');
        if (s === 'AUTO') ring.classList.add('auto');
      }
      if (label) {
        label.textContent  = s === 'ON' ? 'AKTIF' : s === 'AUTO' ? 'AUTO' : 'STANDBY';
        label.className    = `pump-status-text ${s === 'ON' ? 'on' : s === 'AUTO' ? 'auto' : 'off'}`;
      }
      showToast(s === 'ON' ? 'Pompa dinyalakan ✅' : s === 'AUTO' ? 'Mode AUTO aktif ⟳' : 'Pompa dimatikan ■', s === 'OFF' ? 'info' : 'ok');
    });
}

function toggleSchedule() {
  const btn   = document.getElementById('scheduleToggle');
  const panel = document.getElementById('schedulePanel');
  if (!btn || !panel) return;

  const isOn = btn.dataset.on === 'true';
  btn.dataset.on = String(!isOn);
  panel.style.display = !isOn ? 'grid' : 'none';
}

// ── Toast notifications ──────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const colors = { warn: '#f87171', ok: '#34d399', info: '#38bdf8' };
  const icons  = { warn: '⚠️', ok: '✅', info: 'ℹ️' };

  const el = document.createElement('div');
  el.className = 'toast-item';
  el.style.cssText = `background:var(--bg-card);border:1px solid ${colors[type]};border-left:3px solid ${colors[type]};
    border-radius:12px;padding:12px 14px;display:flex;align-items:flex-start;gap:9px;
    box-shadow:0 4px 24px rgba(0,0,0,0.4);animation:toast-in .3s ease;min-width:260px;max-width:320px;`;
  el.innerHTML = `<span style="font-size:15px;flex-shrink:0">${icons[type]}</span>
    <span style="font-size:12px;color:var(--tx-hi);line-height:1.5;flex:1">${msg}</span>
    <button onclick="this.closest('.toast-item').remove()" style="background:none;border:none;color:var(--tx-low);cursor:pointer;font-size:13px;padding:0">✕</button>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function createToastContainer() {
  const c = document.createElement('div'); c.id = 'toastContainer';
  c.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
  document.body.appendChild(c); return c;
}

// ── Sensor alert check ───────────────────────────────────
let lastSensorState = null;
function checkSensorAlerts() {
  if (!window.latestData) return;
  const d = window.latestData;
  let currentState = 'normal';
  
  if (d.kelTanah < 60) currentState = 'tanah_rendah';
  else if (d.suhuUdara > 32) currentState = 'suhu_tinggi';

  if (lastSensorState === currentState) return; 
  lastSensorState = currentState;

  if (currentState === 'tanah_rendah') showToast(`⚠️ Kelembapan tanah rendah (${d.kelTanah.toFixed(0)}%) — aktifkan pompa!`, 'warn');
  else if (currentState === 'suhu_tinggi') showToast(`🌡️ Suhu tinggi (${d.suhuUdara.toFixed(1)}°C) — tingkatkan penyiraman.`, 'warn');
  else showToast('✅ Semua parameter sensor normal.', 'ok');
}

// ── Theme toggle ─────────────────────────────────────────
function initTheme() {
  const btn = document.getElementById('themeToggle');
  const label = document.getElementById('themeText');
  if (!btn) return;

  const apply = (th) => {
    if (th === 'light') { document.documentElement.setAttribute('data-theme', 'light'); if (label) label.textContent = '🌙 Tema Gelap'; } 
    else { document.documentElement.removeAttribute('data-theme'); if (label) label.textContent = '☀️ Tema Terang'; }
  };
  
  apply(localStorage.getItem('agro-theme') || 'dark');
  btn.onclick = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('agro-theme', next); apply(next);
    const activeTab = document.querySelector('.chart-tab[class*="active-"]');
    if (activeTab?.dataset?.chart) showChart(activeTab.dataset.chart);
  };
}

// ── Inisialisasi ─────────────────────────────────────────
function initDashboard() {
  const activeTab = document.querySelector('.chart-tab[class*="active-"]');
  const type = activeTab ? activeTab.dataset.chart : 'suhu';
  if (document.getElementById('chartSensor') && window.chartLabels) showChart(type);

  // Inisiasi animasi pertama kali
  document.querySelectorAll('.health-fill').forEach(el => {
    const target = el.dataset.pct || '0';
    el.style.width = '0%';
    setTimeout(() => { el.style.width = target + '%'; }, 100);
  });
  
  // Jalankan listener SSE jika berada di dashboard
  initRealTime();
}

function initRiwayat() {
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
}

function exportCSV() {
  const table = document.getElementById('dataTable');
  if (!table) return;
  const rows = [...table.querySelectorAll('tr')].map(row =>
    [...row.querySelectorAll('th,td')].map(cell =>
      `"${cell.textContent.trim().replace(/"/g, '""')}"`
    ).join(',')
  );
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `sensor_${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click();
}

// Call initialization on first load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (document.getElementById('chartSensor')) initDashboard();
  else initRiwayat();
});

// ── SPA Navigation (Pjax) ──────────────────────────────────
document.addEventListener('click', function(e) {
  const target = e.target.closest('a');
  if (!target) return;
  // Pastikan URL internal dan bukan _blank
  if (target.hostname !== window.location.hostname || target.getAttribute('target') === '_blank') return;
  if (target.classList.contains('no-spa')) return;
  if (target.href.includes('#')) return;

  e.preventDefault();
  navigateTo(target.href);
});

window.addEventListener('popstate', function() {
  navigateTo(window.location.href, false);
});

function navigateTo(url, push = true) {
  const contentEl = document.getElementById('app-content');
  if (contentEl) contentEl.style.opacity = '0.5';

  fetch(url)
    .then(res => res.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Update app-content
      const newContent = doc.getElementById('app-content');
      if (newContent && contentEl) {
        contentEl.innerHTML = newContent.innerHTML;
        contentEl.style.opacity = '1';
      }
      
      // Update sidebar active class
      const aPath = new URL(url).pathname.split('/').pop() || 'index.php';
      const currentActive = document.querySelector('.side-nav-item.active');
      if (currentActive) currentActive.classList.remove('active');
      const newActive = document.querySelector(`.side-nav-item[href^="${aPath}"]`);
      if (newActive) newActive.classList.add('active');

      document.title = doc.title;
      if (push) history.pushState({}, '', url);

      // Jalankan skrip inisialisasi berdasarkan nama halaman
      const pageName = new URL(url).pathname.split('/').pop() || 'index.php';
      if (pageName === 'index.php' || pageName === '') {
        initDashboard();
      } else if (pageName === 'riwayat.php') {
        initRiwayat();
      }
    })
    .catch(err => {
      console.error('SPA Error:', err);
      window.location.assign(url); // fallback
    });
}