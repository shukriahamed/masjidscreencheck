/**
 * special.js
 * "Special screens" for special occasions (Eid, Taraweeh, Laylatul Qadr, a lecture, a funeral notice …).
 * Each one is a full-screen message shown on chosen date(s) between a from-time and an until-time.
 * Managed in Admin → Special Screens. Preview on the display with  index.html?special  (first enabled one).
 */
const Special = (() => {
  let activeId = null;
  let renderedKey = '';
  const forced = /[?&]special\b/.test(location.search);

  const p2 = n => String(n).padStart(2, '0');
  const toMin = t => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return isNaN(h) ? null : h * 60 + m; };
  const dayKey = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (t, st) => {
    const m = toMin(t); if (m === null) return '';
    const h = Math.floor(m / 60), mi = p2(m % 60);
    return st.timeFormat === '24h' ? `${p2(h)}:${mi}` : `${h % 12 || 12}:${mi} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  function isDue(it, now) {
    if (it.enabled === false) return false;
    const today = dayKey(now);
    const from = it.dateFrom || '', to = it.dateTo || it.dateFrom || '';
    if (from && today < from) return false;      // ISO dates compare as strings
    if (to && today > to) return false;
    const nowM = now.getHours() * 60 + now.getMinutes();
    const a = toMin(it.timeFrom), b = toMin(it.timeTo);
    if (a !== null && nowM < a) return false;
    if (b !== null && nowM >= b) return false;
    return true;
  }

  function findActive(now) {
    const list = (Storage.getSettings().specialScreens || []);
    if (forced) return list.find(x => x.enabled !== false) || list[0] || null;
    return list.find(x => isDue(x, now)) || null;
  }

  async function render(it) {
    const overlay = document.getElementById('specialOverlay');
    if (!overlay) return;
    const st = Storage.getSettings();
    let bg = '';
    if (it.bgId) { const u = await Storage.getImageURL(it.bgId); if (u) bg = u; }
    let logo = '<div class="sp-logo sp-logo-ph">🕌</div>';
    if (st.mosqueLogoId) { const u = await Storage.getImageURL(st.mosqueLogoId); if (u) logo = `<img class="sp-logo" src="${u}" alt="">`; }
    overlay.style.backgroundImage = bg ? `url('${bg}')` : '';
    const lines = String(it.message || '').split(/\n+/).filter(Boolean).map(l => `<div class="sp-line">${esc(l)}</div>`).join('');
    const times = (it.timeFrom || it.timeTo)
      ? `<div class="sp-time">${esc(fmt(it.timeFrom, st))}${it.timeFrom && it.timeTo ? ' &nbsp;–&nbsp; ' : ''}${esc(fmt(it.timeTo, st))}</div>` : '';
    overlay.innerHTML = `
      <div class="sp-shade"></div>
      <div class="sp-content">
        <div class="sp-head">${logo}<div class="sp-mosque">${esc(st.mosqueName || '')}</div></div>
        <div class="sp-divider"><span></span><i></i><span></span></div>
        <div class="sp-title">${esc(it.title || 'Special Announcement')}</div>
        ${lines}
        ${times}
        <div class="sp-foot">❋ ✦ ❋ ✦ ❋ ✦ ❋</div>
      </div>`;
    overlay.classList.add('active');
  }

  function hide() {
    const o = document.getElementById('specialOverlay');
    if (o) { o.classList.remove('active'); o.style.backgroundImage = ''; }
    activeId = null; renderedKey = '';
  }

  /** Called every second. Only shows while the normal screen is up (Athan / Iqamah screens take priority). */
  function sync(normalState) {
    if (!normalState) { if (activeId) hide(); return; }
    const it = findActive(new Date());
    if (!it) { if (activeId) hide(); return; }
    const key = JSON.stringify(it);
    if (activeId !== it.id || key !== renderedKey) { activeId = it.id; renderedKey = key; render(it); }
  }

  return { sync, hide, isActive: () => !!activeId };
})();
