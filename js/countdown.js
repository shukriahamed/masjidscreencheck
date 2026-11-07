/**
 * countdown.js
 * Decides which full-screen screen should be showing, purely from the clock:
 *
 *   NORMAL            main display
 *   PRE_ATHAN         "Time to Athan"   (last N minutes before Athan)
 *   ATHAN             Athan screen      (for athanDuration seconds)
 *   IQAMAH_COUNTDOWN  "Towards Iqamah"  (last N minutes before Iqamah)
 *   IQAMAH            "Iqamah"          (prayer is starting)
 *   SHAF              "Straighten the rows" picture after Iqamah
 *                     (Jummah: custom picture right after the Jummah Athan)
 *
 * Because the state is recomputed from the current time every second, it
 * survives page reloads, sleeping TVs and clock changes — there are no timers
 * to drift or get lost.
 *
 * A demo mode (used by the keyboard shortcuts and ?demo=… URLs) plays the
 * screens with fake numbers so they can be previewed any time.
 */

const Countdown = (() => {
  const STATES = {
    NORMAL: 'normal',
    PRE_ATHAN: 'pre-athan',
    ATHAN: 'athan',
    IQAMAH_COUNTDOWN: 'iqamah-countdown',
    IQAMAH: 'iqamah',
    SHAF: 'shaf',
  };

  let state = STATES.NORMAL;
  let currentId = null;
  let onStateChange = null;
  let demo = null;

  function secs(t) {
    if (!t || t === '--:--') return null;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 3600 + m * 60;
  }

  /** Work out the state for `now` from the prayer table. */
  function evaluate(prayers, now, s) {
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const preS    = Math.max(0, (s.preAthanMinutes != null ? s.preAthanMinutes : 5) * 60);
    const athanD  = Math.max(0, s.athanDuration != null ? s.athanDuration : 120);
    const leadS   = Math.max(0, (s.iqamahLeadMinutes != null ? s.iqamahLeadMinutes : 5) * 60);
    const iqShow  = Math.max(0, s.iqamahScreenSeconds != null ? s.iqamahScreenSeconds : 60);

    for (const p of prayers) {
      if (!p.enabled || p.id === 'sunrise') continue;
      const A = secs(p.athan);
      if (A === null) continue;

      if (preS > 0 && nowSec >= A - preS && nowSec < A) {
        return { state: STATES.PRE_ATHAN, prayer: p, left: A - nowSec, total: preS };
      }
      if (athanD > 0 && nowSec >= A && nowSec < A + athanD) {
        return { state: STATES.ATHAN, prayer: p, left: A + athanD - nowSec, total: athanD };
      }
      // Jummah picture: straight after the Jummah Athan screen, for N minutes
      if (p.isJummah) {
        const jMin = s.jummahImageMinutes != null ? s.jummahImageMinutes : 20;
        const jS = Math.max(0, Number(jMin) || 0) * 60;
        const jStart = A + athanD;
        if (jS > 0 && nowSec >= jStart && nowSec < jStart + jS) {
          return { state: STATES.SHAF, prayer: Object.assign({}, p, { jummahPic: true }), left: jStart + jS - nowSec, total: jS };
        }
      }
      const I = secs(p.iqamah);
      if (I !== null && I > A) {
        const start = Math.max(A + athanD, I - leadS);
        if (nowSec >= start && nowSec < I) {
          return { state: STATES.IQAMAH_COUNTDOWN, prayer: p, left: I - nowSec, total: I - start };
        }
        if (iqShow > 0 && nowSec >= I && nowSec < I + iqShow) {
          return { state: STATES.IQAMAH, prayer: p, left: I + iqShow - nowSec, total: iqShow };
        }
        // "Straighten the rows" picture once the Iqamah screen is over
        const picMin = s.shafEnabled === false ? 0 : (s.shafMinutes != null ? s.shafMinutes : 10);
        const picS = Math.max(0, Number(picMin) || 0) * 60;
        const picStart = I + iqShow;
        if (picS > 0 && nowSec >= picStart && nowSec < picStart + picS) {
          return { state: STATES.SHAF, prayer: p, left: picStart + picS - nowSec, total: picS };
        }
      }
    }
    return { state: STATES.NORMAL, prayer: null, left: 0, total: 0 };
  }

  // ── Demo mode ─────────────────────────────────────────────────────────
  function demoPrayer(prayers, id) {
    const list = (prayers || []).filter(p => p.enabled && p.id !== 'sunrise');
    return list.find(p => p.id === id) || list.find(p => p.id === 'maghrib') || list[0] ||
      { id: 'maghrib', name: 'Maghrib', arabicName: 'المغرب', athan: '17:51', iqamah: '18:01', enabled: true };
  }

  /**
   * Play the screens with fake numbers.
   * which: 'all' | 'pre' | 'athan' | 'iqamah' | 'now' | 'shaf'  (opts.jummah previews the Jummah picture shown after the Jummah Athan)
   * opts.freeze keeps the numbers still (handy for screenshots)
   */
  function startDemo(which, prayers, opts = {}) {
    let p = demoPrayer(prayers, opts.prayerId);
    if (opts.jummah) p = Object.assign({}, p, { isJummah: true, jummahPic: which === 'shaf', name: Storage.getSettings().jummahName || 'Jummah' });
    const S = STATES;
    const phase = {
      pre:    { state: S.PRE_ATHAN,        total: 2000, start: 1099, duration: 25 },   // 18:19
      athan:  { state: S.ATHAN,            total: 120,  start: 120,  duration: 12 },
      iqamah: { state: S.IQAMAH_COUNTDOWN, total: 600,  start: 210,  duration: 25 },       // 03:30
      now:    { state: S.IQAMAH,           total: 60,   start: 60,   duration: 10 },
      shaf:   { state: S.SHAF,             total: 600,  start: 600,  duration: 12 },
    };
    const phases = which === 'all'
      ? [phase.pre, phase.athan, phase.iqamah, phase.now, phase.shaf]
      : [phase[which] || phase.iqamah];
    if (opts.total && phases.length === 1) phases[0].total = opts.total;
    demo = { phases, idx: 0, elapsed: 0, prayer: p, freeze: !!opts.freeze };
    state = null;   // force a state-change callback
  }

  function stepDemo() {
    const ph = demo.phases[demo.idx];
    const left = demo.freeze ? ph.start : Math.max(0, ph.start - demo.elapsed);
    const r = { state: ph.state, prayer: demo.prayer, left, total: ph.total };
    if (!demo.freeze) {
      demo.elapsed++;
      if (demo.elapsed > ph.duration) { demo.idx++; demo.elapsed = 0; }
      if (demo.idx >= demo.phases.length) demo = null;
    }
    return r;
  }

  // ── Public ────────────────────────────────────────────────────────────
  /** Call once a second. */
  function checkPrayerTriggers(prayers, now) {
    const s = Storage.getSettings();
    const r = demo ? stepDemo() : evaluate(prayers, now || new Date(), s);
    const id = r.prayer ? r.prayer.id : null;
    const changed = r.state !== state || id !== currentId;
    state = r.state; currentId = id;
    if (onStateChange && (changed || r.state !== STATES.NORMAL)) {
      onStateChange(r.state, r.prayer, r.left, { total: r.total, changed });
    }
  }

  function returnToNormal() {
    demo = null;
    if (state !== STATES.NORMAL) {
      state = STATES.NORMAL; currentId = null;
      if (onStateChange) onStateChange(STATES.NORMAL, null, 0, { total: 0, changed: true });
    }
  }

  function getState() { return state; }
  function getPrayerId() { return currentId; }
  function isDemo()   { return !!demo; }
  function setStateChangeCallback(cb) { onStateChange = cb; }
  function recoverStateOnStartup() { /* state is derived from the clock — nothing to recover */ }

  // Legacy helpers kept for the admin panel / old shortcuts
  function triggerAthan(prayer)           { startDemo('all',   prayer ? [prayer] : []); }
  function triggerIqamahCountdown(prayer) { startDemo('iqamah', prayer ? [prayer] : []); }
  function triggerIqamah(prayer)          { startDemo('now',   prayer ? [prayer] : []); }
  const manualAthan = triggerAthan, manualIqamah = triggerIqamahCountdown, manualReturn = returnToNormal;

  return {
    STATES, getState, getPrayerId, isDemo, evaluate,
    setStateChangeCallback, checkPrayerTriggers, recoverStateOnStartup,
    startDemo, returnToNormal,
    triggerAthan, triggerIqamahCountdown, triggerIqamah,
    manualAthan, manualIqamah, manualReturn,
  };
})();
