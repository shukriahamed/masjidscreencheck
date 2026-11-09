/**
 * storage.js - IndexedDB and LocalStorage management
 * Handles all persistent data storage for the Masjid Display System
 */

const Storage = (() => {
  const DB_NAME = 'MasjidDisplayDB';
  const DB_VERSION = 1;
  let db = null;

  // IndexedDB store names
  const STORES = {
    IMAGES: 'images',
    PRAYER_TIMES: 'prayerTimes',
    SLIDES: 'slides',
    ANNOUNCEMENTS: 'announcements',
    SETTINGS: 'settings',
  };

  /**
   * Open (or create) the IndexedDB database
   */
  async function openDB() {
    if (db) return db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains(STORES.IMAGES)) {
          idb.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORES.PRAYER_TIMES)) {
          idb.createObjectStore(STORES.PRAYER_TIMES, { keyPath: 'date' });
        }
        if (!idb.objectStoreNames.contains(STORES.SLIDES)) {
          idb.createObjectStore(STORES.SLIDES, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORES.ANNOUNCEMENTS)) {
          idb.createObjectStore(STORES.ANNOUNCEMENTS, { keyPath: 'id' });
        }
        if (!idb.objectStoreNames.contains(STORES.SETTINGS)) {
          idb.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };
      request.onsuccess = (e) => { db = e.target.result; resolve(db); };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /** Generic IDB put */
  async function idbPut(storeName, value) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /** Generic IDB get */
  async function idbGet(storeName, key) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /** Generic IDB getAll */
  async function idbGetAll(storeName) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /** Generic IDB delete */
  async function idbDelete(storeName, key) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /** Generic IDB clear store */
  async function idbClear(storeName) {
    const idb = await openDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // --- LocalStorage helpers ---
  function lsGet(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : defaultValue;
    } catch { return defaultValue; }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('localStorage write failed:', e); return false; }
  }

  function lsRemove(key) {
    localStorage.removeItem(key);
  }

  // --- Settings (via localStorage for instant access) ---
  const SETTINGS_VERSION = 3;
  let settingsCache = null;

  // Keys that describe the *look* of the display. When an older save is
  // opened these are reset so the new design is applied cleanly.
  const LOOK_KEYS = [
    'theme', 'layout', 'colorPrimary', 'colorSecondary', 'colorAccent', 'colorText',
    'colorSidebarBg', 'colorHeaderBg', 'colorClockBg', 'colorActivePrayer',
    'colorTickerBg', 'colorTickerText', 'sidebarWidth', 'headerHeight', 'tickerHeight',
    'prayerFontSize', 'mosqueNameFontSize', 'tickerFontSize', 'dateFontSize',
    'clockDiameter', 'clockHandColor', 'clockNumberColor', 'clockTickColor',
    'clockBorderColor', 'tickerBold', 'backgroundOverlay',
  ];

  function migrate(saved) {
    const def = getDefaultSettings();
    const out = Object.assign({}, def, saved);
    if ((saved._v || 1) < SETTINGS_VERSION) {
      for (const k of LOOK_KEYS) out[k] = def[k];
      // Old factory placeholders -> new defaults (user edits are kept)
      const oldName = ['Masjidur Rahman - Jummah Masjid'];
      if (oldName.includes(saved.mosqueName)) out.mosqueName = def.mosqueName;
      if (saved.mosqueAddress === 'Moor Street, Mannar, Sri Lanka') out.mosqueAddress = def.mosqueAddress;
      if (saved.mosquePhone === '077 642 1040') out.mosquePhone = def.mosquePhone;
      const fajr = (saved.prayers || []).find(p => p.id === 'fajr');
      if (!saved.prayers || (fajr && fajr.athan === '05:15' && fajr.iqamah === '05:25')) {
        out.prayers = def.prayers;
      }
      if (saved.tickerMessages && saved.tickerMessages[0] === 'Welcome to Masjidur Rahman - Jummah Masjid') {
        out.tickerMessages = def.tickerMessages;
      }
      out._v = SETTINGS_VERSION;
    }
    // The credit used to default to the top-right; it now lives in the footer.
    if (saved.creditPosition === 'top-right' && !saved._creditMoved) {
      out.creditPosition = 'bottom-center';
      out._creditMoved = true;
    }
    return out;
  }

  function getSettings() {
    if (settingsCache) return settingsCache;
    const saved = lsGet('masjidSettings', null);
    settingsCache = saved ? migrate(saved) : getDefaultSettings();
    return settingsCache;
  }

  function saveSettings(settings) {
    settingsCache = null;
    lsSet('masjidSettings', settings);
    schedulePush();
  }

  // Storage events from another tab (admin panel) must drop the cache
  window.addEventListener('storage', (e) => { if (e.key === 'masjidSettings') settingsCache = null; });

  function getDefaultSettings() {
    return {
      _v: SETTINGS_VERSION,

      // Mosque Info
      mosqueName: 'Masjidur Rahman',
      mosqueNameArabic: 'مسجد الرحمن',
      mosqueAddress: 'Moor Street, Mannar.',
      mosquePhone: '077-6421040',
      mosqueLogoId: null,

      // Look & feel
      theme: 'islamic-blue',        // colour palette
      layout: 'signature',          // screen layout (see css/layouts.css)
      athanScreenStyle: 'progress', // 'progress' | 'globe'
      colorPrimary: '#1a3a5c',
      colorSecondary: '#c8972a',
      colorAccent: '#2a6496',
      colorText: '#ffffff',
      colorSidebarBg: '#0a5cc0',
      colorHeaderBg: '#4a6585',
      colorClockBg: '#0a4aa0',
      colorActivePrayer: '#ffd400',
      colorTickerBg: '#000000',
      colorTickerText: '#ffffff',
      colorCountdownText: '#fff',
      colorIqamahText: '#c8972a',
      colorAnnouncementBg: 'rgba(10,30,60,0.92)',

      // Sizes (px on the 1920x1080 design canvas)
      sidebarWidth: 678,
      headerHeight: 171,
      clockDiameter: 540,
      clockPosition: 'center',
      prayerFontSize: 80,
      prayerNameFontSize: 36,
      iqamahFontSize: 20,
      mosqueNameFontSize: 62,
      dateFontSize: 38,
      tickerHeight: 86,
      tickerFontSize: 42,
      sidebarPosition: 'left',

      // Clock
      clockEnabled: true,
      digitalClockEnabled: true,
      analogClockEnabled: true,
      timeFormat: '12h',
      clockHandColor: '#ffffff',
      clockNumberColor: '#ffffff',
      clockTickColor: 'rgba(255,255,255,0.75)',
      clockBorderColor: '#1e8fff',
      hijriOffset: 0,               // days, to follow local moon sighting

      // Prayer Times
      prayerMode: 'manual', // 'manual' or 'auto'
      prayerCalcMethod: 2, // MWL
      asrMethod: 0, // Standard
      timezone: 'Asia/Colombo',
      latitude: 8.9833,
      longitude: 79.9000,
      sunriseRangeMinutes: 15,
      prayers: [
        { id: 'fajr',    name: 'Fajr',    arabicName: 'الفجر',    enabled: true, athan: '04:42', iqamah: '04:52', iqamahOffset: 10 },
        { id: 'sunrise', name: 'Sunrise', arabicName: 'الشروق',   enabled: true, athan: '06:01', iqamah: '',      iqamahOffset: 0  },
        { id: 'dhuhr',   name: 'Luhar',   arabicName: 'الظهر',    enabled: true, athan: '11:56', iqamah: '12:06', iqamahOffset: 10 },
        { id: 'asr',     name: 'Asr',     arabicName: 'العصر',    enabled: true, athan: '15:19', iqamah: '15:29', iqamahOffset: 10 },
        { id: 'maghrib', name: 'Maghrib', arabicName: 'المغرب',   enabled: true, athan: '17:51', iqamah: '18:01', iqamahOffset: 10 },
        { id: 'isha',    name: 'Isha',    arabicName: 'العشاء',   enabled: true, athan: '19:01', iqamah: '19:11', iqamahOffset: 10 },
      ],

      // Screens shown around each prayer
      preAthanMinutes: 5,           // "Time to Athan" screen (0 = off)
      athanDuration: 120,           // seconds the Athan screen stays
      athanMessage: 'Allahu Akbar! Come to Prayer!',
      iqamahLeadMinutes: 5,         // "Towards Iqamah" screen in the last N minutes
      iqamahScreenSeconds: 60,      // "Iqamah" screen after the countdown ends
      iqamahMessages: [
        'Turn off communication device or use silent mode',
        'Straighten the rows and close the gaps',
      ],
      // Picture shown after Iqamah while the prayer is being performed
      shafEnabled: true,
      shafMinutes: 10,
      shafImageId: null,            // null = built-in "straighten the rows" picture
      iqamahDurations: { fajr: 600, dhuhr: 600, asr: 600, maghrib: 300, isha: 900 }, // legacy
      athanAudioId: null,
      athanBgId: null,

      // Jummah
      jummahEnabled: true,
      jummahTime: '12:30',
      jummahIqamah: '12:40',
      jummahKhutbahStart: '12:00',
      jummahLeadMinutes: 60,
      jummahTopic: 'Weekly Khutbah',
      jummahKhateeb: 'Ash-Sheikh',
      jummahMessage: 'JUMMAH MUBARAK',
      jummahBgId: null,
      jummahKhateebPhotoId: null,
      jummahAutoMode: true,
      jummahName: 'Jummah',         // replaces Luhar in the prayer list on Fridays
      jummahImageId: null,          // custom picture shown while Jummah is performed
      jummahImageMinutes: 20,       // 0 = off

      // Ticker
      tickerEnabled: true,
      tickerMessages: [
        'Masjidur Rahman - Jummah Masjid, Moor Street, Mannar',
        'Please switch off your mobile phones',
        'Maintain silence inside the Masjid',
        'Join our weekly Islamic programmes',
        'May Allah accept our prayers - Ameen',
      ],
      tickerSpeed: 90,
      tickerSeparator: '•',
      tickerBold: false,
      tickerDirection: 'rtl',

      // Slideshow (used by the "Hadith & Slides" overlay)
      slideDuration: 8000,
      slideTransition: 'fade',
      slideshowEnabled: true,

      // Display
      backgroundId: null,
      backgroundOpacity: 1,
      backgroundBlur: 0,
      backgroundOverlay: 0,
      backgroundSize: 'cover',

      // Credit
      creditVisible: true,
      creditPosition: 'bottom-center',
      _creditMoved: true,
      creditFontSize: 14,

      // Admin
      adminPin: '1234',

      // Cache
      prayerCacheDays: 30,
      lastPrayerFetch: null,
    };
  }

  // ============================================================
  // REMOTE SYNC (Vercel): settings, slides, announcements and every uploaded
  // image/audio file live on the server (Vercel Blob), so the admin page on any
  // device updates the TV. This browser keeps a local copy for offline use.
  // If /api is not there (opened from a folder / local server) everything simply
  // stays local, exactly as before.
  // ============================================================
  const MAX_UPLOAD = 4.2 * 1024 * 1024;           // Vercel function body limit is ~4.5 MB
  let remoteOK = false;                           // true once /api/state answered
  let remoteImages = lsGet('masjidRemoteImages', {});   // id -> { url, name, type }
  let remoteStamp  = lsGet('masjidRemoteStamp', 0);
  let pushTimer = null;
  let pushing = Promise.resolve();

  const getToken  = () => { try { return localStorage.getItem('masjidAdminToken') || ''; } catch (e) { return ''; } };
  const setToken  = (t) => { try { t ? localStorage.setItem('masjidAdminToken', t) : localStorage.removeItem('masjidAdminToken'); } catch (e) {} };
  const hasRemote = () => remoteOK;
  let remoteError = '';
  const getRemoteError = () => remoteError;
  const warn = (msg) => { console.warn('[sync]', msg); window.dispatchEvent(new CustomEvent('masjid-sync-error', { detail: msg })); };

  /** Pull the server copy. Returns true when it differed from what this browser had. */
  async function syncFromServer() {
    try {
      const r = await fetch('/api/state', { cache: 'no-store' });
      if (!r.ok) {
        let m = ''; try { m = (await r.json()).error || ''; } catch (e) {}
        remoteOK = false;
        remoteError = r.status === 404
          ? 'The /api folder was not found on this site (404). On Vercel set Root Directory to the folder that contains api/ and redeploy.'
          : `Server answered ${r.status}${m ? ': ' + m : ''}`;
        return false;
      }
      let st;
      try { st = await r.json(); } catch (e) { remoteOK = false; remoteError = 'This address does not run the Vercel API (got a web page instead of data).'; return false; }
      remoteOK = true; remoteError = '';
      if (!st || !st.updatedAt || st.updatedAt === remoteStamp) return false;

      lsSet('masjidSettings', st.settings); settingsCache = null;
      remoteImages = st.images || {};
      lsSet('masjidRemoteImages', remoteImages);

      await idbClear(STORES.SLIDES);
      for (const s of (st.slides || [])) await idbPut(STORES.SLIDES, s);
      await idbClear(STORES.ANNOUNCEMENTS);
      for (const a of (st.announcements || [])) await idbPut(STORES.ANNOUNCEMENTS, a);
      try { localStorage.setItem('masjid-slides-seeded', '2'); } catch (e) {}

      // drop cached files that no longer exist on the server
      for (const rec of await idbGetAll(STORES.IMAGES)) {
        if (rec.rurl && !remoteImages[rec.id]) await idbDelete(STORES.IMAGES, rec.id);
      }
      remoteStamp = st.updatedAt; lsSet('masjidRemoteStamp', remoteStamp);
      return true;
    } catch (e) { remoteOK = false; remoteError = 'Could not reach the server (offline, or opened from a local file).'; return false; }
  }

  async function apiFetch(path, opts = {}) {
    const headers = Object.assign({ 'x-admin-token': getToken() }, opts.headers || {});
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    if (r.status === 401) { setToken(''); window.dispatchEvent(new CustomEvent('masjid-auth-failed')); throw new Error('Wrong admin token'); }
    if (!r.ok) {
      let m = ''; try { m = (await r.json()).error; } catch (e) {}
      throw new Error(m || ('Server error ' + r.status));
    }
    return r.json();
  }

  /** Shrink big photos so they fit the upload limit (SVG / small files are left alone). */
  async function prepareFile(blob, meta) {
    let out = blob;
    const isImg = (blob.type || '').startsWith('image/') && blob.type !== 'image/svg+xml' && blob.type !== 'image/gif';
    if (isImg && blob.size > 1.2 * 1024 * 1024) {
      try {
        const bmp = await createImageBitmap(blob);
        const scale = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const jpg = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88));
        if (jpg && jpg.size < blob.size) out = jpg;
      } catch (e) { /* keep original */ }
    }
    if (out.size > MAX_UPLOAD) throw new Error(`"${meta.name || 'file'}" is ${(out.size / 1048576).toFixed(1)} MB — max is 4 MB. Use a smaller file.`);
    return out;
  }

  async function uploadRemote(id, blob, meta) {
    const file = await prepareFile(blob, meta);
    const res = await apiFetch('/api/upload', {
      method: 'POST',
      headers: { 'x-id': id, 'x-name': encodeURIComponent(meta.name || id), 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    return { url: res.url, blob: file };
  }

  function schedulePush() {
    if (!remoteOK || !getToken()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushing = pushing.then(pushNow).catch(() => {}); }, 800);
  }

  async function pushNow() {
    if (!remoteOK || !getToken()) return false;
    try {
      // First publish from a browser that already holds local files: upload them too
      for (const rec of await idbGetAll(STORES.IMAGES)) {
        if (!remoteImages[rec.id] && rec.blob) {
          try {
            const up = await uploadRemote(rec.id, rec.blob, rec.meta || {});
            remoteImages[rec.id] = { url: up.url, name: (rec.meta || {}).name, type: (rec.meta || {}).type };
            await idbPut(STORES.IMAGES, { ...rec, blob: up.blob, rurl: up.url });
          } catch (e) { warn(e.message); }
        }
      }
      lsSet('masjidRemoteImages', remoteImages);
      const res = await apiFetch('/api/state', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          settings: getSettings(),
          slides: await getAllSlides(),
          announcements: await getAllAnnouncements(),
          images: remoteImages,
        }),
      });
      remoteStamp = res.updatedAt; lsSet('masjidRemoteStamp', remoteStamp);
      window.dispatchEvent(new CustomEvent('masjid-synced'));
      return true;
    } catch (e) { warn('Could not save to the server: ' + e.message); return false; }
  }

  // --- Image management ---
  async function saveImage(id, blob, meta = {}) {
    let rec = { id, blob, meta, savedAt: Date.now() };
    if (remoteOK && getToken()) {
      try {
        const old = remoteImages[id];
        const up = await uploadRemote(id, blob, meta);
        remoteImages[id] = { url: up.url, name: meta.name, type: meta.type };
        lsSet('masjidRemoteImages', remoteImages);
        rec = { id, blob: up.blob, meta, savedAt: Date.now(), rurl: up.url };
        if (old && old.url && old.url !== up.url) apiFetch('/api/upload', { method: 'DELETE', body: JSON.stringify({ url: old.url }) }).catch(() => {});
      } catch (e) { warn('Upload failed — kept on this device only. ' + e.message); }
    }
    await idbPut(STORES.IMAGES, rec);
    schedulePush();
  }

  async function getImage(id) {
    if (!id) return null;
    const record = await idbGet(STORES.IMAGES, id);
    const remote = remoteImages[id];
    if (record && (!remote || record.rurl === remote.url)) return record.blob;
    if (remote) {
      try {
        const r = await fetch(remote.url);
        if (r.ok) {
          const blob = await r.blob();
          await idbPut(STORES.IMAGES, { id, blob, meta: { name: remote.name, type: remote.type }, savedAt: Date.now(), rurl: remote.url });
          return blob;
        }
      } catch (e) { /* offline: fall through to whatever we have cached */ }
    }
    return record ? record.blob : null;
  }

  async function deleteImage(id) {
    const remote = remoteImages[id];
    await idbDelete(STORES.IMAGES, id);
    if (remote) {
      delete remoteImages[id]; lsSet('masjidRemoteImages', remoteImages);
      if (getToken()) apiFetch('/api/upload', { method: 'DELETE', body: JSON.stringify({ url: remote.url }) }).catch(() => {});
    }
    schedulePush();
  }

  /** Every stored image: cached blobs plus files that only exist on the server (blob may be null -> use remoteUrl) */
  async function getAllImages() {
    const local = await idbGetAll(STORES.IMAGES);
    const have = new Set(local.map(r => r.id));
    for (const [id, r] of Object.entries(remoteImages)) {
      if (!have.has(id)) local.push({ id, blob: null, remoteUrl: r.url, meta: { name: r.name, type: r.type } });
    }
    return local;
  }

  /** Convert image to a URL the page can use */
  async function getImageURL(id) {
    const blob = await getImage(id);
    if (blob) return URL.createObjectURL(blob);
    return remoteImages[id] ? remoteImages[id].url : null;
  }

  // --- Prayer times cache ---
  async function savePrayerTimesForDate(date, times) {
    return idbPut(STORES.PRAYER_TIMES, { date, times, cachedAt: Date.now() });
  }

  async function getPrayerTimesForDate(date) {
    const record = await idbGet(STORES.PRAYER_TIMES, date);
    return record ? record.times : null;
  }

  async function getAllCachedPrayerTimes() {
    return idbGetAll(STORES.PRAYER_TIMES);
  }

  async function clearOldPrayerTimes(keepDays = 30) {
    const all = await getAllCachedPrayerTimes();
    const cutoff = Date.now() - keepDays * 86400000;
    for (const record of all) {
      if (record.cachedAt < cutoff) {
        await idbDelete(STORES.PRAYER_TIMES, record.date);
      }
    }
  }

  // --- Slides ---
  async function saveSlide(slide) {
    await idbPut(STORES.SLIDES, slide);
    schedulePush();
  }

  async function getAllSlides() {
    return idbGetAll(STORES.SLIDES);
  }

  async function deleteSlide(id) {
    await idbDelete(STORES.SLIDES, id);
    schedulePush();
  }

  // --- Announcements ---
  async function saveAnnouncement(ann) {
    await idbPut(STORES.ANNOUNCEMENTS, ann);
    schedulePush();
  }

  async function getAllAnnouncements() {
    return idbGetAll(STORES.ANNOUNCEMENTS);
  }

  async function deleteAnnouncement(id) {
    await idbDelete(STORES.ANNOUNCEMENTS, id);
    schedulePush();
  }

  // --- Backup & Restore ---
  async function exportBackup() {
    const settings = getSettings();
    const slides = await getAllSlides();
    const announcements = await getAllAnnouncements();
    const prayerTimes = await getAllCachedPrayerTimes();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      slides,
      announcements,
      prayerTimes,
    };
  }

  async function importBackup(data) {
    if (!data || data.version !== 1) throw new Error('Invalid backup format');
    if (data.settings) saveSettings(data.settings);
    if (data.slides) {
      await idbClear(STORES.SLIDES);
      for (const s of data.slides) await saveSlide(s);
    }
    if (data.announcements) {
      await idbClear(STORES.ANNOUNCEMENTS);
      for (const a of data.announcements) await saveAnnouncement(a);
    }
    if (data.prayerTimes) {
      await idbClear(STORES.PRAYER_TIMES);
      for (const pt of data.prayerTimes) await idbPut(STORES.PRAYER_TIMES, pt);
    }
  }

  async function resetAll() {
    saveSettings(getDefaultSettings());
    await idbClear(STORES.SLIDES);
    await idbClear(STORES.ANNOUNCEMENTS);
    await idbClear(STORES.PRAYER_TIMES);
  }

  // Public API
  return {
    openDB,
    getSettings,
    saveSettings,
    getDefaultSettings,
    saveImage,
    syncFromServer, pushNow, hasRemote, getRemoteError, getToken, setToken,
    getImage,
    deleteImage,
    getAllImages,
    getImageURL,
    savePrayerTimesForDate,
    getPrayerTimesForDate,
    getAllCachedPrayerTimes,
    clearOldPrayerTimes,
    saveSlide,
    getAllSlides,
    deleteSlide,
    saveAnnouncement,
    getAllAnnouncements,
    deleteAnnouncement,
    exportBackup,
    importBackup,
    resetAll,
    lsGet,
    lsSet,
    lsRemove,
  };
})();
