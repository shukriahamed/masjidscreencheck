/**
 * prayer-times.js
 * Handles prayer time management, API fetch, caching, and display updates.
 * Uses Adhan.js calculation as an inline implementation for offline use.
 */

const PrayerTimes = (() => {
  // ---- Minimal prayer time calculator (Adhan algorithm, offline) ----
  // Based on PrayTimes.org algorithm (GPL), adapted inline

  const CALC_METHODS = {
    0: { name: 'Karachi',  fajr: 18, isha: 18 },
    1: { name: 'ISNA',     fajr: 15, isha: 15 },
    2: { name: 'MWL',      fajr: 18, isha: 17 },
    3: { name: 'Makkah',   fajr: 18.5, isha: '90 min' },
    4: { name: 'Egypt',    fajr: 19.5, isha: 17.5 },
    5: { name: 'Tehran',   fajr: 17.7, isha: 14 },
    6: { name: 'Jafari',   fajr: 16, isha: 14 },
    7: { name: 'Gulf',     fajr: 19.5, isha: 90 },
    8: { name: 'Kuwait',   fajr: 18, isha: 17.5 },
    9: { name: 'Qatar',    fajr: 18, isha: 90 },
  };

  function toRad(d) { return d * Math.PI / 180; }
  function toDeg(r) { return r * 180 / Math.PI; }
  function fixHour(a) { return a - 24 * Math.floor(a / 24); }
  function fixAngle(a) { return a - 360 * Math.floor(a / 360); }

  function sunPosition(jd) {
    const D = jd - 2451545;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * Math.sin(toRad(g)) + 0.020 * Math.sin(toRad(2 * g)));
    const e = 23.439 - 0.00000036 * D;
    const RA = toDeg(Math.atan2(Math.cos(toRad(e)) * Math.sin(toRad(L)), Math.cos(toRad(L)))) / 15;
    const dec = toDeg(Math.asin(Math.sin(toRad(e)) * Math.sin(toRad(L))));
    const EqT = q / 15 - fixHour(RA);
    return { dec, EqT };
  }

  function julianDay(year, month, day) {
    if (month <= 2) { year--; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  }

  function computeTime(lat, decl, angle, noon) {
    const val = -Math.sin(toRad(angle)) - Math.sin(toRad(lat)) * Math.sin(toRad(decl));
    const div = Math.cos(toRad(lat)) * Math.cos(toRad(decl));
    if (Math.abs(val / div) > 1) return null; // sun never rises/sets
    const t = toDeg(Math.acos(val / div)) / 15;
    return { rise: noon - t, set: noon + t };
  }

  function asrTime(lat, decl, noon, factor) {
    const angle = toDeg(Math.atan(1 / (factor + Math.tan(toRad(Math.abs(lat - decl))))));
    const val = Math.sin(toRad(angle)) - Math.sin(toRad(lat)) * Math.sin(toRad(decl));
    const div = Math.cos(toRad(lat)) * Math.cos(toRad(decl));
    const t = toDeg(Math.acos(val / div)) / 15;
    return noon + t;
  }

  function decimalToTime(val) {
    if (val === null || isNaN(val)) return '--:--';
    val = fixHour(val);
    const h = Math.floor(val);
    const m = Math.floor((val - h) * 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function calcPrayerTimes(year, month, day, lat, lng, tz, method = 1, asrMethod = 0) {
    const jd = julianDay(year, month, day) - lng / 360;
    const sp = sunPosition(jd);
    const noon = fixHour(12 - sp.EqT - lng / 15 + tz);

    // Fajr / Isha angles
    const cm = CALC_METHODS[method] || CALC_METHODS[1];
    const fajrAngle = typeof cm.fajr === 'number' ? cm.fajr : 15;
    let ishaVal = cm.isha;

    const fajrT = computeTime(lat, sp.dec, fajrAngle, noon);
    const sunriseT = computeTime(lat, sp.dec, 0.833, noon);
    const sunsetT = computeTime(lat, sp.dec, 0.833, noon);
    const asrFactor = asrMethod === 0 ? 1 : 2; // Shafi/Standard=1, Hanafi=2
    const asrT = asrTime(lat, sp.dec, noon, asrFactor);

    let ishaTime;
    if (typeof ishaVal === 'string' || (typeof ishaVal === 'number' && ishaVal > 24)) {
      // Minutes after sunset
      const mins = typeof ishaVal === 'number' ? ishaVal : 90;
      ishaTime = sunsetT ? sunsetT.set + mins / 60 : null;
    } else {
      const ishaT = computeTime(lat, sp.dec, ishaVal, noon);
      ishaTime = ishaT ? ishaT.set : null;
    }

    return {
      fajr:    fajrT    ? decimalToTime(fajrT.rise)    : '--:--',
      sunrise: sunriseT ? decimalToTime(sunriseT.rise)  : '--:--',
      dhuhr:   decimalToTime(noon),
      asr:     decimalToTime(asrT),
      maghrib: sunsetT  ? decimalToTime(sunsetT.set)    : '--:--',
      isha:    ishaTime ? decimalToTime(ishaTime)        : '--:--',
    };
  }

  /** Get today's date string YYYY-MM-DD */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /** Fetch and cache 30 days of prayer times (auto mode) */
  async function fetchAndCache(settings) {
    const { latitude, longitude, timezone, prayerCalcMethod, asrMethod } = settings;
    const tz = getTimezoneOffset(timezone);
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const times = calcPrayerTimes(d.getFullYear(), d.getMonth()+1, d.getDate(), latitude, longitude, tz, prayerCalcMethod, asrMethod);
      await Storage.savePrayerTimesForDate(dateStr, times);
    }

    // Update last fetch time
    const s = Storage.getSettings();
    s.lastPrayerFetch = new Date().toISOString();
    Storage.saveSettings(s);
    console.log('[PrayerTimes] 30-day cache refreshed.');
  }

  function getTimezoneOffset(tz) {
    // Compute numeric UTC offset for a named timezone
    try {
      const now = new Date();
      const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      return (local - utc) / 3600000;
    } catch {
      return 5.5; // Asia/Colombo default
    }
  }

  /** Get prayer times for today (from cache or manual settings) */
  async function getTodayTimes() {
    const settings = Storage.getSettings();

    if (settings.prayerMode === 'manual') {
      // Return manual times from settings
      const result = {};
      for (const p of settings.prayers) {
        result[p.id] = p.athan;
      }
      return result;
    }

    // Auto mode: check cache
    const dateStr = todayStr();
    let times = await Storage.getPrayerTimesForDate(dateStr);

    if (!times) {
      // Not cached yet — compute locally
      const tz = getTimezoneOffset(settings.timezone);
      const d = new Date();
      times = calcPrayerTimes(d.getFullYear(), d.getMonth()+1, d.getDate(), settings.latitude, settings.longitude, tz, settings.prayerCalcMethod, settings.asrMethod);
      await Storage.savePrayerTimesForDate(dateStr, times);
    }

    return times;
  }

  /** Parse "HH:MM" string into minutes since midnight */
  function parseTime(str) {
    if (!str || str === '--:--') return null;
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  /** Get the current/next prayer info */
  function getCurrentPrayer(prayers, now) {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    let current = null, next = null;

    for (let i = 0; i < prayers.length; i++) {
      const p = prayers[i];
      if (!p.enabled || !p.athan || p.athan === '--:--') continue;
      const pMins = parseTime(p.athan);
      if (pMins === null) continue;
      if (pMins <= nowMins) {
        current = p;
      } else if (!next) {
        next = p;
      }
    }

    return { current, next };
  }

  /** Get minutes until next prayer */
  function minutesUntilNext(nextPrayer, now) {
    if (!nextPrayer) return null;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const pMins = parseTime(nextPrayer.athan);
    if (pMins === null) return null;
    return pMins - nowMins;
  }

  /** Format minutes as "H:MM" */
  function formatCountdown(totalSeconds) {
    if (totalSeconds <= 0) return '00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  return {
    calcPrayerTimes,
    fetchAndCache,
    getTodayTimes,
    getCurrentPrayer,
    minutesUntilNext,
    parseTime,
    formatCountdown,
    todayStr,
    getTimezoneOffset,
    CALC_METHODS,
  };
})();
