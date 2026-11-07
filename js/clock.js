/**
 * clock.js
 * Analog clock (Canvas), digital clock, Gregorian + Hijri dates.
 * The static parts of the dial are rendered once to an off-screen canvas;
 * only the hands are redrawn each animation frame.
 */

const Clock = (() => {
  let rafId = null;
  let canvas = null, ctx = null;
  let face = null;            // off-screen canvas with the static dial
  let faceKey = '';
  let lastSecond = -1;

  const GREG_DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const GREG_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const GREG_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const HIJRI_MONTHS = [
    'Muharram', 'Safar', 'Rabi al-awwal', 'Rabi al-thani', 'Jumada al-awwal', 'Jumada al-thani',
    'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah',
  ];

  // ── Hijri date ─────────────────────────────────────────────────────────
  // Uses the browser's civil Islamic calendar; the admin can shift it by
  // ±N days to follow the local moon sighting (Sri Lanka often differs).
  function getHijriDate(gDate, offsetDays = 0) {
    const d = new Date(gDate.getFullYear(), gDate.getMonth(), gDate.getDate() + (offsetDays || 0), 12);
    try {
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-civil-nu-latn', {
        day: 'numeric', month: 'numeric', year: 'numeric',
      }).formatToParts(d);
      const get = (t) => parseInt((parts.find(p => p.type === t) || {}).value, 10);
      const day = get('day'), month = get('month'), year = get('year');
      if (day && month && year) return { day, month, year };
    } catch (e) { /* fall through to the arithmetic version */ }
    return arithmeticHijri(d);
  }

  function arithmeticHijri(d) {
    // Tabular Islamic calendar (civil epoch)
    const jd = Math.floor(367 * d.getFullYear() - Math.floor(7 * (d.getFullYear() + Math.floor((d.getMonth() + 10) / 12)) / 4)
      + Math.floor(275 * (d.getMonth() + 1) / 9) + d.getDate() + 1721013.5 + 0.5);
    const l = jd - 1948440 + 10632;
    const n = Math.floor((l - 1) / 10631);
    const l2 = l - 10631 * n + 354;
    const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
    const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const month = Math.floor((24 * l3) / 709);
    return { day: l3 - Math.floor((709 * month) / 24), month, year: 30 * n + j - 30 };
  }

  function hijriString(date, offset) {
    const h = getHijriDate(date, offset);
    return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}H`;
  }

  // ── Time formatting ────────────────────────────────────────────────────
  function formatTime(date, fmt) {
    const h = date.getHours(), m = date.getMinutes(), s = date.getSeconds();
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    if (fmt === '12h') return `${h % 12 || 12}:${mm}:${ss} ${h >= 12 ? 'PM' : 'AM'}`;
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }

  // ── Colours (read from the active palette) ─────────────────────────────
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function palette() {
    return {
      ring:  cssVar('--clock-ring',  '#0b5bb8'),
      glow:  cssVar('--clock-glow',  '#2b96ff'),
      f1:    cssVar('--clock-face-1', '#0b66cf'),
      f2:    cssVar('--clock-face-2', '#04285a'),
      hand:  cssVar('--clock-hand',  '#ffffff'),
      num:   cssVar('--clock-num',   '#ffffff'),
    };
  }

  // ── Static dial ────────────────────────────────────────────────────────
  function buildFace(S, pal, brand) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const cx = S / 2, cy = S / 2;
    const R = S / 2 - 14;          // outer radius of the ring
    const Rin = R * 0.885;         // face radius

    // outer glow + ring body
    g.save();
    g.shadowColor = pal.glow; g.shadowBlur = 26;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
    const rg = g.createRadialGradient(cx, cy, Rin, cx, cy, R);
    rg.addColorStop(0, shade(pal.ring, -18)); rg.addColorStop(1, shade(pal.ring, 12));
    g.fillStyle = rg; g.fill();
    g.restore();

    // geometric pattern around the ring (8-point stars + links)
    const mid = (R + Rin) / 2, size = (R - Rin) * 0.30;
    g.save();
    g.lineWidth = 2.2; g.strokeStyle = 'rgba(255,255,255,.34)';
    const N = 32;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = cx + Math.cos(a) * mid, y = cy + Math.sin(a) * mid;
      g.save(); g.translate(x, y); g.rotate(a);
      g.strokeRect(-size, -size, size * 2, size * 2);
      g.rotate(Math.PI / 4);
      g.strokeRect(-size, -size, size * 2, size * 2);
      g.restore();
      // small link diamond between stars
      const a2 = ((i + 0.5) / N) * Math.PI * 2;
      const x2 = cx + Math.cos(a2) * mid, y2 = cy + Math.sin(a2) * mid;
      g.save(); g.translate(x2, y2); g.rotate(a2 + Math.PI / 4);
      g.strokeRect(-size * .38, -size * .38, size * .76, size * .76);
      g.restore();
    }
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.4)';
    g.beginPath(); g.arc(cx, cy, R - 4, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(cx, cy, Rin + 5, 0, Math.PI * 2); g.stroke();
    g.restore();

    // face
    const fg = g.createRadialGradient(cx - Rin * .15, cy - Rin * .2, Rin * .1, cx, cy, Rin);
    fg.addColorStop(0, pal.f1); fg.addColorStop(1, pal.f2);
    g.beginPath(); g.arc(cx, cy, Rin, 0, Math.PI * 2);
    g.fillStyle = fg; g.fill();
    g.save();
    g.beginPath(); g.arc(cx, cy, Rin, 0, Math.PI * 2); g.clip();
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 40;
    g.lineWidth = 30; g.strokeStyle = 'rgba(0,0,0,.25)';
    g.beginPath(); g.arc(cx, cy, Rin + 12, 0, Math.PI * 2); g.stroke();
    g.restore();

    // ticks
    g.lineCap = 'butt';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const quarter = i % 15 === 0, hour = i % 5 === 0;
      const len = quarter ? 84 : hour ? 58 : 34;
      const r1 = Rin - 20, r2 = r1 - len;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      g.strokeStyle = hour ? pal.num : 'rgba(255,255,255,.65)';
      g.lineWidth = quarter ? 8 : hour ? 7 : 3.2;
      g.stroke();
    }

    // numbers
    g.fillStyle = pal.num;
    g.font = `600 ${Math.round(R * 0.145)}px 'Open Sans','Segoe UI','DejaVu Sans',Arial,sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const nr = Rin - 138;
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillText(String(n), cx + Math.cos(a) * nr, cy + Math.sin(a) * nr + 3);
    }

    // brand
    g.save();
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.font = `700 ${Math.round(R * 0.095)}px 'Oswald','Arial Narrow','DejaVu Sans Condensed',sans-serif`;
    g.fillText(brand.title, cx, cy + R * 0.30);
    g.font = `600 ${Math.round(R * 0.05)}px 'Open Sans','DejaVu Sans',Arial,sans-serif`;
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillText(brand.sub, cx, cy + R * 0.38);
    g.restore();

    return c;
  }

  function shade(hex, pct) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
    const r = f((n >> 16) & 255), gg = f((n >> 8) & 255), b = f(n & 255);
    return `rgb(${r},${gg},${b})`;
  }

  // ── Hands ──────────────────────────────────────────────────────────────
  function taper(g, cx, cy, ang, len, wBase, wTip, color, tail) {
    g.save();
    g.translate(cx, cy); g.rotate(ang);
    g.beginPath();
    g.moveTo(-tail, -wBase / 2);
    g.lineTo(len - wTip, -wTip / 2);
    g.quadraticCurveTo(len + wTip * .5, 0, len - wTip, wTip / 2);
    g.lineTo(-tail, wBase / 2);
    g.closePath();
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
    g.fillStyle = color; g.fill();
    g.restore();
  }

  function drawHands(g, S, now, pal) {
    const cx = S / 2, cy = S / 2;
    const R = S / 2 - 14, Rin = R * 0.885;
    const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds(), ms = now.getMilliseconds();
    const top = -Math.PI / 2;

    taper(g, cx, cy, ((h + m / 60) / 12) * Math.PI * 2 + top, Rin * 0.52, 30, 14, pal.hand, 28);
    taper(g, cx, cy, ((m + s / 60) / 60) * Math.PI * 2 + top, Rin * 0.82, 20, 9, pal.hand, 28);

    // second hand (red) with tail + counterweight
    const sa = ((s + ms / 1000) / 60) * Math.PI * 2 + top;
    g.save();
    g.translate(cx, cy); g.rotate(sa);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 12; g.shadowOffsetY = 5;
    g.strokeStyle = '#e5242b'; g.lineCap = 'round'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(-70, 0); g.lineTo(Rin * 0.88, 0); g.stroke();
    g.restore();

    // boss
    g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.fillStyle = '#0a0a0c'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#e5242b'; g.stroke();
  }

  // ── Main update ────────────────────────────────────────────────────────
  function draw(now) {
    if (!canvas || !ctx) return;
    if (!canvas.offsetParent) return;
    const S = canvas.width;
    const pal = palette();
    const s = Storage.getSettings();
    const brand = brandText(s);
    const key = [S, pal.ring, pal.glow, pal.f1, pal.f2, pal.num, brand.title, brand.sub].join('|');
    if (key !== faceKey) { face = buildFace(S, pal, brand); faceKey = key; }
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(face, 0, 0);
    drawHands(ctx, S, now, pal);
  }

  function brandText(s) {
    return { title: 'MASJID', sub: s.clockBrandSub || 'DISPLAY' };
  }

  function updateTexts(now, s) {
    // Digital clock
    const digEl = document.getElementById('digitalClock');
    if (digEl) {
      const h = now.getHours(), mm = String(now.getMinutes()).padStart(2, '0');
      if (s.timeFormat === '12h') digEl.innerHTML = `${h % 12 || 12}:${mm}<small>${h >= 12 ? 'PM' : 'AM'}</small>`;
      else digEl.textContent = `${String(h).padStart(2, '0')}:${mm}`;
    }

    const dayName = GREG_DAYS[now.getDay()];
    const shortDate = `${GREG_SHORT[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const hijri = hijriString(now, s.hijriOffset);

    const gEl = document.getElementById('gregorianDate');
    if (gEl) gEl.innerHTML = `<b>${dayName}</b> ${shortDate}`;
    const hEl = document.getElementById('hijriDate');
    if (hEl) hEl.textContent = hijri;

    const dd = document.getElementById('digitalDate');
    if (dd) dd.innerHTML = `${dayName}, ${shortDate}<br>${hijri}`;
  }

  function update() {
    const now = new Date();
    const s = Storage.getSettings();
    if (s.analogClockEnabled !== false) draw(now);
    if (now.getSeconds() !== lastSecond) {
      lastSecond = now.getSeconds();
      updateTexts(now, s);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────
  function start() {
    if (rafId) cancelAnimationFrame(rafId);
    canvas = document.getElementById('analogClock');
    if (canvas) ctx = canvas.getContext('2d');
    // ~30fps is plenty for a smooth second hand and kind to TV browsers
    let last = 0;
    (function tick(t) {
      if (t - last > 30) { last = t; update(); }
      rafId = requestAnimationFrame(tick);
    })(0);
  }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } }
  function refresh() { faceKey = ''; lastSecond = -1; }

  return {
    start, stop, refresh,
    formatTime, getHijriDate, hijriString,
    GREG_DAYS, GREG_MONTHS, GREG_SHORT, HIJRI_MONTHS,
  };
})();
