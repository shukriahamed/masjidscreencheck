/**
 * ticker.js
 * Bottom scrolling ticker/marquee — smooth requestAnimationFrame-based animation.
 * Seamless infinite loop by duplicating the text content.
 */

const Ticker = (() => {
  let tickerEl    = null;
  let trackEl     = null;
  let innerEl     = null;
  let animId      = null;
  let position    = 0;
  let contentWidth = 0;
  let paused      = false;
  let running     = false;
  let settings    = {};

  /** Build a single concatenated string from all messages */
  function buildContent(messages, separator) {
    const clean = (messages || []).filter(m => m && m.trim());
    if (!clean.length) return 'Welcome to Masjid Display System';
    return clean.join(` ${separator} `);
  }

  /** Initialize — called once after DOM is ready */
  function init() {
    tickerEl = document.getElementById('ticker');
    trackEl  = document.getElementById('tickerTrack') || tickerEl?.querySelector('.ticker-track');
    innerEl  = document.getElementById('tickerInner');
    if (!tickerEl || !innerEl) return;
    refresh();
  }

  /** Reload settings and restart animation */
  function refresh() {
    settings = Storage.getSettings();
    if (!tickerEl || !innerEl) return;

    // --- Visibility ---
    tickerEl.style.display = (settings.tickerEnabled !== false) ? 'flex' : 'none';

    // Size / colours come from CSS variables (see App.applyTheme)
    innerEl.style.fontWeight = settings.tickerBold ? '700' : '400';

    // --- Content: duplicate for seamless loop ---
    const sep     = settings.tickerSeparator || '•';
    const content = buildContent(settings.tickerMessages, sep);
    const spacer  = '      •      '; // gap between loop repetitions
    innerEl.textContent = content + spacer + content; // two copies

    // Reset position to start just off the right edge
    stop();
    innerEl.style.transform = '';
    position = 0;

    // Allow browser to paint text first so scrollWidth is accurate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // contentWidth = width of ONE copy of the text
        contentWidth = innerEl.scrollWidth / 2;
        position = tickerEl.offsetWidth; // start just off-screen to the right

        if (settings.tickerEnabled !== false) start();
      });
    });
  }

  /** Animation loop */
  function step() {
    if (!paused && innerEl && tickerEl) {
      const pxPerFrame = (settings.tickerSpeed || 90) / 60;
      position -= pxPerFrame;

      // Once the first copy has scrolled fully off-left, jump back
      if (position <= -contentWidth) {
        position += contentWidth;
      }

      innerEl.style.transform = `translateX(${Math.round(position)}px)`;
    }
    animId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    animId  = requestAnimationFrame(step);
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    running = false;
  }

  function pause()  { paused = true;  }
  function resume() { paused = false; }
  function toggle() { paused = !paused; }

  return { init, refresh, start, stop, pause, resume, toggle };
})();
