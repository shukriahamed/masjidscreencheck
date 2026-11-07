/**
 * app.js - Main application entry point
 * Coordinates: Clock, PrayerTimes, Countdown, Athan, Slideshow, Ticker, Jummah, Offline
 */

const App = (() => {
  let settings = {};
  let prayers  = [];
  let updateInterval      = null;
  let prayerCheckInterval = null;
  let jummahDismissed = false;
  let renderedFriday = undefined;     // was the sidebar built as a Friday (Jummah) list?
  let renderedCurId = undefined;     // which sidebar row is highlighted right now

  // ================================================================
  // ADMIN BUTTON AUTO-HIDE
  // ================================================================
  function initAdminBtnBehavior() {
    const btn = document.getElementById('adminBtn');
    if (!btn) return;
    let hideTimer = null;

    function showBtn() {
      btn.classList.add('visible');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => btn.classList.remove('visible'), 8000);
    }

    // Show on mouse move near bottom-left (within 150px from left, 200px from bottom)
    document.addEventListener('mousemove', (e) => {
      if (e.clientX < 220 && e.clientY > window.innerHeight - 220) showBtn();
    });
    // Show on any touch near bottom area (Smart TV remote might send touch events)
    document.addEventListener('touchstart', showBtn, { passive: true });
    // Also briefly show on page load so user knows it exists
    showBtn();
  }
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        window.location.href = 'admin.html';
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (Jummah.isActive()) { Jummah.hideJummahScreen(); Jummah.setManual(false); jummahDismissed = true; }
        else { Jummah.setManual(true); Jummah.renderJummahScreen(); }
      }
      // Preview the screens: T = full sequence, 1 = Time to Athan, 2 = Athan,
      // 3 = Towards Iqamah, 4 = Iqamah
      // 5 = picture shown after Iqamah, 6 = the same with the Jummah picture
      if (e.ctrlKey && e.shiftKey && (e.key === 'T' || ['1','2','3','4','5','6','!','@','#','$','%','^'].includes(e.key))) {
        e.preventDefault();
        const map = { T: 'all', 1: 'pre', '!': 'pre', 2: 'athan', '@': 'athan', 3: 'iqamah', '#': 'iqamah', 4: 'now', '$': 'now', 5: 'shaf', '%': 'shaf', 6: 'shaf', '^': 'shaf' };
        Countdown.startDemo(map[e.key], prayers, { jummah: ['6', '^'].includes(e.key) });
      }
      if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
      }
      // Escape: dismiss overlays
      if (e.key === 'Escape') {
        Jummah.hideJummahScreen(); Jummah.setManual(false); jummahDismissed = true;
        Countdown.returnToNormal();
        Athan.hideAll();
      }
    });
  }

  // ================================================================
  // THEME / CSS VARIABLES
  // ================================================================
  function applyTheme(s) {
    const root = document.documentElement;
    root.setAttribute('data-theme', s.theme || 'islamic-blue');
    root.setAttribute('data-layout', s.layout || 'signature');

    // Sizes from the admin sliders become unit-less scale factors on the
    // default design, so they work in every layout.
    const k = (val, def) => (val && def ? Math.max(0.4, Math.min(2.5, val / def)) : 1);
    root.style.setProperty('--kSb',     k(s.sidebarWidth, 678));
    root.style.setProperty('--kHdr',    k(s.headerHeight, 171));
    root.style.setProperty('--kTick',   k(s.tickerHeight, 86));
    root.style.setProperty('--kPrayer', k(s.prayerFontSize, 80));
    root.style.setProperty('--kName',   k(s.mosqueNameFontSize, 62));
    root.style.setProperty('--kDate',   k(s.dateFontSize, 38));
    root.style.setProperty('--kTickFs', k(s.tickerFontSize, 42));
    root.style.setProperty('--kClock', k(s.clockDiameter, 540));

    // "Custom" palette: admin colour pickers override the preset
    const custom = ['--sb-1','--sb-2','--hdr-bg','--hdr-bg-solid','--accent','--name-gold','--ticker-bg','--ticker-text','--clock-ring','--clock-face-1'];
    if (s.theme === 'custom') {
      const set = (n, v) => v && root.style.setProperty(n, v);
      set('--sb-1', s.colorSidebarBg);  set('--sb-2', s.colorSidebarBg);
      set('--hdr-bg', s.colorHeaderBg); set('--hdr-bg-solid', s.colorHeaderBg);
      set('--accent', s.colorActivePrayer);
      set('--name-gold', s.colorSecondary);
      set('--ticker-bg', s.colorTickerBg); set('--ticker-text', s.colorTickerText);
      set('--clock-ring', s.colorClockBg); set('--clock-face-1', s.colorClockBg);
    } else {
      custom.forEach(n => root.style.removeProperty(n));
    }
    // Text colour that stays readable on the highlighted (active-prayer) row
    const acc = getComputedStyle(root).getPropertyValue('--accent').trim();
    root.style.setProperty('--accent-ink', inkFor(acc));
    Clock.refresh();
  }

  /** Dark ink on light colours, white ink on dark ones */
  function inkFor(color) {
    let r = 255, g = 212, b = 0;
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
    const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(color);
    if (hex) {
      let h = hex[1]; if (h.length === 3) h = h.split('').map(c => c + c).join('');
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    } else if (rgb) { r = +rgb[1]; g = +rgb[2]; b = +rgb[3]; }
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b2150' : '#ffffff';
  }

  /** Scale the 1920x1080 canvas to whatever screen we are on */
  function fitStage() {
    const sc = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.getElementById('stage').style.setProperty('--scale', sc);
  }

  // ================================================================
  // HEADER
  // ================================================================
  async function renderHeader(s) {
    const name = (s.mosqueName || 'Masjidur Rahman').trim();
    const nameEl = document.getElementById('mosqueName');
    if (nameEl) {
      const i = name.indexOf(' ');
      const first = i < 0 ? name : name.slice(0, i), rest = i < 0 ? '' : name.slice(i + 1);
      nameEl.innerHTML = `<span class="n1">${esc(first)}</span>${rest ? ' <span class="n2">' + esc(rest) + '</span>' : ''}`;
    }
    const addr = [s.mosqueAddress, s.mosquePhone ? 'Tel. ' + s.mosquePhone : ''].filter(Boolean).join(' ');
    setText('mosqueAddress', addr);

    const logoEl = document.getElementById('mosqueLogo');
    if (logoEl) {
      let url = null;
      if (s.mosqueLogoId) url = await Storage.getImageURL(s.mosqueLogoId);
      logoEl.src = url || 'assets/images/default-logo.svg';
    }
    fitName();
  }

  /** Shrink the mosque name until it fits next to the logo and icon */
  function fitName() {
    const el = document.getElementById('mosqueName');
    const block = el && el.parentElement;
    if (!el || !block) return;
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    const maxW = Math.max(300, block.parentElement.clientWidth - (parseFloat(getComputedStyle(block.parentElement).paddingLeft) || 0) - (document.documentElement.getAttribute('data-layout') === 'signature' ? 250 : 340));
    let guard = 40;
    while (el.scrollWidth > maxW && size > 20 && guard--) { size -= 2; el.style.fontSize = size + 'px'; }
  }

  // ================================================================
  // PRAYER SIDEBAR
  // ================================================================
  const SVG = (inner) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const rays = (cx, cy, r1, r2, angs) => angs.map(a => {
    const t = a * Math.PI / 180;
    return `<path d="M${(cx + Math.cos(t) * r1).toFixed(1)} ${(cy - Math.sin(t) * r1).toFixed(1)}L${(cx + Math.cos(t) * r2).toFixed(1)} ${(cy - Math.sin(t) * r2).toFixed(1)}"/>`;
  }).join('');
  const PRAYER_ICONS = {
    fajr:    SVG(`<path d="M8 42h48M22 50h20"/><path d="M20 42a12 12 0 0 1 24 0"/>${rays(32, 42, 17, 23, [90, 50, 130, 15, 165])}`),
    sunrise: SVG(`<circle cx="32" cy="26" r="9"/>${rays(32, 26, 14, 19, [0, 45, 90, 135, 180])}<path d="M10 46h44"/><path d="M32 60V50M27 54l5-5 5 5"/>`),
    dhuhr:   SVG(`<circle cx="32" cy="32" r="11"/>${rays(32, 32, 17, 24, [0, 45, 90, 135, 180, 225, 270, 315])}`),
    asr:     SVG(`<circle cx="38" cy="25" r="9"/>${rays(38, 25, 14, 19, [0, 45, 90, 135, 180, 315])}<path d="M6 38h26a5 5 0 1 0-5-5M6 47h34a5 5 0 1 1-5 5M6 56h18"/>`),
    maghrib: SVG(`<path d="M8 40h48"/><path d="M20 40a12 12 0 0 1 24 0"/>${rays(32, 40, 17, 23, [90, 50, 130, 15, 165])}<path d="M32 46v13M27 54l5 5 5-5"/>`),
    isha:    `<svg viewBox="0 0 64 64"><path fill="currentColor" d="M40 8a24 24 0 1 0 16 41A19 19 0 0 1 40 8z"/></svg>`,
  };

  /** Merge today's times (auto mode) and work out Iqamah for every prayer */
  async function buildPrayers(s) {
    let list = (s.prayers || []).map(p => ({ ...p }));
    if (s.prayerMode === 'auto') {
      const today = await PrayerTimes.getTodayTimes();
      list = list.map(p => {
        const athan = (today && today[p.id]) || p.athan;
        let iqamah = p.iqamah;
        if (p.id !== 'sunrise' && athan && p.iqamahOffset != null) {
          const [h, m] = athan.split(':').map(Number);
          const t = h * 60 + m + Number(p.iqamahOffset || 0);
          iqamah = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        }
        return { ...p, athan, iqamah };
      });
    }
    // Fridays: Luhar becomes Jummah, with its own (custom) Athan and Iqamah times
    if (s.jummahEnabled !== false && Jummah.isFriday()) {
      list = list.map(p => !(p.id === 'dhuhr' || /^(luhar|zuhr|dhuhr|duhr|luhr)$/i.test((p.name || '').trim())) ? p : {
        id: 'dhuhr',
        ...p,
        name: s.jummahName || 'Jummah',
        arabicName: 'الجمعة',
        athan: s.jummahTime || p.athan,
        iqamah: s.jummahIqamah || p.iqamah,
        isJummah: true,
      });
    }
    return list;
  }

  /** Which row to highlight: the prayer whose time has most recently begun */
  function currentPrayerId(list, now) {
    // While a prayer's screens are up, that prayer is the active one
    const live = Countdown.getPrayerId && Countdown.getPrayerId();
    if (live && list.some(p => p.enabled && p.id === live)) return live;
    if (Jummah.isActive() && list.some(p => p.enabled && p.id === 'dhuhr' && p.isJummah)) return 'dhuhr';
    const nowM = now.getHours() * 60 + now.getMinutes();
    const act = list.filter(p => p.enabled && PrayerTimes.parseTime(p.athan) !== null);
    if (!act.length) return null;
    let cur = null;
    for (const p of act) if (PrayerTimes.parseTime(p.athan) <= nowM) cur = p;
    if (!cur) cur = act[act.length - 1];                   // before Fajr: still Isha
    if (cur.id === 'sunrise') {                            // Sunrise is only "current" for its short range
      const end = PrayerTimes.parseTime(cur.athan) + (Number(settings.sunriseRangeMinutes) || 15);
      if (nowM >= end) return null;
    }
    return cur.id;
  }

  async function renderPrayerSidebar() {
    const container = document.getElementById('prayerList');
    if (!container) return;

    settings = Storage.getSettings();
    const now = new Date();
    prayers = await buildPrayers(settings);
    const curId = currentPrayerId(prayers, now);
    renderedCurId = curId;
    renderedFriday = Jummah.isFriday() && settings.jummahEnabled !== false;

    const html = [];
    for (const p of prayers) {
      if (!p.enabled) continue;
      const a = splitTime(p.athan, settings.timeFormat);
      let sub = '', iqc = '';
      if (p.id === 'sunrise') {
        const [h, m] = (p.athan || '00:00').split(':').map(Number);
        const t = h * 60 + m + (Number(settings.sunriseRangeMinutes) || 15);
        const end = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        sub = `${formatPT(p.athan, settings.timeFormat)} - ${formatPT(end, settings.timeFormat)}`;
      } else if (p.iqamah) {
        sub = `IQAMAH ${formatPT(p.iqamah, settings.timeFormat)}`;
        iqc = `<small>IQAMAH</small>${splitTime(p.iqamah, settings.timeFormat).t}`;
      }
      html.push(`
        <div class="prayer-item${p.id === curId ? ' current' : ''}" data-id="${esc(p.id)}">
          <div class="p-icon">${PRAYER_ICONS[p.id] || PRAYER_ICONS.dhuhr}</div>
          <div class="p-main">
            <div class="p-name">${esc(p.name)}</div>
            <div class="p-time"><span>${a.t}</span>${a.ap ? `<span class="ampm">${a.ap}</span>` : ''}</div>
            ${sub ? `<div class="p-iqamah">${esc(sub)}</div>` : ''}
          </div>
          ${iqc ? `<div class="p-iqc">${iqc}</div>` : ''}
        </div>`);
    }
    container.innerHTML = html.join('');
  }

  /** "15:19" -> { t: "3:19", ap: "PM" }  (24h: { t: "15:19", ap: "" }) */
  function splitTime(str, fmt) {
    if (!str || str === '--:--') return { t: '--:--', ap: '' };
    const [h, m] = str.split(':').map(Number);
    const mm = String(m).padStart(2, '0');
    if (fmt === '24h') return { t: `${String(h).padStart(2, '0')}:${mm}`, ap: '' };
    return { t: `${h % 12 || 12}:${mm}`, ap: h >= 12 ? 'PM' : 'AM' };
  }

  function formatPT(timeStr, fmt) {
    const x = splitTime(timeStr, fmt);
    return x.ap ? `${x.t} ${x.ap}` : x.t;
  }

  // ================================================================
  // BACKGROUND
  // ================================================================
  async function applyBackground(s) {
    const bgEl      = document.getElementById('mainBackground');
    const overlayEl = document.getElementById('bgOverlay');
    if (!bgEl) return;

    const opacity = s.backgroundOpacity != null ? s.backgroundOpacity : 1;
    const blur    = s.backgroundBlur    != null ? s.backgroundBlur    : 0;
    const overlay = s.backgroundOverlay != null ? s.backgroundOverlay : 0;
    const size    = s.backgroundSize    || 'cover';

    if (s.backgroundId) {
      const url = await Storage.getImageURL(s.backgroundId);
      if (url) {
        bgEl.style.backgroundImage    = `url('${url}')`;
        bgEl.style.backgroundSize     = size;
        bgEl.style.backgroundPosition = 'center';
        bgEl.style.backgroundRepeat   = 'no-repeat';
        bgEl.style.opacity            = opacity;
        bgEl.style.filter             = blur > 0 ? `blur(${blur}px)` : '';
        if (overlayEl) overlayEl.style.background = `rgba(0,0,0,${overlay})`;
        return;
      }
    }
    // No uploaded photo: the built-in mosque scene from the stylesheet
    bgEl.style.backgroundImage = '';
    bgEl.style.background = '';
    bgEl.style.opacity = '1';
    bgEl.style.filter = '';
    if (overlayEl) overlayEl.style.background = `rgba(0,0,0,${overlay || 0})`;
  }

  // ================================================================
  // SOFTWARE CREDIT
  // ================================================================
  function renderCredit(s) {
    const el = document.getElementById('softwareCredit');
    if (!el) return;
    el.textContent = 'Powered by SoftSoLab - Shukri Muheeth';
    el.style.display = s.creditVisible !== false ? '' : 'none';
    el.style.fontSize = (s.creditFontSize || 14) + 'px';
    const pos = s.creditPosition || 'bottom-center';
    el.className = 'software-credit credit-' + pos;
    document.documentElement.setAttribute('data-credit', s.creditVisible !== false && pos === 'bottom-center' ? 'footer' : 'none');
  }

  // ================================================================
  // COUNTDOWN STATE HANDLER (wired to Countdown module)
  // ================================================================
  function handleCountdownState(state, prayer, seconds, info = {}) {
    const S = Countdown.STATES;
    const changed = !!info.changed;

    // Hide whatever is not wanted (only touches overlays that are showing)
    if (state !== S.PRE_ATHAN)  Athan.hidePreAthan();
    if (state !== S.ATHAN)      Athan.hideAthanScreen();
    if (state !== S.IQAMAH_COUNTDOWN && state !== S.IQAMAH) Athan.hideIqamahScreen();
    if (state !== S.SHAF)       Athan.hideShafScreen();

    // Jummah information screen steps aside while a prayer screen is up
    if (state !== S.NORMAL && Jummah.isActive()) Jummah.hideJummahScreen();

    if (state === S.PRE_ATHAN)             Athan.showPreAthan(prayer, seconds, info.total, settings, changed);
    else if (state === S.ATHAN)            Athan.showAthanScreen(prayer, settings);
    else if (state === S.IQAMAH_COUNTDOWN) Athan.showIqamahCountdown(prayer, seconds, settings, changed);
    else if (state === S.IQAMAH)           Athan.showIqamahScreen(prayer, settings);
    else if (state === S.SHAF)             Athan.showShafScreen(prayer, settings);

    if (changed && state === S.NORMAL) renderPrayerSidebar();   // highlight moves on
  }

  // ================================================================
  // NEXT PRAYER COUNTDOWN (pill + big countdown)
  // ================================================================
  function updateNextPrayerCountdown(now) {
    const pill = document.getElementById('nextPrayerCountdown');
    const bcT = document.getElementById('bcTime'), bcL = document.getElementById('bcLabel');
    if (!pill) return;

    const hide = () => { pill.style.display = 'none'; };
    if (Countdown.getState() !== Countdown.STATES.NORMAL) return hide();

    const list = prayers.filter(p => p.enabled && PrayerTimes.parseTime(p.athan) !== null);
    if (!list.length) return hide();
    const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let next = null, diff = 0;
    for (const p of list) {
      const t = PrayerTimes.parseTime(p.athan) * 60;
      if (t > nowSecs) { next = p; diff = t - nowSecs; break; }
    }
    if (!next) { next = list[0]; diff = PrayerTimes.parseTime(next.athan) * 60 + 86400 - nowSecs; }

    const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), sec = diff % 60;
    const txt = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    setText('pillName', next.name);
    setText('pillTime', '-' + txt);
    if (bcT) bcT.textContent = txt;
    if (bcL) bcL.textContent = next.name + ' in';
    pill.style.display = settings.nextPrayerPill === false ? 'none' : 'flex';
  }

  // ================================================================
  // JUMMAH WINDOW (Fridays) — shown/hidden automatically
  // ================================================================
  function syncJummah() {
    if (Countdown.getState() !== Countdown.STATES.NORMAL) return;
    const want = Jummah.shouldShowJummah();
    if (want && !Jummah.isActive() && !jummahDismissed) Jummah.renderJummahScreen();
    else if (!want && Jummah.isActive() && !Jummah.isManual()) Jummah.hideJummahScreen();
  }

  // ================================================================
  // MAIN TICK LOOP (every second)
  // ================================================================
  function startUpdateLoop() {
    clearInterval(updateInterval);
    updateInterval = setInterval(() => {
      const now = new Date();
      // Check if any prayer is due NOW
      Countdown.checkPrayerTriggers(prayers, now);
      if (prayers.length && (currentPrayerId(prayers, now) !== renderedCurId ||
          (Jummah.isFriday() && settings.jummahEnabled !== false) !== renderedFriday)) renderPrayerSidebar();
      updateNextPrayerCountdown(now);
      syncJummah();
      if (Jummah.isActive()) Jummah.updateJummahCountdown();
    }, 1000);

    // Refresh sidebar every 60 s (prayer statuses change)
    clearInterval(prayerCheckInterval);
    prayerCheckInterval = setInterval(renderPrayerSidebar, 60000);
  }

  // ================================================================
  // FULL INIT
  // ================================================================
  async function init() {
    // Open IndexedDB
    await Storage.openDB();
    await Storage.syncFromServer();     // latest settings/images from the server (no-op offline / local)
    settings = Storage.getSettings();

    // Fit the canvas to the screen, then apply theme before anything renders
    fitStage();
    window.addEventListener('resize', () => { fitStage(); fitName(); });
    applyTheme(settings);

    // Render header
    await renderHeader(settings);

    // Apply wallpaper
    await applyBackground(settings);

    // Build prayer sidebar
    await renderPrayerSidebar();

    // Credit
    renderCredit(settings);

    // If auto mode and cache missing, compute for today
    if (settings.prayerMode === 'auto') {
      const cached = await Storage.getPrayerTimesForDate(PrayerTimes.todayStr());
      if (!cached) await PrayerTimes.fetchAndCache(settings);
    }

    // Wire countdown → screens
    Countdown.setStateChangeCallback(handleCountdownState);

    // Recover any in-progress prayer state (page loaded mid-athan/iqamah)
    Countdown.recoverStateOnStartup(prayers);

    // Start clock (rAF)
    Clock.start();

    // Pick up changes made in the admin page (any device): check the server every minute
    setInterval(async () => { if (await Storage.syncFromServer()) location.reload(); }, 60000);

    // Start ticker
    Ticker.init();

    // Load slides and start slideshow
    await Slideshow.loadData();
    Slideshow.start();

    // Jummah window is checked every second in the tick loop
    prayersReady();

    // Register service worker + wake lock
    Offline.init();
    Offline.requestWakeLock();

    // Start second-by-second loop
    startUpdateLoop();

    // Keyboard shortcuts
    initKeyboardShortcuts();

    // Admin button auto-hide
    initAdminBtnBehavior();

    // ?demo=pre|athan|iqamah|now|all  [&freeze=1] [&prayer=asr]  — preview a screen
    const q = new URLSearchParams(location.search);
    if (q.get('demo')) Countdown.startDemo(q.get('demo'), prayers, { freeze: q.has('freeze'), prayerId: q.get('prayer') || undefined, jummah: q.has('jummah') });

    // Listen for settings changes from admin tab (storage event)
    window.addEventListener('storage', async (e) => {
      if (e.key === 'masjidSettings') {
        settings = Storage.getSettings();
        applyTheme(settings);
        await renderHeader(settings);
        await applyBackground(settings);
        await renderPrayerSidebar();
        renderCredit(settings);
        Ticker.refresh();
        Clock.refresh();
        Slideshow.refresh();
      }
    });

    // Auto-enter fullscreen if running as a PWA / kiosk
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    console.log('[App] Masjid Display System v2.0 — SoftSoLab / Shukri Muheeth');
  }

  // Public refresh API (called by admin on same tab if ever needed)
  async function refresh() {
    settings = Storage.getSettings();
    applyTheme(settings);
    await renderHeader(settings);
    await applyBackground(settings);
    await renderPrayerSidebar();
    renderCredit(settings);
    Ticker.refresh();
    Clock.refresh();
    Slideshow.refresh();
  }

  // ---- Helpers ----
  function prayersReady() { updateNextPrayerCountdown(new Date()); }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { init, refresh, getPrayers: () => prayers };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
  App.init().catch(err => {
    console.error('[App] Critical init error:', err);
  });
});
