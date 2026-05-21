/* ═══════════════════════════════════════════════════════
   AgroMonitor ESP32 — script.js  (v3 — Emerald Night)
   UPDATE: ApexCharts + Polling (SSE dihapus)
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Chart (ApexCharts) ──────────────────────────────────
let sensorChart     = null;
let sensorChartType = 'suhu';
let chartSmoothness = 0.55;

const CHART_COLORS = {
  suhu:   { color: '#fb923c', cls: 'active-temp'  },
  udara:  { color: '#38bdf8', cls: 'active-humid' },
  tanah:  { color: '#34d399', cls: 'active-soil'  },
  cahaya: { color: '#facc15', cls: 'active-light' },
};

function getChartSeriesMeta(type) {
  const meta = {
    suhu:   { label: 'Suhu Udara',        unit: '°C',   color: '#fb923c' },
    udara:  { label: 'Kelembapan Udara',  unit: '%',    color: '#38bdf8' },
    tanah:  { label: 'Kelembapan Tanah',  unit: '%',    color: '#34d399' },
    cahaya: { label: 'Intensitas Cahaya', unit: ' Lux', color: '#facc15' },
  };
  return meta[type] || meta.suhu;
}

function getChartData(type) {
  const rows = Array.isArray(window.chartData) ? window.chartData : [];
  return rows
    .filter(row => row && typeof row.date === 'number')
    .map(row => ({ x: row.date, y: Number(row[type]) || 0 }));
}

function showChartLoading(isVisible, message = 'Memuat grafik...') {
  const overlay = document.getElementById('chartLoading');
  if (!overlay) return;
  overlay.classList.toggle('is-visible', !!isVisible);
  overlay.setAttribute('aria-hidden', String(!isVisible));
  const text = overlay.querySelector('.chart-loading-text');
  if (text && message) text.textContent = message;
}

function disposeChart() {
  if (sensorChart) { sensorChart.destroy(); sensorChart = null; }
  const container = document.getElementById('chartSensor');
  if (container) container.innerHTML = '';
}

function updateCurveSmoothness(value) {
  chartSmoothness = Math.max(0, Math.min(1, parseFloat(value) || 0));
  if (sensorChart) {
    sensorChart.updateOptions({
      stroke: { curve: chartSmoothness > 0.3 ? 'smooth' : 'straight' }
    }, false, false);
  }
}

function updateStatsBar(type) {
  const stats = window.chartStats?.[type];
  const meta  = getChartSeriesMeta(type);
  if (!stats) return;
  const avgEl = document.getElementById('statAvg');
  const minEl = document.getElementById('statMin');
  const maxEl = document.getElementById('statMax');
  if (avgEl) avgEl.innerHTML = `${stats.avg}<small>${meta.unit}</small>`;
  if (minEl) minEl.innerHTML = `${stats.min}<small>${meta.unit}</small>`;
  if (maxEl) maxEl.innerHTML = `${stats.max}<small>${meta.unit}</small>`;
}

function createChart(type) {
  const container = document.getElementById('chartSensor');
  if (!container) return;

  // Pastikan ApexCharts sudah tersedia
  if (typeof ApexCharts === 'undefined') {
    showChartLoading(true, 'Memuat library chart...');
    setTimeout(() => createChart(type), 300);
    return;
  }

  const meta    = getChartSeriesMeta(type);
  const data    = getChartData(type);
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const bgCard  = isLight ? '#ffffff' : '#0b1f15';
  const txtColor  = isLight ? '#6b7280' : '#6ee7b7';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(52,211,153,0.08)';

  showChartLoading(true, 'Memuat grafik...');
  disposeChart();

  if (!data.length) {
    container.innerHTML = '<div class="chart-empty">Tidak ada data harian untuk ditampilkan.</div>';
    showChartLoading(false);
    return;
  }

  const options = {
    series: [{ name: meta.label, data }],
    chart: {
      type: 'area',
      height: 340,
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: true, type: 'x' },
      animations: { enabled: true, speed: 500, easing: 'easeinout' },
      fontFamily: 'Sora, sans-serif',
      events: {
        mounted: () => showChartLoading(false),
        updated: () => showChartLoading(false),
      },
    },
    stroke: {
      curve: chartSmoothness > 0.3 ? 'smooth' : 'straight',
      width: 3,
      colors: [meta.color],
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.22,
        opacityTo: 0.02,
        stops: [0, 95, 100],
      },
    },
    colors: [meta.color],
    markers: {
      size: 4,
      colors: [bgCard],
      strokeColors: [meta.color],
      strokeWidth: 2,
      hover: { size: 6 },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: txtColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' },
        datetimeFormatter: { day: 'dd MMM' },
      },
      axisBorder: { show: false },
      axisTicks:  { show: false },
    },
    yaxis: {
      min: 0,
      labels: {
        style: { colors: txtColor, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' },
        formatter: val => val.toFixed(1) + meta.unit,
      },
    },
    tooltip: {
      theme: isLight ? 'light' : 'dark',
      x: { format: 'dd MMM yyyy' },
      y: { formatter: val => val.toFixed(2) + meta.unit },
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      padding: { left: 4, right: 4 },
    },
    dataLabels: { enabled: false },
    noData: {
      text: 'Tidak ada data',
      style: { color: txtColor, fontFamily: 'Sora, sans-serif' },
    },
  };

  sensorChart = new ApexCharts(container, options);
  sensorChart.render();
}

function showChart(type) {
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.className = btn.className.replace(/active-\w+/, '').trim();
  });
  const btn = document.querySelector(`[data-chart="${type}"]`);
  if (btn) btn.classList.add(CHART_COLORS[type]?.cls);

  sensorChartType = type;
  updateStatsBar(type);
  updateCurveSmoothness(document.getElementById('curveSmoothness')?.value ?? chartSmoothness);
  createChart(type);
}

// ── Polling pengganti SSE ────────────────────────────────
let sseConnection = null;
let pollingTimer  = null;

function initRealTime() {
  if (pollingTimer) clearInterval(pollingTimer);
  pollingTimer = setInterval(pollSensor, 5000);
}

function pollSensor() {
  fetch('get-latest.php')
    .then(res => res.json())
    .then(newData => {
      if (!newData || newData.error) return;

      const suhu   = parseFloat(newData.suhuUdara);
      const udara  = parseFloat(newData.kelUdara);
      const tanah  = parseFloat(newData.kelTanah);
      const cahaya = parseFloat(newData.kecerahan);

      window.latestData = { suhuUdara: suhu, kelUdara: udara, kelTanah: tanah, kecerahan: cahaya };

      updateSensorLive('.type-temp',  suhu,   '°C',   50);
      updateSensorLive('.type-humid', udara,  '%',    100);
      updateSensorLive('.type-soil',  tanah,  '%',    100);
      updateSensorLive('.type-light', cahaya, ' Lux', 80000);

      updateHealthBarLive('.fill-green', tanah);
      updateHealthBarLive('.fill-cyan',  udara);
      updateHealthBarLive('.fill-amber', Math.max(0, 100 - Math.abs(suhu - 28) * 8));
      updateHealthBarLive('.fill-lime',  cahaya);

      checkSensorAlerts();
    })
    .catch(err => console.warn('[Polling] Gagal:', err));
}

// ── DOM helpers ──────────────────────────────────────────
function updateSensorLive(selector, val, unit, maxLimit) {
  const card = document.querySelector(selector);
  if (!card) return;

  const valueText = card.querySelector('.card-value');
  if (valueText) {
    valueText.innerHTML = `${val.toFixed(selector === '.type-temp' ? 1 : 0)}<span class="card-unit">${unit}</span>`;
  }

  const gauge = card.querySelector('.gauge-svg circle:nth-child(2)');
  if (gauge) {
    const pct = Math.min(val / maxLimit, 1);
    const dashLength = 2 * Math.PI * 20;
    gauge.style.strokeDashoffset = dashLength * (1 - pct);
  }
}

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
  const ring     = document.getElementById('pumpRing');
  const statusEl = document.getElementById('statusPompa');
  const label    = document.getElementById('pumpLabel');

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
        label.textContent = s === 'ON' ? 'AKTIF' : s === 'AUTO' ? 'AUTO' : 'STANDBY';
        label.className   = `pump-status-text ${s === 'ON' ? 'on' : s === 'AUTO' ? 'auto' : 'off'}`;
      }
      showToast(
        s === 'ON'   ? 'Pompa dinyalakan ✅' :
        s === 'AUTO' ? 'Mode AUTO aktif ⟳'  : 'Pompa dimatikan ■',
        s === 'OFF'  ? 'info' : 'ok'
      );
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

// ── Toast ────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const colors = { warn: '#f87171', ok: '#34d399', info: '#38bdf8' };
  const icons  = { warn: '⚠️', ok: '✅', info: 'ℹ️' };

  const el = document.createElement('div');
  el.className = 'toast-item';
  el.style.cssText = `background:var(--bg-card);border:1px solid ${colors[type]};border-left:3px solid ${colors[type]};
    border-radius:12px;padding:12px 14px;display:flex;align-items:flex-start;gap:9px;
    box-shadow:0 4px 24px rgba(0,0,0,0.4);animation:toast-in .3s ease;min-width:260px;max-width:320px;`;
  el.innerHTML = `
    <span style="font-size:15px;flex-shrink:0">${icons[type]}</span>
    <span style="font-size:12px;color:var(--tx-hi);line-height:1.5;flex:1">${msg}</span>
    <button onclick="this.closest('.toast-item').remove()"
            style="background:none;border:none;color:var(--tx-low);cursor:pointer;font-size:13px;padding:0">✕</button>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toastContainer';
  c.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
  document.body.appendChild(c);
  return c;
}

// ── Sensor alerts ────────────────────────────────────────
let lastSensorState = null;
function checkSensorAlerts() {
  if (!window.latestData) return;
  const d = window.latestData;
  let currentState = 'normal';

  if (d.kelTanah < 60)    currentState = 'tanah_rendah';
  else if (d.suhuUdara > 32) currentState = 'suhu_tinggi';

  if (lastSensorState === currentState) return;
  lastSensorState = currentState;

  if (currentState === 'tanah_rendah')
    showToast(`⚠️ Kelembapan tanah rendah (${d.kelTanah.toFixed(0)}%) — aktifkan pompa!`, 'warn');
  else if (currentState === 'suhu_tinggi')
    showToast(`🌡️ Suhu tinggi (${d.suhuUdara.toFixed(1)}°C) — tingkatkan penyiraman.`, 'warn');
  else
    showToast('✅ Semua parameter sensor normal.', 'ok');
}

// ── Theme toggle ─────────────────────────────────────────
function initTheme() {
  const toggleInput       = document.getElementById('dn');
  const toggleMobileInput = document.getElementById('dn-mobile');

  if (!toggleInput && !toggleMobileInput) return;

  const apply = (th) => {
    if (th === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (toggleInput)       toggleInput.checked = false;
      if (toggleMobileInput) toggleMobileInput.checked = false;
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (toggleInput)       toggleInput.checked = true;
      if (toggleMobileInput) toggleMobileInput.checked = true;
    }
  };

  apply(localStorage.getItem('agro-theme') || 'dark');

  const handleChange = (e) => {
    const next = e.target.checked ? 'dark' : 'light';
    localStorage.setItem('agro-theme', next);
    apply(next);
    // Re-render chart dengan warna tema baru
    const activeTab = document.querySelector('.chart-tab[class*="active-"]');
    if (activeTab?.dataset?.chart) showChart(activeTab.dataset.chart);
  };

  if (toggleInput)       toggleInput.onchange = handleChange;
  if (toggleMobileInput) toggleMobileInput.onchange = handleChange;
}

// ── Spark bars ───────────────────────────────────────────
function renderSparkBars() {
  document.querySelectorAll('.spark-bars').forEach(container => {
    try {
      const vals = JSON.parse(container.dataset.vals || '[]');
      if (!vals.length) return;

      const max   = Math.max(...vals);
      const min   = Math.min(...vals);
      const range = max - min || 1;

      container.innerHTML = vals.map(v => {
        const pct = Math.max(15, ((v - min) / range) * 100);
        return `<div class="spark-bar" style="height:${pct}%"></div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = '';
    }
  });
}

// ── Init Dashboard ───────────────────────────────────────
function initDashboard() {
  const activeTab = document.querySelector('.chart-tab[class*="active-"]');
  const type = activeTab ? activeTab.dataset.chart : 'suhu';

  updateCurveSmoothness(document.getElementById('curveSmoothness')?.value || chartSmoothness);

  if (document.getElementById('chartSensor') && window.chartData) {
    showChart(type);
  }

  renderSparkBars();

  document.querySelectorAll('.health-fill').forEach(el => {
    const target = el.dataset.pct || '0';
    el.style.width = '0%';
    setTimeout(() => { el.style.width = target + '%'; }, 100);
  });

  initRealTime();
}

// ── Init Riwayat ─────────────────────────────────────────
function initRiwayat() {
  if (pollingTimer)  { clearInterval(pollingTimer); pollingTimer = null; }
  if (sseConnection) { sseConnection.close(); sseConnection = null; }
  disposeChart();
}

// ── Export CSV ───────────────────────────────────────────
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
    download: `sensor_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

// ── DOMContentLoaded ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (document.getElementById('chartSensor')) initDashboard();
  else initRiwayat();
});

// ── SPA Navigation ───────────────────────────────────────
document.addEventListener('click', function (e) {
  const target = e.target.closest('a');
  if (!target) return;
  if (target.hostname !== window.location.hostname || target.getAttribute('target') === '_blank') return;
  if (target.classList.contains('no-spa')) return;
  if (target.href.includes('#')) return;

  e.preventDefault();
  navigateTo(target.href);
});

window.addEventListener('popstate', function () {
  navigateTo(window.location.href, false);
});

function navigateTo(url, push = true) {
  const contentEl = document.getElementById('app-content');
  if (contentEl) contentEl.style.opacity = '0.5';

  fetch(url)
    .then(res => res.text())
    .then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const newContent = doc.getElementById('app-content');
      if (newContent && contentEl) {
        contentEl.innerHTML = newContent.innerHTML;
        contentEl.style.opacity = '1';
      }

      // Update active nav
      const aPath = new URL(url).pathname.split('/').pop() || 'index.php';
      document.querySelector('.side-nav-item.active')?.classList.remove('active');
      document.querySelector(`.side-nav-item[href^="${aPath}"]`)?.classList.add('active');

      document.title = doc.title;
      if (push) history.pushState({}, '', url);

      // Inject window data dari halaman baru
      const pageScript = doc.getElementById('page-script');
      if (pageScript) {
        try { eval(pageScript.textContent); } catch (e) { /* silent */ }
      }

      initTheme();

      const pageName = new URL(url).pathname.split('/').pop() || 'index.php';
      if (pageName === 'index.php' || pageName === '') {
        initDashboard();
      } else if (pageName === 'riwayat.php') {
        initRiwayat();
      }
    })
    .catch(err => {
      console.error('SPA Error:', err);
      window.location.assign(url);
    });
}