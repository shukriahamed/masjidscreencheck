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

  // ================================================================
  // BULK TABLE (ACJU timetable or any yearly timetable pasted into the admin)
  // One line per day:   Date, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
  // ================================================================
  const TBL_IDS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const p2 = n => String(n).padStart(2, '0');
  const TIME_RE = /(\d{1,2})\s*[:.]\s*(\d{2})\s*([AaPp]\.?\s?[Mm]\.?)?/g;

  /** "4:46", "4:46 AM", "16:46", "3.15 pm"  ->  "HH:MM" (24h). 12-hour times without AM/PM are placed by prayer. */
  function normTime(h, m, ap, id) {
    h = +h; m = +m;
    if (m > 59 || h > 24) return null;
    if (ap) {
      const pm = /p/i.test(ap);
      if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12;
    } else if (h < 12) {
      if (id === 'dhuhr' && h >= 1 && h <= 9) h += 12;      // 1:05 -> 13:05
      if (/^asr/.test(id) || id === 'maghrib' || id === 'isha') h += 12;   // 3:15 -> 15:15, 7:04 -> 19:04
    }
    if (h === 24) h = 0;
    return `${p2(h)}:${p2(m)}`;
  }

  /** Pull the date off the start of a line. Returns { key, rest } — key is YYYY-MM-DD, or MM-DD (repeats every year). */
  function readDate(line) {
    let m;
    if ((m = line.match(/^\s*(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/)))            // 2027-01-31
      return { key: `${m[1]}-${p2(m[2])}-${p2(m[3])}`, d: +m[3], mo: +m[2], rest: line.slice(m[0].length) };
    if ((m = line.match(/^\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\b/)))            // 31/01/2027 (day first)
      return { key: `${m[3]}-${p2(m[2])}-${p2(m[1])}`, d: +m[1], mo: +m[2], rest: line.slice(m[0].length) };
    if ((m = line.match(/^\s*(\d{1,2})[\s\-\/.]*([A-Za-z]{3})[A-Za-z]*\.?[\s\-,\/.]*(\d{4})?\b/)) && MONTHS.includes(m[2].toLowerCase())) // 31 Jan [2027]
      return { key: (m[3] ? m[3] + '-' : '') + `${p2(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${p2(m[1])}`, d: +m[1], mo: MONTHS.indexOf(m[2].toLowerCase()) + 1, rest: line.slice(m[0].length) };
    if ((m = line.match(/^\s*([A-Za-z]{3})[A-Za-z]*\.?[\s\-\/.]*(\d{1,2})(?:[\s,\-\/.]+(\d{4}))?(?=[\s,;\t])/)) && MONTHS.includes(m[1].toLowerCase())) // Jan 31 [2027]
      return { key: (m[3] ? m[3] + '-' : '') + `${p2(MONTHS.indexOf(m[1].toLowerCase()) + 1)}-${p2(m[2])}`, d: +m[2], mo: MONTHS.indexOf(m[1].toLowerCase()) + 1, rest: line.slice(m[0].length) };
    if ((m = line.match(/^\s*(\d{1,2})[-\/.](\d{1,2})(?=[\s,;\t])/)))                // 31/01 (day/month, every year)
      return { key: `${p2(m[2])}-${p2(m[1])}`, d: +m[1], mo: +m[2], rest: line.slice(m[0].length) };
    return null;
  }

  /** Parse pasted text. Returns { table, count, errors[] } */
  function parseBulkTimes(text) {
    const table = {}, errors = [];
    let count = 0;
    String(text || '').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#') || /^date\b/i.test(line)) return;
      const dt = readDate(line);
      if (!dt) {
        // stray text (headings, notes copied from a PDF) is ignored; a line that looks like times but has no date is reported
        if ((line.match(TIME_RE) || []).length >= 4) errors.push(`Line ${i + 1}: could not read the date`);
        return;
      }
      if (dt.mo < 1 || dt.mo > 12 || dt.d < 1 || dt.d > 31) { errors.push(`Line ${i + 1}: invalid date`); return; }
      const found = [...dt.rest.matchAll(TIME_RE)];
      if (![5, 6, 7].includes(found.length)) { errors.push(`Line ${i + 1}: need Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha (found ${found.length} times)`); return; }
      // 7 times = ACJU layout with both Asr columns: Fajr Sunrise Luhr Asr-Shafie Asr-Hanafi Maghrib Isha
      const ids = found.length === 7 ? ['fajr', 'sunrise', 'dhuhr', 'asrS', 'asrH', 'maghrib', 'isha']
                : found.length === 6 ? TBL_IDS : TBL_IDS.filter(x => x !== 'sunrise');
      const out = {};
      let bad = false;
      found.forEach((f, k) => { const t = normTime(f[1], f[2], f[3], ids[k]); if (!t) bad = true; out[ids[k]] = t; });
      if (bad) { errors.push(`Line ${i + 1}: invalid time`); return; }
      const order = ids.map(x => out[x]);
      for (let k = 1; k < order.length; k++) {
        if (order[k] <= order[k - 1]) { errors.push(`Line ${i + 1}: times are not in order (${order.join(' ')})`); bad = true; break; }
      }
      if (bad) return;
      table[dt.key] = found.length === 7 ? ids.map(x => out[x]) : TBL_IDS.map(x => out[x] || '');
      count++;
    });
    return { table, count, errors };
  }

  /** Today's (or any date's) row from the stored table -> { fajr, sunrise, ... } or null */
  function tableTimesFor(settings, date) {
    const t = settings.prayerTable;
    if (!t) return null;
    const d = date || new Date();
    const full = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    let row = t[full] || t[full.slice(5)];
    if (!row && full.slice(5) === '02-29') row = t['02-28'];
    if (!row) return null;
    const o = {};
    if (row.length === 7) {                       // ACJU: Asr (Shafi'i) and Asr (Hanafi) both stored
      const asr = settings.tableAsr === 'hanafi' ? row[4] : row[3];
      const six = [row[0], row[1], row[2], asr, row[5], row[6]];
      TBL_IDS.forEach((id, k) => { if (six[k]) o[id] = six[k]; });
    } else {
      TBL_IDS.forEach((id, k) => { if (row[k]) o[id] = row[k]; });
    }
    return o;
  }

  /** ACJU mode with an empty table: load the bundled timetable (data/acju-zone04-mannar-puttalam.txt) by itself. */
  async function ensureTable() {
    const s = Storage.getSettings();
    if (s.prayerMode !== 'table' || (s.prayerTable && Object.keys(s.prayerTable).length)) return false;
    try {
      const r = await fetch('data/acju-zone04-mannar-puttalam.txt', { cache: 'no-store' });
      if (!r.ok) return false;
      const res = parseBulkTimes(await r.text());
      if (!res.count) return false;
      s.prayerTable = res.table;
      Storage.saveSettings(s);
      return true;
    } catch (e) { return false; }
  }

  /** Text for the "download template / export" button */
  function bulkToText(settings) {
    const t = settings.prayerTable || {};
    const keys = Object.keys(t).sort();
    const seven = keys.length && t[keys[0]].length === 7;
    const head = seven
      ? '# Date, Fajr, Sunrise, Luhr, Asr (Shafi\'i), Asr (Hanafi), Maghrib, Isha  (24-hour HH:MM)\nDate,Fajr,Sunrise,Luhr,Asr-Shafie,Asr-Hanafi,Maghrib,Isha'
      : '# Date, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha  (24-hour HH:MM, or 12-hour with AM/PM)\nDate,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha';
    if (!keys.length) return head + '\n01/01/2027,04:46,06:02,12:08,15:14,18:13,19:23\n02/01/2027,04:47,06:03,12:08,15:15,18:14,19:24\n';
    return head + '\n' + keys.map(k => {
      const date = k.length === 10 ? `${k.slice(8)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : `${k.slice(3)}/${k.slice(0, 2)}`;
      return date + ',' + t[k].join(',');
    }).join('\n') + '\n';
  }

  /** Get prayer times for today (from cache or manual settings) */
  async function getTodayTimes() {
    const settings = Storage.getSettings();

    if (settings.prayerMode === 'table') {
      const row = tableTimesFor(settings, new Date()) || {};
      const result = {};
      for (const p of settings.prayers) result[p.id] = row[p.id] || p.athan;   // missing day -> manual time
      return result;
    }

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
    parseBulkTimes, tableTimesFor, bulkToText, ensureTable,
    getCurrentPrayer,
    minutesUntilNext,
    parseTime,
    formatCountdown,
    todayStr,
    getTimezoneOffset,
    CALC_METHODS,
  };
})();
