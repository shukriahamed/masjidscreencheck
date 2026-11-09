/**
 * jummah.js
 * Friday / Jummah special display mode.
 * Auto-activates on Fridays and shows mosque Jummah information.
 */

const Jummah = (() => {
  let active            = false;
  let manual            = false;
  let countdownInterval = null;

  /** True only on Friday (day 5 in JS Date, where 0=Sunday) */
  // ?friday in the URL pretends it is Friday (for previewing on other days)
  const forceFriday = /[?&]friday\b/.test(location.search);
  function isFriday() {
    return forceFriday || new Date().getDay() === 5;
  }

  function toMin(t) {
    if (!t || t === '--:--') return null;
    const [h, m] = t.split(':').map(Number);
    return isNaN(h) ? null : h * 60 + m;
  }

  /**
   * Jummah screen shows on Fridays from `jummahLeadMinutes` before the
   * Khutbah until the Jummah Iqamah — not all day. After Iqamah the custom
   * Jummah picture takes over (see Countdown / Athan.showShafScreen).
   */
  function shouldShowJummah() {
    const s = Storage.getSettings();
    if (s.jummahEnabled === false || s.jummahAutoMode === false || !isFriday()) return false;
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    // Manual window (Admin → Jummah Mode → "Jummah screen shows from / until"); blank = automatic
    const mFrom = toMin(s.jummahScreenFrom), mTo = toMin(s.jummahScreenTo);
    const start = toMin(s.jummahKhutbahStart) ?? toMin(s.jummahTime);
    const end = toMin(s.jummahIqamah) ?? toMin(s.jummahTime);
    const lead = s.jummahLeadMinutes != null ? s.jummahLeadMinutes : 60;
    const from = mFrom !== null ? mFrom : (start === null ? null : start - lead);
    const until = mTo !== null ? mTo : end;
    if (from === null || until === null) return false;
    return nowM >= from && nowM < until;
  }

  /** Format a 24-h time string into 12-h display */
  function fmt(timeStr, settings) {
    if (!timeStr || timeStr === '--:--') return timeStr || '—';
    const [h, m] = timeStr.split(':').map(Number);
    if (settings.timeFormat === '24h') {
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
  }

  /** Build and display the full Jummah overlay */
  async function renderJummahScreen() {
    const overlay  = document.getElementById('jummahOverlay');
    if (!overlay) return;

    const settings = Storage.getSettings();

    // Mosque logo
    let logoHtml = '';
    if (settings.mosqueLogoId) {
      const url = await Storage.getImageURL(settings.mosqueLogoId);
      if (url) {
        logoHtml = `<img src="${url}" class="jummah-logo" alt="Mosque Logo">`;
      }
    }
    if (!logoHtml) {
      logoHtml = `<div class="jummah-logo" style="display:flex;align-items:center;justify-content:center;font-size:40px;background:rgba(200,151,42,0.1)">🕌</div>`;
    }

    // Jummah background
    if (settings.jummahBgId) {
      const url = await Storage.getImageURL(settings.jummahBgId);
      if (url) {
        overlay.style.backgroundImage    = `url('${url}')`;
        overlay.style.backgroundSize     = 'cover';
        overlay.style.backgroundPosition = 'center';
      }
    } else {
      overlay.style.backgroundImage = '';
    }

    // Khateeb photo
    let khateebHtml = '';
    if (settings.jummahKhateebPhotoId) {
      const url = await Storage.getImageURL(settings.jummahKhateebPhotoId);
      if (url) {
        khateebHtml = `<img src="${url}" class="jummah-speaker-photo" alt="Khateeb">`;
      }
    }

    // Current date formatted
    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    // Build the overlay HTML
    overlay.innerHTML = `
      <div class="jummah-bg-overlay"></div>
      <div class="jummah-content animate-in">

        <div class="jummah-header">
          ${logoHtml}
          <div class="jummah-mosque-info">
            <div class="jummah-greeting">الجمعة المباركة</div>
            <div class="jummah-greeting-en">${esc(settings.jummahMessage || 'JUMMAH MUBARAK')}</div>
            <div class="jummah-mosque-name">${esc(settings.mosqueName || 'Masjidur Rahman')}</div>
            <div class="jummah-mosque-address">${esc(settings.mosqueAddress || '')}</div>
          </div>
        </div>

        <div class="jummah-divider">
          <span class="jummah-line"></span>
          <span class="jummah-diamond"></span>
          <span class="jummah-line"></span>
        </div>

        <div class="jummah-details">
          <div class="jummah-date">📅 ${dateStr}</div>

          <div class="jummah-topic-box">
            <div class="jummah-label">Khutbah Topic</div>
            <div class="jummah-topic">${esc(settings.jummahTopic || 'Weekly Khutbah')}</div>
          </div>

          <div class="jummah-speaker-section">
            ${khateebHtml}
            <div class="jummah-speaker-info">
              <div class="jummah-label">Delivered by</div>
              <div class="jummah-khateeb">${esc(settings.jummahKhateeb || 'Ash-Sheikh')}</div>
            </div>
          </div>

          <div class="jummah-times">
            <div class="jummah-time-item">
              <div class="jummah-time-label">Khutbah Begins</div>
              <div class="jummah-time-value">${fmt(settings.jummahKhutbahStart, settings)}</div>
            </div>
            <div class="jummah-time-divider">◆</div>
            <div class="jummah-time-item">
              <div class="jummah-time-label">Jummah Prayer</div>
              <div class="jummah-time-value">${fmt(settings.jummahTime, settings)}</div>
            </div>
            <div class="jummah-time-divider">◆</div>
            <div class="jummah-time-item">
              <div class="jummah-time-label">Iqamah</div>
              <div class="jummah-time-value">${fmt(settings.jummahIqamah, settings)}</div>
            </div>
          </div>

          <div class="jummah-countdown" id="jummahCountdown"><!-- filled by updateJummahCountdown --></div>
        </div>

        <div class="jummah-footer">
          <div class="islamic-pattern-line">❋ ✦ ❋ ✦ ❋ ✦ ❋ ✦ ❋</div>
          ${settings.mosquePhone ? `<div class="jummah-phone">📞 ${esc(settings.mosquePhone)}</div>` : ''}
        </div>

      </div>
    `;

    overlay.classList.add('active');
    active = true;

    // Start live countdown
    updateJummahCountdown();
    clearInterval(countdownInterval);
    countdownInterval = setInterval(updateJummahCountdown, 1000);
  }

  /** Live countdown label to Jummah prayer time */
  function updateJummahCountdown() {
    const el = document.getElementById('jummahCountdown');
    if (!el) return;

    const settings = Storage.getSettings();
    const jTime    = settings.jummahTime;
    if (!jTime || jTime === '--:--') { el.textContent = ''; return; }

    const now   = new Date();
    const [jh, jm] = jTime.split(':').map(Number);
    const prayerDt = new Date(now);
    prayerDt.setHours(jh, jm, 0, 0);

    const diff = prayerDt - now;
    if (diff <= 0) { el.textContent = 'Jummah prayer time has begun'; return; }

    const h  = Math.floor(diff / 3600000);
    const m  = Math.floor((diff % 3600000) / 60000);
    const s  = Math.floor((diff % 60000) / 1000);

    if (h > 0) {
      el.textContent = `Jummah begins in ${h}h ${m}m`;
    } else if (m > 0) {
      el.textContent = `Jummah begins in ${m}m ${String(s).padStart(2,'0')}s`;
    } else {
      el.textContent = `Jummah begins in ${s}s`;
    }
  }

  /** Hide the Jummah overlay */
  function hideJummahScreen() {
    const overlay = document.getElementById('jummahOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.style.backgroundImage = '';
    }
    clearInterval(countdownInterval);
    countdownInterval = null;
    active = false;
  }

  function isActive() { return active; }
  function isManual() { return manual; }
  function setManual(v) { manual = !!v; }

  function esc(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return {
    isFriday,
    shouldShowJummah,
    renderJummahScreen,
    hideJummahScreen,
    updateJummahCountdown,
    isActive, isManual, setManual,
  };
})();
