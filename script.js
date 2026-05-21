/* ═══════════════════════════════════════════════════════
   AgroMonitor ESP32 — script.js  (v3 — Emerald Night)
   UPDATE: True Real-Time (Server-Sent Events) 🚀
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Chart ───────────────────────────────────────────────
let sensorRoot = null;
let sensorChart = null;
let sensorSeries = null;
let sensorYAxis = null;
let sensorChartType = 'suhu';
let chartSmoothness = 0.55;
const AMCHARTS_INDEX_SRC = 'https://cdn.amcharts.com/lib/5/index.js';
const AMCHARTS_XY_SRC = 'https://cdn.amcharts.com/lib/5/xy.js';
const AMCHARTS_ANIMATED_SRC = 'https://cdn.amcharts.com/lib/5/themes/Animated.js';
let amChartsPromise = null;

function loadExternalScript(src, testFn) {
  if (testFn && testFn()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-amcharts-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Gagal memuat ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.amchartsSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal memuat ${src}`));
    document.head.appendChild(script);
  });
}

function loadAmCharts5() {
  if (window.am5 && window.am5xy && window.am5themes_Animated) return Promise.resolve();
  if (amChartsPromise) return amChartsPromise;

  amChartsPromise = (async () => {
    await loadExternalScript(AMCHARTS_INDEX_SRC, () => window.am5);
    await loadExternalScript(AMCHARTS_XY_SRC, () => window.am5xy);
    await loadExternalScript(AMCHARTS_ANIMATED_SRC, () => window.am5themes_Animated);
  })();

  return amChartsPromise;
}

function showChartLoading(isVisible, message = 'Memuat grafik amCharts 5...') {
  const overlay = document.getElementById('chartLoading');
  if (!overlay) return;

  overlay.classList.toggle('is-visible', !!isVisible);
  overlay.setAttribute('aria-hidden', String(!isVisible));
  const text = overlay.querySelector('.chart-loading-text');
  if (text && message) text.textContent = message;
}

function disposeChart() {
  if (sensorRoot) {
    sensorRoot.dispose();
    sensorRoot = null;
  }
  sensorChart = null;
  sensorSeries = null;
  sensorYAxis = null;
}

function getChartSeriesMeta(type) {
  const meta = {
    suhu:   { label: 'Suhu Udara',        unit: '°C', stroke: '#fb923c', fill: '#fb923c', active: 'active-temp'  },
    udara:  { label: 'Kelembapan Udara',  unit: '%',  stroke: '#38bdf8', fill: '#38bdf8', active: 'active-humid' },
    tanah:  { label: 'Kelembapan Tanah',  unit: '%',  stroke: '#34d399', fill: '#34d399', active: 'active-soil'  },
    cahaya: { label: 'Intensitas Cahaya', unit: ' Lux', stroke: '#facc15', fill: '#facc15', active: 'active-light' },
  };

  return meta[type] || meta.suhu;
}

function getChartData(type) {
  const rows = Array.isArray(window.chartData) ? window.chartData : [];
  return rows
    .filter(row => row && typeof row.date === 'number')
    .map(row => ({
      date: row.date,
      value: Number(row[type]) || 0,
      label: row.label || '',
    }));
}

function updateCurveSmoothness(value) {
  const parsed = Math.max(0, Math.min(1, Number.parseFloat(value)) || 0);
  chartSmoothness = parsed;

  const valueEl = document.getElementById('curveSmoothnessValue');
  if (valueEl) valueEl.textContent = parsed.toFixed(2);

  if (sensorSeries) {
    sensorSeries.set('tension', 1 - parsed);
  }
}

function updateStatsBar(type) {
  const stats = window.chartStats?.[type];
  const meta = getChartSeriesMeta(type);
  if (!stats) return;

  const avgEl = document.getElementById('statAvg');
  const minEl = document.getElementById('statMin');
  const maxEl = document.getElementById('statMax');
  if (avgEl) avgEl.innerHTML = `${stats.avg}<small>${meta.unit}</small>`;
  if (minEl) minEl.innerHTML = `${stats.min}<small>${meta.unit}</small>`;
  if (maxEl) maxEl.innerHTML = `${stats.max}<small>${meta.unit}</small>`;
}

const CHART_COLORS = {
  suhu:   { stroke: '#fb923c', cls: 'active-temp'  },
  udara:  { stroke: '#38bdf8', cls: 'active-humid' },
  tanah:  { stroke: '#34d399', cls: 'active-soil'  },
  cahaya: { stroke: '#facc15', cls: 'active-light' },
};

async function createChart(type) {
  const container = document.getElementById('chartSensor');
  if (!container) return;

  const meta = getChartSeriesMeta(type);
  const chartData = getChartData(type);

  showChartLoading(true, 'Memuat grafik amCharts 5...');
  await loadAmCharts5();

  disposeChart();

  if (!chartData.length) {
    container.innerHTML = '<div class="chart-empty">Tidak ada data harian untuk ditampilkan.</div>';
    showChartLoading(false);
    return;
  }

  sensorRoot = am5.Root.new('chartSensor');
  sensorRoot.setThemes([am5themes_Animated.new(sensorRoot)]);

  const themeIsLight = document.documentElement.getAttribute('data-theme') === 'light';
  const textColor = themeIsLight ? am5.color(0x6b7280) : am5.color(0x6ee7b7);
  const gridColor = themeIsLight ? am5.color(0x000000) : am5.color(0xffffff);
  const backgroundColor = themeIsLight ? am5.color(0xffffff) : am5.color(0x0b1f15);
  const strokeColor = am5.color(parseInt(meta.stroke.slice(1), 16));

  sensorChart = sensorRoot.container.children.push(am5xy.XYChart.new(sensorRoot, {
    panX: true,
    panY: false,
    wheelX: 'panX',
    wheelY: 'zoomX',
    pinchZoomX: true,
    layout: sensorRoot.verticalLayout,
    maxTooltipDistance: 0,
  }));

  const xRenderer = am5xy.AxisRendererX.new(sensorRoot, {
    minGridDistance: 40,
    strokeOpacity: 0.12,
  });
  xRenderer.labels.template.setAll({
    fill: textColor,
    fontSize: 11,
    fontFamily: 'JetBrains Mono',
    paddingTop: 8,
  });
  xRenderer.grid.template.setAll({ stroke: gridColor, strokeOpacity: themeIsLight ? 0.05 : 0.08 });

  const yRenderer = am5xy.AxisRendererY.new(sensorRoot, {
    strokeOpacity: 0.12,
  });
  yRenderer.labels.template.setAll({
    fill: textColor,
    fontSize: 11,
    fontFamily: 'JetBrains Mono',
  });
  yRenderer.grid.template.setAll({ stroke: gridColor, strokeOpacity: themeIsLight ? 0.04 : 0.08 });

  const xAxis = sensorChart.xAxes.push(am5xy.DateAxis.new(sensorRoot, {
    baseInterval: { timeUnit: 'day', count: 1 },
    renderer: xRenderer,
    tooltipDateFormat: 'dd MMM yyyy',
    markUnitChange: false,
    extraMin: 0.02,
    extraMax: 0.05,
  }));

  sensorYAxis = sensorChart.yAxes.push(am5xy.ValueAxis.new(sensorRoot, {
    renderer: yRenderer,
    min: 0,
    extraMax: 0.15,
  }));

  xAxis.set('tooltip', am5.Tooltip.new(sensorRoot, {
    labelText: '{valueX.formatDate("dd MMM yyyy")}',
    getFillFromSprite: false,
    autoTextColor: false,
    background: am5.RoundedRectangle.new(sensorRoot, {
      fill: backgroundColor,
      fillOpacity: 0.96,
      stroke: strokeColor,
      strokeWidth: 1,
      cornerRadiusTL: 10,
      cornerRadiusTR: 10,
      cornerRadiusBL: 10,
      cornerRadiusBR: 10,
    }),
  }));

  sensorYAxis.set('tooltip', am5.Tooltip.new(sensorRoot, {
    labelText: '{valueY.formatNumber("#,###.##")}'+meta.unit,
    getFillFromSprite: false,
    autoTextColor: false,
    background: am5.RoundedRectangle.new(sensorRoot, {
      fill: backgroundColor,
      fillOpacity: 0.96,
      stroke: strokeColor,
      strokeWidth: 1,
      cornerRadiusTL: 10,
      cornerRadiusTR: 10,
      cornerRadiusBL: 10,
      cornerRadiusBR: 10,
    }),
  }));

  sensorSeries = sensorChart.series.push(am5xy.SmoothedXLineSeries.new(sensorRoot, {
    name: meta.label,
    xAxis,
    yAxis: sensorYAxis,
    valueXField: 'date',
    valueYField: 'value',
    tension: 1 - chartSmoothness,
    connect: true,
    stroke: strokeColor,
    fill: strokeColor,
    fillOpacity: 0.08,
    tooltip: am5.Tooltip.new(sensorRoot, {
      labelText: '{name}\n{valueX.formatDate("dd MMM yyyy")}\n{valueY.formatNumber("#,###.##")}'+meta.unit,
      getFillFromSprite: false,
      autoTextColor: false,
      background: am5.RoundedRectangle.new(sensorRoot, {
        fill: backgroundColor,
        fillOpacity: 0.96,
        stroke: strokeColor,
        strokeWidth: 1,
        cornerRadiusTL: 10,
        cornerRadiusTR: 10,
        cornerRadiusBL: 10,
        cornerRadiusBR: 10,
      }),
    }),
  }));

  sensorSeries.strokes.template.setAll({
    stroke: strokeColor,
    strokeWidth: 3,
  });
  sensorSeries.fills.template.setAll({
    visible: true,
    fill: strokeColor,
    fillOpacity: 0.08,
  });
  sensorSeries.bullets.push(() => am5.Bullet.new(sensorRoot, {
    sprite: am5.Circle.new(sensorRoot, {
      radius: 4,
      fill: backgroundColor,
      stroke: strokeColor,
      strokeWidth: 2,
    }),
  }));

  sensorChart.set('cursor', am5xy.XYCursor.new(sensorRoot, {
    behavior: 'none',
    xAxis,
    yAxis: sensorYAxis,
  }));

  const scrollbarX = am5.Scrollbar.new(sensorRoot, { orientation: 'horizontal' });
  sensorChart.set('scrollbarX', scrollbarX);
  sensorChart.topAxesContainer.children.push(scrollbarX);

  xAxis.data.setAll(chartData);
  sensorSeries.data.setAll(chartData);

  sensorSeries.events.once('datavalidated', () => {
    showChartLoading(false);
  });

  sensorChart.appear(800, 100);
  sensorSeries.appear(1000);
}

async function showChart(type) {
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.className = btn.className.replace(/active-\w+/, '').trim();
  });
  const btn = document.querySelector(`[data-chart="${type}"]`);
  if (btn) btn.classList.add(CHART_COLORS[type]?.cls);

  sensorChartType = type;
  updateStatsBar(type);
  updateCurveSmoothness(document.getElementById('curveSmoothness')?.value ?? chartSmoothness);
  await createChart(type);
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

    // 2. Update Bar Kesehatan di Sidebar
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
  const c = document.createElement('div');
  c.id = 'toastContainer';
  c.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
  document.body.appendChild(c);
  return c;
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
  const toggleInput = document.getElementById('dn');
  if (!toggleInput) return;

  const apply = (th) => {
    if (th === 'light') { 
      document.documentElement.setAttribute('data-theme', 'light'); 
      toggleInput.checked = false; // Sun mode (checked = false in this toggle pattern typically, let's reverse if needed: checked is Moon)
    } else { 
      document.documentElement.removeAttribute('data-theme');
      toggleInput.checked = true; // Moon mode
    }
  };
  
  apply(localStorage.getItem('agro-theme') || 'dark');
  
  toggleInput.addEventListener('change', (e) => {
    // If checked = true -> dark mode (moon), else -> light mode (sun)
    const next = e.target.checked ? 'dark' : 'light';
    localStorage.setItem('agro-theme', next); 
    apply(next);
    
    const activeTab = document.querySelector('.chart-tab[class*="active-"]');
    if (activeTab?.dataset?.chart) showChart(activeTab.dataset.chart);
  });
}

function renderSparkBars() {
  document.querySelectorAll('.spark-bars').forEach(container => {
    try {
      const vals = JSON.parse(container.dataset.vals || '[]');
      if (!vals.length) return;

      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const range = max - min || 1;

      container.innerHTML = vals.map(v => {
        const pct = Math.max(15, ((v - min) / range) * 100);
        return `<div class="spark-bar" style="height:${pct}%"></div>`;
      }).join('');
    } catch(e) {
      container.innerHTML = '';
    }
  });
}

// ── Inisialisasi ─────────────────────────────────────────
function initDashboard() {
  const activeTab = document.querySelector('.chart-tab[class*="active-"]');
  const type = activeTab ? activeTab.dataset.chart : 'suhu';
  updateCurveSmoothness(document.getElementById('curveSmoothness')?.value || chartSmoothness);
  if (document.getElementById('chartSensor') && window.chartData) showChart(type);

  renderSparkBars();

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
  disposeChart();
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