/**
 * globe.js
 * Animated globe for the "Time to Athan" screen (layout 2): Earth seen from
 * space, a glowing line from Masjid al-Haram (Makkah) to this mosque and the
 * distance between them.
 *
 * Everything is drawn with the Canvas API from the small hand-made coastline
 * table below, so it works fully offline (no images or map files).
 * The earth is rendered once; only the line, markers and labels animate.
 */

const Globe = (() => {
  const MAKKAH = { lat: 21.4225, lng: 39.8262 };
  const D2R = Math.PI / 180;

  // ── Coarse coastlines  [lon,lat, lon,lat, …] ─────────────────────────────
  const LAND = {
    africa: [-5.9,35.8, -1.9,35.2, 2.5,36.8, 8,37, 10.2,37.2, 11,35.5, 10.2,33.8, 11.2,33.2, 15.2,32.3, 19,30.3, 20,32, 22,32.9, 25,31.8, 29,30.9, 32.3,31.3, 32.6,30, 33.5,27.5, 35.5,24, 37.3,20.5, 38.8,17.8, 41,14.8, 43.2,12.5, 44.8,10.4, 48,11.2, 51.2,11.8, 50.8,9.5, 49,6.5, 47.5,4.5, 45.5,2, 43.2,-0.5, 41.5,-2.5, 39.6,-4.7, 39.2,-6.8, 38.8,-8.3, 40.5,-11, 40.7,-15, 37.5,-17.8, 35,-20, 35.5,-24, 32.9,-26, 31,-29.5, 28.5,-32.8, 25.5,-34, 20,-34.8, 18.4,-34.2, 18.1,-31.5, 16.5,-28.6, 15.2,-26.5, 14.5,-22.5, 12.5,-18, 11.8,-15.5, 13.7,-11.5, 13,-9.2, 12.2,-6, 12,-5, 9.5,-0.5, 9.8,3.8, 8.5,4.3, 6,4.3, 4,6.3, 1,6, -2,4.8, -4.5,5.2, -7.5,4.4, -10.5,6.2, -13.2,8.4, -15.5,11, -16.8,13.5, -17.4,14.7, -16.5,19, -16,21, -14.8,24, -13.2,27.5, -10.5,29.2, -9.8,31, -8.5,33.6, -6.8,34.5],
    madagascar: [49.3,-12, 50.5,-15.5, 49.3,-18, 47.6,-24.5, 45.2,-25.5, 43.7,-23.5, 44.3,-20, 44,-17, 46.3,-15.7, 48.5,-13.5],
    eurasia: [-5.6,36, -1,37.5, 0.2,38.8, 0,40, 3.2,41.8, 4.5,43.3, 6.5,43.1, 8.8,44.4, 10.2,43.9, 12.3,41.9, 15.5,40, 16.1,38, 17.1,39.1, 18.5,40.1, 16.9,41.1, 14.2,42.5, 12.4,44.2, 12.3,45.4, 13.7,45.6, 15,44.2, 17.5,42.8, 19.4,41.9, 19.5,40.3, 21,39, 21.5,36.8, 23,38.2, 24,40.6, 26,40.8, 26.5,40.2, 26.2,39.5, 27,38.4, 28,36.8, 30.5,36.3, 32.5,36.1, 34.5,36.8, 36,36.6, 35.8,34.6, 35.1,33, 34.3,31.3, 34.2,29.5, 34.2,27.8, 35,28, 36.5,26, 38.5,24, 39.5,21.5, 41,19, 42.7,16.5, 43.3,13, 45,12.8, 48.5,14, 52,15.8, 55,17.2, 57.7,19, 59,22.5, 57,24, 56.4,26.2, 54.5,24.5, 52.5,24.1, 51.5,24.6, 51.2,26.1, 50.1,26.4, 50.2,28, 48.5,29.9, 50,30, 51.5,27.9, 54,26.6, 56.3,27.1, 57.2,25.6, 61.5,25.2, 66.7,25.4, 67,24.8, 68.2,23.7, 68.9,22.3, 70.1,20.8, 72.8,21, 72.8,19, 73.3,16, 74.6,13, 76.4,9.9, 77.5,8.1, 78.5,8.8, 79.9,10.3, 80.2,13, 80.2,15.6, 82.3,16.7, 84.8,19.5, 86.9,21.3, 88.8,21.7, 90.5,22.3, 92,21.3, 93.5,19.5, 94.5,16.5, 97.5,16.5, 98.5,13, 98.3,9.5, 98.5,8, 100.3,5.3, 101.3,3, 103.4,1.4, 104.2,1.6, 103.4,4.2, 102.3,6.3, 100.9,7, 100.3,9, 99.2,10.5, 100,12.5, 101,12.7, 102.5,11.5, 103.2,10.5, 104.8,8.7, 106.5,9.7, 107.5,10.5, 109.3,12.7, 109.4,15, 108.5,16, 107.8,18.5, 106.5,20, 108,21.5, 110.5,21.2, 111,21.5, 113.5,22.2, 116.5,23, 119,25, 120.7,27.9, 121.9,30, 121.5,31.5, 120.8,33, 119.2,34.5, 120.5,36.2, 122.5,37, 119.5,37.2, 118,38.5, 119,39.5, 121.5,40.9, 121.2,39, 122.2,40, 124.5,39.8, 125.5,37.7, 126.5,37.7, 126.5,34.6, 129.3,35.2, 129.4,37, 128.3,38.6, 127.5,39.8, 129.7,41, 130.5,42.5, 132,43, 133,42.8, 135.5,43.7, 138.5,47, 140.5,49.5, 141.5,52.5, 143,59, 150,59.5, 157,61, 163,62, 170,60, 180,65, 180,69, 170,69.8, 160,69.5, 150,71.5, 140,72.5, 129,72.2, 128,73.2, 113,73.7, 110,76.5, 105,77.5, 100,76.8, 95,76, 87,75, 80,73.5, 73,72.8, 69,73.5, 66,70.5, 60,69.5, 54,68.5, 44,68.5, 41,66.5, 40,67, 34,69.5, 30,70, 25,71, 20,70, 15,68, 14,66, 12,64, 10,63.5, 6,62, 5,60.5, 5.5,58.8, 8,58, 8,57.5, 10.5,57.7, 10.5,56, 9.5,54.8, 8.6,54, 8.3,53.5, 7,53.5, 5,53, 4.5,52, 3.5,51.3, 2,51, 1.6,50.8, 0.5,49.5, -1.5,49.7, -1.5,48.7, -3,48.8, -4.7,48.4, -4.5,47.8, -2.5,47.3, -1.2,46, -1.2,44.7, -1.8,43.4, -4,43.5, -8,43.7, -9.3,43, -8.8,41.5, -8.9,38.7, -9.5,38.7, -8.8,37, -7.4,37.2, -6.2,36.8],
    srilanka: [79.9,9.7, 80.9,9.3, 81.8,7.5, 81.5,6.3, 80.5,5.9, 79.8,6.5, 79.8,8.3],
    britain: [-5.7,50, -3,50.6, 1.4,51.1, 1.7,52.8, 0,53.7, -1.5,55.5, -2,56.5, -1.8,57.5, -3.5,58.6, -5,58.6, -6.2,57, -5.5,55.5, -4.8,54.7, -3,54.8, -3,53.4, -4.5,53.3, -4.2,52, -5.2,51.7, -3.1,51.4, -4.5,50.4],
    ireland: [-10,51.8, -6,52.2, -6,54, -5.5,54.6, -8,55.2, -10,54],
    sumatra: [95.3,5.6, 98,4, 100.5,2, 103.5,-1, 106,-3.2, 105.8,-5.8, 104.5,-5.9, 102,-4, 100.5,-2, 98.5,0.5, 96,3],
    borneo: [109,1.5, 111,2, 113,3.2, 116,6.5, 118,5.5, 117.5,2.5, 118.2,0.8, 117,-1, 116.3,-3.8, 114.5,-4, 112,-3.3, 110,-2.9, 109,-1, 108.9,0.5],
    java: [105.3,-6.8, 108,-6.3, 111,-6.5, 114.5,-7.8, 114.2,-8.7, 110,-8.2, 106.5,-7.4],
    australia: [114,-22, 114.5,-26, 115,-34, 118,-35, 124,-33.8, 129,-31.6, 131.2,-31.5, 134,-32.7, 138,-35, 139.5,-36, 141,-38, 146,-39, 150,-37.5, 151.5,-33, 153,-30, 153,-25, 150,-22, 146.5,-19, 145.4,-14.5, 143.5,-11, 142,-10.7, 141.5,-13, 140.5,-17.5, 137,-15.5, 136.5,-12, 132.5,-11.5, 130,-12.5, 127,-14, 125,-15, 123,-17, 122,-18, 118,-20],
  };
  const WATER = {
    blackSea: [28,41.2, 29,41.2, 31,41.2, 35,42, 38,41, 41.5,41.5, 41.5,42.5, 38,44.5, 37,45, 35,45.2, 33.5,46, 31.5,46.5, 30.7,46.6, 29.7,45.3, 28.7,44, 28,42.5],
    caspian: [47,44.8, 49,46.5, 51.5,47, 53,45.5, 51,44.5, 50.3,42, 52.5,41.5, 53,39.5, 54,37.5, 51,36.7, 49,37.7, 49,39.5, 49.5,40.5, 50,40.5, 47.8,42, 47,43.5],
    baltic: [10.5,54, 12,54.2, 14,54, 18,54.7, 20,54.8, 21,57, 23,57.5, 24,59.5, 29,60, 23,60, 21.5,61, 21,63, 25.5,65, 24,65.8, 22,65.8, 19,63.5, 17.5,61, 17,59, 18.5,59.5, 16.5,57, 16,56, 14,55.5, 12.5,56, 11,57.5, 10,57.7, 11,56.5],
  };
  const DESERT = [
    [-16,24, -10,30, -2,32, 10,33, 20,31, 33,28, 35,22, 33,16, 24,13, 15,13.5, 5,15, -5,16, -16,17],            // Sahara
    [35.5,28.5, 40,31, 47,29.5, 50,26, 52,24, 56,24.5, 59,22, 55,17.5, 52,16, 48,15, 43.5,13.5, 42,17, 39,21, 36,26], // Arabia
    [50,36, 54,37.5, 60,36.5, 62,31, 63,26, 58,25.8, 54,27, 50,30],                                          // Iran
    [68,29, 73,30, 74,27, 71,24.5, 69,25],                                                                   // Thar
    [41,9, 51,11, 48,5, 42,3],                                                                               // Horn
    [14,-17, 20,-20, 24,-26, 18,-30, 14,-26],                                                                // Namib / Kalahari
  ];

  // ── State ───────────────────────────────────────────────────────────────
  let raf = null, canvas = null, ctx = null, base = null;
  let startTs = 0, info = null;

  function haversine(a, b) {
    const dLat = (b.lat - a.lat) * D2R, dLng = (b.lng - a.lng) * D2R;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  // Orthographic projection centred on (lon0, lat0)
  function makeProjector(lon0, lat0, R, cx, cy) {
    const sφ0 = Math.sin(lat0 * D2R), cφ0 = Math.cos(lat0 * D2R);
    return function (lon, lat, lift = 1) {
      const λ = (lon - lon0) * D2R, φ = lat * D2R;
      const cosc = sφ0 * Math.sin(φ) + cφ0 * Math.cos(φ) * Math.cos(λ);
      let x = Math.cos(φ) * Math.sin(λ);
      let y = cφ0 * Math.sin(φ) - sφ0 * Math.cos(φ) * Math.cos(λ);
      if (cosc < 0) {                              // far side: slide to the limb
        const d = Math.hypot(x, y) || 1;
        x /= d; y /= d;
      }
      return { x: cx + x * R * lift, y: cy - y * R * lift, vis: cosc >= 0 };
    };
  }

  function tracePoly(g, flat, proj) {
    g.beginPath();
    let first = true;
    for (let i = 0; i < flat.length; i += 2) {
      const lon = flat[i], lat = flat[i + 1];
      const nx = flat[(i + 2) % flat.length], ny = flat[(i + 3) % flat.length];
      // subdivide so long edges follow the curve of the globe
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - lon, ny - lat) / 1.5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const p = proj(lon + (nx - lon) * t, lat + (ny - lat) * t);
        if (first) { g.moveTo(p.x, p.y); first = false; } else g.lineTo(p.x, p.y);
      }
    }
    g.closePath();
  }

  // ── Build the static earth + starfield once ─────────────────────────────
  function buildBase(W, H, view) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    // space + stars
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 520; i++) {
      const a = 0.25 + rnd() * 0.75, r = rnd() < 0.08 ? 1.8 : 0.9;
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath(); g.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2); g.fill();
    }

    const { cx, cy, R } = view;
    const proj = makeProjector(view.lon0, view.lat0, R, cx, cy);

    // atmosphere glow
    const atm = g.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.09);
    atm.addColorStop(0, 'rgba(120,190,255,.55)');
    atm.addColorStop(0.35, 'rgba(70,140,235,.22)');
    atm.addColorStop(1, 'rgba(30,80,200,0)');
    g.fillStyle = atm; g.beginPath(); g.arc(cx, cy, R * 1.09, 0, Math.PI * 2); g.fill();

    // ocean
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    const oc = g.createRadialGradient(cx - R * .25, cy - R * .3, R * .1, cx, cy, R);
    oc.addColorStop(0, '#2a78a8'); oc.addColorStop(0.6, '#17577f'); oc.addColorStop(1, '#0a2f52');
    g.fillStyle = oc; g.fillRect(cx - R, cy - R, R * 2, R * 2);

    // land (own layer so deserts can be blended on top of it)
    const land = document.createElement('canvas'); land.width = W; land.height = H;
    const lg = land.getContext('2d');
    lg.fillStyle = '#5b8450';
    for (const k in LAND) { tracePoly(lg, LAND[k], proj); lg.fill(); }
    lg.globalCompositeOperation = 'source-atop';
    lg.filter = 'blur(9px)';
    lg.fillStyle = 'rgba(205,176,112,.95)';
    for (const d of DESERT) { tracePoly(lg, d, proj); lg.fill(); }
    lg.filter = 'none';
    // jungle / forest tint
    lg.fillStyle = 'rgba(30,90,45,.45)'; lg.filter = 'blur(14px)';
    for (const d of [[12,6, 30,6, 30,-6, 14,-8], [95,22, 110,22, 108,12, 98,12], [102,-2, 118,-1, 116,-4, 104,-5]]) { tracePoly(lg, d, proj); lg.fill(); }
    lg.filter = 'none';
    // coast highlight
    lg.globalCompositeOperation = 'source-over';
    lg.strokeStyle = 'rgba(210,235,210,.35)'; lg.lineWidth = 1.6;
    for (const k in LAND) { tracePoly(lg, LAND[k], proj); lg.stroke(); }
    g.drawImage(land, 0, 0);

    // inland water on top of land
    g.fillStyle = '#17577f';
    for (const k in WATER) { tracePoly(g, WATER[k], proj); g.fill(); }

    // sphere shading: lit from upper-left, dark limb
    const sh = g.createRadialGradient(cx - R * .35, cy - R * .4, R * .15, cx, cy, R * 1.02);
    sh.addColorStop(0, 'rgba(255,255,255,.18)');
    sh.addColorStop(0.45, 'rgba(0,0,0,0)');
    sh.addColorStop(0.85, 'rgba(0,10,40,.38)');
    sh.addColorStop(1, 'rgba(0,5,25,.78)');
    g.fillStyle = sh; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();

    // thin limb light
    g.strokeStyle = 'rgba(150,205,255,.55)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();

    return c;
  }

  // ── Great-circle path between two points ───────────────────────────────
  function greatCircle(a, b, n) {
    const toV = (p) => [Math.cos(p.lat * D2R) * Math.cos(p.lng * D2R), Math.cos(p.lat * D2R) * Math.sin(p.lng * D2R), Math.sin(p.lat * D2R)];
    const va = toV(a), vb = toV(b);
    const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    const om = Math.acos(dot), so = Math.sin(om) || 1e-6;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, A = Math.sin((1 - t) * om) / so, B = Math.sin(t * om) / so;
      const x = A * va[0] + B * vb[0], y = A * va[1] + B * vb[1], z = A * va[2] + B * vb[2];
      pts.push({ lat: Math.atan2(z, Math.hypot(x, y)) / D2R, lng: Math.atan2(y, x) / D2R, t });
    }
    return pts;
  }

  // ── Labels ──────────────────────────────────────────────────────────────
  function label(g, text, x, y, fill, opts = {}) {
    g.save();
    g.font = `600 ${opts.size || 21}px 'Open Sans','DejaVu Sans',Arial,sans-serif`;
    const padX = 14, h = (opts.size || 21) + 16;
    const w = g.measureText(text).width + padX * 2 + (opts.icon ? 30 : 0);
    const bx = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
    g.fillStyle = fill; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect ? g.roundRect(bx, y - h / 2, w, h, 5) : g.rect(bx, y - h / 2, w, h);
    g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    let tx = bx + padX;
    if (opts.icon) {          // little aeroplane glyph
      g.save(); g.translate(bx + padX + 10, y); g.rotate(-0.35);
      g.beginPath(); g.moveTo(11, 0); g.lineTo(-8, -9); g.lineTo(-4, 0); g.lineTo(-8, 9); g.closePath(); g.fill();
      g.restore(); tx += 30;
    }
    g.fillText(text, tx, y + 1);
    g.restore();
  }

  // ── Frame ───────────────────────────────────────────────────────────────
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!ctx || !base || !info) return;
    const t = (ts - startTs) / 1000;
    const W = canvas.width, H = canvas.height;
    ctx.drawImage(base, 0, 0);

    const { proj, path, a, b, dist, name } = info;
    const prog = Math.min(1, t / 2.6), e = 1 - Math.pow(1 - prog, 3);
    const upto = Math.max(2, Math.floor(path.length * e));

    // glowing line
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < upto; i++) {
      const p = path[i], q = proj(p.lng, p.lat, 1 + 0.06 * Math.sin(Math.PI * p.t));
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.shadowColor = '#7fe3ff'; ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(190,240,255,.95)'; ctx.lineWidth = 3.2; ctx.stroke();
    ctx.restore();

    const pa = proj(a.lng, a.lat), pb = proj(b.lng, b.lat);
    const pulse = (Math.sin(t * 3) + 1) / 2;

    // Makkah marker
    marker(ctx, pa.x, pa.y, '#ff9a1f', pulse);
    // this mosque
    if (prog > 0.9) marker(ctx, pb.x, pb.y, '#ff3b30', 1 - pulse);

    // mid-point distance label
    const midP = path[Math.floor(path.length / 2)];
    const mp = proj(midP.lng, midP.lat, 1.06);
    if (prog > 0.5) {
      ctx.save();
      ctx.strokeStyle = '#7fe3ff'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(8,20,50,.9)';
      ctx.beginPath(); ctx.arc(mp.x, mp.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      label(ctx, `${Math.round(dist).toLocaleString('en-US')} km`, mp.x + 6, mp.y - 40, 'rgba(14,40,110,.92)', { icon: true });
    }

    label(ctx, 'Masjid al-Haram, Makkah', pa.x - 16, pa.y - 38, 'rgba(10,95,50,.92)', { align: 'right' });
    if (prog > 0.9) label(ctx, name, pb.x + 18, pb.y + 8, 'rgba(180,30,30,.92)');
  }

  function marker(g, x, y, color, pulse) {
    g.save();
    g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 18;
    g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = color; g.globalAlpha = 0.65 * (1 - pulse); g.lineWidth = 3;
    g.beginPath(); g.arc(x, y, 14 + pulse * 22, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  // ── Public API ──────────────────────────────────────────────────────────
  function start(cv, settings) {
    stop();
    canvas = cv;
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    const b = { lat: Number(settings.latitude) || 8.9833, lng: Number(settings.longitude) || 79.9 };
    const a = MAKKAH;
    // keep the two points comfortably inside the visible disc
    const lon0 = (a.lng + b.lng) / 2 - 6;
    const lat0 = Math.max(0, Math.min(35, (a.lat + b.lat) / 2 + 4));
    const view = { cx: W * 0.60, cy: H * 0.52, R: Math.min(H * 0.47, W * 0.30), lon0, lat0 };

    base = buildBase(W, H, view);
    const proj = makeProjector(lon0, lat0, view.R, view.cx, view.cy);
    info = {
      proj, a, b,
      path: greatCircle(a, b, 90),
      dist: haversine(a, b),
      name: settings.mosqueName || 'This Masjid',
    };
    startTs = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  return { start, stop, haversine, MAKKAH };
})();
