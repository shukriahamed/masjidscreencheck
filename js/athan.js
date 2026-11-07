/**
 * athan.js - Athan Audio & Special Screen Controller
 * Manages audio playback for athan calls and the full-screen athan display.
 */

const Athan = (() => {
  let audioEl = null;
  let isPlaying = false;

  /**
   * Load and play the athan audio stored in IndexedDB (if available)
   */
  async function playAthanAudio() {
    const settings = Storage.getSettings();
    if (!settings.athanAudioId) return;

    try {
      const blob = await Storage.getImage(settings.athanAudioId);
      if (!blob) return;

      stopAudio(); // Stop any existing audio

      const url = URL.createObjectURL(blob);
      audioEl = new Audio(url);
      audioEl.volume = 1.0;
      audioEl.onended = () => {
        isPlaying = false;
        URL.revokeObjectURL(url);
      };
      audioEl.onerror = (e) => {
        console.warn('[Athan] Audio playback error:', e);
        isPlaying = false;
      };

      // Browsers may block autoplay — catch the promise
      const playPromise = audioEl.play();
      if (playPromise) {
        playPromise
          .then(() => { isPlaying = true; })
          .catch(err => {
            console.warn('[Athan] Autoplay blocked. User interaction may be required:', err.message);
          });
      }
    } catch (err) {
      console.warn('[Athan] Failed to load audio:', err);
    }
  }

  function stopAudio() {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      audioEl = null;
      isPlaying = false;
    }
  }

  function isAudioPlaying() {
    return isPlaying;
  }

  // ──────────────────────────────────────────────────────────────────
  // Screen rendering
  // ──────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const p = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }

  function _formatTime(timeStr, format) {
    if (!timeStr || timeStr === '--:--') return '--:--';
    const [h, m] = timeStr.split(':').map(Number);
    if (format === '24h') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  // 1) TIME TO ATHAN ----------------------------------------------------
  let preBuiltFor = null;
  function showPreAthan(prayer, left, total, settings, changed) {
    const ov = $('preAthanOverlay');
    if (!ov) return;
    const style = settings.athanScreenStyle === 'globe' ? 'globe' : 'progress';
    const key = style + ':' + prayer.id;
    const pct = total > 0 ? Math.min(100, Math.max(0, ((total - left) / total) * 100)) : 0;

    if (changed || preBuiltFor !== key || !ov.firstChild) {
      preBuiltFor = key;
      ov.classList.toggle('globe-style', style === 'globe');
      const name = esc((prayer.name || '').toUpperCase());
      if (style === 'globe') {
        ov.innerHTML = `
          <canvas id="globeCanvas" width="1876" height="1036"></canvas>
          <div class="pg-text">
            <div class="pg-sub">TIME TO ATHAN</div>
            <div class="pg-name gold-text">${name}</div>
            <div class="pg-count" id="paCount">${mmss(left)}</div>
          </div>
          <div class="pg-progress"><i id="paFill" style="width:${pct}%"></i></div>`;
        if (typeof Globe !== 'undefined') Globe.start($('globeCanvas'), settings);
      } else {
        if (typeof Globe !== 'undefined') Globe.stop();
        ov.innerHTML = `
          <div class="pa-wrap">
            <div class="pa-title">Time to Athan</div>
            <div class="pa-name gold-text">${name}</div>
            <div class="pa-bar"><div class="pa-fill" id="paFill" style="width:${pct}%"></div>
              <div class="pa-count" id="paCount">${mmss(left)}</div></div>
          </div>`;
      }
    }
    const c = $('paCount'), f = $('paFill');
    if (c) c.textContent = mmss(left);
    if (f) f.style.width = pct + '%';
    ov.classList.add('active');
  }

  function hidePreAthan() {
    const ov = $('preAthanOverlay');
    if (!ov || !ov.classList.contains('active')) return;
    ov.classList.remove('active');
    preBuiltFor = null;
    setTimeout(() => { if (!ov.classList.contains('active')) { if (typeof Globe !== 'undefined') Globe.stop(); ov.innerHTML = ''; } }, 800);
  }

  // 2) ATHAN ------------------------------------------------------------
  async function showAthanScreen(prayer, settings) {
    const overlay = $('athanOverlay');
    if (!overlay) return;
    if (overlay.classList.contains('active') && overlay.dataset.pid === prayer.id) return;
    overlay.dataset.pid = prayer.id;

    overlay.style.backgroundImage = '';
    let hasBg = false;
    if (settings.athanBgId) {
      const url = await Storage.getImageURL(settings.athanBgId);
      if (url) { overlay.style.backgroundImage = `url('${url}')`; hasBg = true; }
    }
    overlay.innerHTML = `
      ${hasBg ? '<div class="athan-bg-dark"></div>' : ''}
      <div class="athan-content animate-in">
        <div class="athan-star-row">✦ ✦ ✦</div>
        <div class="athan-arabic gold-text">الله أكبر</div>
        <div class="athan-title">ATHAN</div>
        <div class="athan-prayer-name gold-text">${esc((prayer.name || '').toUpperCase())}</div>
        ${prayer.arabicName ? `<div class="athan-prayer-name-ar">${esc(prayer.arabicName)}</div>` : ''}
        <div class="athan-time-wrap">
          <span class="athan-time-label">Athan</span>
          <span class="athan-time">${_formatTime(prayer.athan, settings.timeFormat)}</span>
        </div>
        <div class="athan-divider"><span class="athan-divider-line"></span><span class="athan-divider-diamond">◆</span><span class="athan-divider-line"></span></div>
        <div class="athan-message">${esc(settings.athanMessage || 'Come to Prayer!')}</div>
        <div class="athan-mosque-name">${esc(settings.mosqueName || '')}</div>
      </div>`;
    overlay.classList.add('active');
    playAthanAudio();
  }

  function hideAthanScreen() {
    const overlay = $('athanOverlay');
    if (overlay && overlay.classList.contains('active')) {
      overlay.classList.remove('active');
      delete overlay.dataset.pid;
    }
    stopAudio();
  }

  // 3) TOWARDS IQAMAH ---------------------------------------------------
  let iqBuiltFor = null;
  function showIqamahCountdown(prayer, left, settings, changed) {
    const ov = $('iqamahOverlay');
    if (!ov) return;
    const key = 'cd:' + prayer.id;
    if (changed || iqBuiltFor !== key) {
      iqBuiltFor = key;
      const msgs = (settings.iqamahMessages || []).filter(m => m && m.trim());
      const unit = (msgs.length ? msgs : ['Please be silent']).map(m => `<span>${esc(m)}</span>`).join('<span>◆</span>');
      ov.innerHTML = `
        <div class="iq-wrap">
          <div class="iq-prayer">${esc(prayer.name || '')}${prayer.iqamah ? ' · ' + _formatTime(prayer.iqamah, settings.timeFormat) : ''}</div>
          <div class="iq-title">Towards Iqamah</div>
          <div class="iq-timer" id="iqTimer">${mmss(left)}</div>
          <div class="iq-pill"><div class="iq-marquee" id="iqMarquee">${unit}</div></div>
        </div>`;
      // repeat the text until one half is wider than the pill, then double for a seamless loop
      const mq = $('iqMarquee');
      requestAnimationFrame(() => {
        if (!mq) return;
        const one = mq.innerHTML;
        let reps = 1;
        mq.innerHTML = one;
        while (mq.scrollWidth < 1200 && reps < 12) { reps++; mq.innerHTML = one.repeat(reps); }
        const half = mq.scrollWidth;
        mq.innerHTML = mq.innerHTML + mq.innerHTML;
        mq.style.setProperty('--iq-dur', Math.max(8, half / 140) + 's');
      });
    }
    const t = $('iqTimer');
    if (t) { t.textContent = mmss(left); t.classList.toggle('urgent', left <= 10); }
    ov.classList.add('active');
  }

  // 4) IQAMAH (prayer starting) ----------------------------------------
  function showIqamahScreen(prayer, settings) {
    const ov = $('iqamahOverlay');
    if (!ov) return;
    const key = 'now:' + prayer.id;
    if (iqBuiltFor !== key) {
      iqBuiltFor = key;
      ov.innerHTML = `
        <div class="iq-wrap">
          <div class="iq-now-ar">الإقامة</div>
          <div class="iq-now-title">IQAMAH</div>
          <div class="iq-now-prayer">${esc(prayer.name || '')}</div>
          <div class="iq-now-sub">Straighten the rows — the prayer is about to begin</div>
        </div>`;
    }
    ov.classList.add('active');
  }

  function hideIqamahScreen() {
    const ov = $('iqamahOverlay');
    if (ov && ov.classList.contains('active')) ov.classList.remove('active');
    iqBuiltFor = null;
  }

  // 5) PICTURE (Jummah picture after Jummah Athan / straighten the rows after Iqamah) ---------------------------------------------
  // "Straighten the rows" after Iqamah; the custom Jummah picture right after the
  // Jummah Athan (falls back to the straighten-the-rows picture when none is uploaded).
  let shafBuiltFor = null;
  async function showShafScreen(prayer, settings) {
    const ov = $('shafOverlay');
    if (!ov) return;
    const key = (prayer.jummahPic ? 'j:' : 'p:') + prayer.id;
    if (shafBuiltFor !== key) {
      shafBuiltFor = key;
      let url = null;
      if (prayer.jummahPic && settings.jummahImageId) url = await Storage.getImageURL(settings.jummahImageId);
      if (!url && settings.shafImageId)               url = await Storage.getImageURL(settings.shafImageId);
      if (!url) url = 'assets/images/straighten-shaf.png';
      if (shafBuiltFor !== key) return;              // state moved on while loading
      ov.innerHTML = `
        <div class="shaf-bg" style="background-image:url('${url}')"></div>
        <img class="shaf-img" src="${url}" alt="">`;
    }
    ov.classList.add('active');
  }

  function hideShafScreen() {
    const ov = $('shafOverlay');
    if (ov && ov.classList.contains('active')) ov.classList.remove('active');
    shafBuiltFor = null;
  }

  function hideAll() { hidePreAthan(); hideAthanScreen(); hideIqamahScreen(); hideShafScreen(); }

  return {
    playAthanAudio, stopAudio, isAudioPlaying,
    showPreAthan, hidePreAthan,
    showAthanScreen, hideAthanScreen,
    showIqamahCountdown, showIqamahScreen, hideIqamahScreen,
    showShafScreen, hideShafScreen,
    hideAll, mmss,
  };
})();
