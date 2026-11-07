/**
 * admin.js - Complete Admin Dashboard Logic
 * Handles all settings, prayer times, slides, announcements, wallpapers, and backup.
 */

// ============================================================
// UTILITY HELPERS
// ============================================================

function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = '0.4s'; setTimeout(() => toast.remove(), 400); }, duration);
}

function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function formatTime12(time24) {
  if (!time24 || time24 === '--:--') return time24;
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ============================================================
// LOGIN
// ============================================================
let pinInput = '';

function initLogin() {
  const keys = document.querySelectorAll('.pin-key');
  keys.forEach(k => {
    k.addEventListener('click', () => {
      const val = k.dataset.val;
      if (val === 'back') {
        pinInput = pinInput.slice(0, -1);
      } else if (val === 'clear') {
        pinInput = '';
      } else if (pinInput.length < 4) {
        pinInput += val;
        if (pinInput.length === 4) {
          setTimeout(checkPin, 100);
        }
      }
      updatePinDisplay();
    });
  });

  // Also allow keyboard input
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('loginScreen').style.display !== 'none') return;
    if (e.key >= '0' && e.key <= '9' && pinInput.length < 4) {
      pinInput += e.key;
      updatePinDisplay();
      if (pinInput.length === 4) setTimeout(checkPin, 100);
    }
    if (e.key === 'Backspace') { pinInput = pinInput.slice(0,-1); updatePinDisplay(); }
  });
}

function updatePinDisplay() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinInput.length));
  document.getElementById('loginError').textContent = '';
}

function checkPin() {
  const settings = Storage.getSettings();
  const correctPin = settings.adminPin || '1234';
  if (pinInput === correctPin) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').classList.add('visible');
    initAdminApp();
    askAdminToken();
  } else {
    document.getElementById('loginError').textContent = 'Incorrect PIN. Try again.';
    pinInput = '';
    updatePinDisplay();
    // Shake animation
    const box = document.querySelector('.login-box');
    box.style.animation = 'shake 0.4s ease';
    setTimeout(() => box.style.animation = '', 400);
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const target = item.dataset.section;
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      const targetSection = document.getElementById('section-' + target);
      if (targetSection) targetSection.classList.add('active');
      // Load section data
      loadSection(target);
    });
  });
}

function loadSection(name) {
  switch(name) {
    case 'general':    loadGeneralSettings();    break;
    case 'mosque':     loadMosqueInfo();          break;
    case 'prayers':    loadPrayerSettings();      break;
    case 'iqamah':     loadIqamahSettings();      break;
    case 'clock':      loadClockSettings();       break;
    case 'athan':      loadAthanSettings();       break;
    case 'jummah':     loadJummahSettings();      break;
    case 'wallpaper':  loadWallpaperSection();    break;
    case 'slides':     loadSlidesSection();       break;
    case 'announce':   loadAnnouncementsSection();break;
    case 'ticker':     loadTickerSettings();      break;
    case 'layout':     loadLayoutSettings();      break;
    case 'colours':    loadColourSettings();      break;
    case 'backup':     loadBackupSection();       break;
    case 'advanced':   loadAdvancedSettings();    break;
  }
}

// ============================================================
// GENERAL SETTINGS
// ============================================================
function loadGeneralSettings() {
  const s = Storage.getSettings();
  setVal('settingTimezone', s.timezone);
  setVal('settingTimeFormat', s.timeFormat);
  setVal('settingPrayerMode', s.prayerMode);
  setVal('settingCacheDays', s.prayerCacheDays);
}

function saveGeneralSettings() {
  const s = Storage.getSettings();
  s.timezone     = getVal('settingTimezone');
  s.timeFormat   = getVal('settingTimeFormat');
  s.prayerMode   = getVal('settingPrayerMode');
  s.prayerCacheDays = parseInt(getVal('settingCacheDays')) || 30;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('General settings saved!', 'success');
}

// ============================================================
// MOSQUE INFORMATION
// ============================================================
function loadMosqueInfo() {
  const s = Storage.getSettings();
  setVal('mosqueNameInput',    s.mosqueName);
  setVal('mosqueNameArabicInput', s.mosqueNameArabic);
  setVal('mosqueAddressInput', s.mosqueAddress);
  setVal('mosquePhoneInput',   s.mosquePhone);
  updateLogoPreview(s.mosqueLogoId);
}

async function saveMosqueInfo() {
  const s = Storage.getSettings();
  s.mosqueName        = getVal('mosqueNameInput');
  s.mosqueNameArabic  = getVal('mosqueNameArabicInput');
  s.mosqueAddress     = getVal('mosqueAddressInput');
  s.mosquePhone       = getVal('mosquePhoneInput');
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Mosque information saved!', 'success');
}

async function uploadLogo(file) {
  if (!file) return;
  const id = 'mosque-logo';
  await Storage.saveImage(id, file, { name: file.name, type: 'logo' });
  const s = Storage.getSettings();
  s.mosqueLogoId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  updateLogoPreview(id);
  showToast('Logo uploaded!', 'success');
}

async function updateLogoPreview(id) {
  const preview = document.getElementById('logoPreview');
  const empty   = document.getElementById('logoPreviewEmpty');
  if (!preview) return;
  if (id) {
    const url = await Storage.getImageURL(id);
    if (url) {
      preview.src = url;
      preview.style.display = 'block';
      if (empty) empty.style.display = 'none';
      return;
    }
  }
  preview.style.display = 'none';
  if (empty) empty.style.display = 'block';
}

// ============================================================
// PRAYER SETTINGS
// ============================================================
function loadPrayerSettings() {
  const s = Storage.getSettings();
  renderPrayerTable(s.prayers, s);
  setVal('prayerMode', s.prayerMode);
  setVal('calcMethodSel', s.prayerCalcMethod);
  setVal('asrMethodSel',  s.asrMethod);
  setVal('latInput', s.latitude);
  setVal('lngInput', s.longitude);
  updateAutoModeVisibility(s.prayerMode);
}

function renderPrayerTable(prayers, s) {
  const tbody = document.getElementById('prayerTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const p of prayers) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <label class="toggle-switch">
          <input type="checkbox" data-prayer-id="${p.id}" data-field="enabled" ${p.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <input class="form-control" type="text" value="${p.name}" data-prayer-id="${p.id}" data-field="name" placeholder="Prayer Name">
      </td>
      <td>
        <input class="form-control" type="text" value="${p.arabicName||''}" data-prayer-id="${p.id}" data-field="arabicName" placeholder="Arabic Name">
      </td>
      <td>
        <input class="form-control" type="time" value="${p.athan||''}" data-prayer-id="${p.id}" data-field="athan">
      </td>
      <td>
        ${p.id === 'sunrise' ? '<span class="text-muted">—</span>' :
          `<input class="form-control" type="number" min="0" max="180" step="1" style="width:90px" value="${p.iqamahOffset != null ? p.iqamahOffset : ''}" data-prayer-id="${p.id}" data-field="iqamahOffset" placeholder="min">`}
      </td>
      <td>
        <input class="form-control" type="time" value="${p.iqamah||''}" data-prayer-id="${p.id}" data-field="iqamah">
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Add change listeners
  tbody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', onPrayerFieldChange);
  });
}

function onPrayerFieldChange(e) {
  const el = e.target;
  const id = el.dataset.prayerId;
  const field = el.dataset.field;
  const value = el.type === 'checkbox' ? el.checked : el.value;

  const s = Storage.getSettings();
  const prayer = s.prayers.find(p => p.id === id);
  if (prayer) {
    const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const toTime = n => { n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
    const row = el.closest('tr');
    const inp = f => row.querySelector(`[data-field="${f}"]`);

    if (field === 'iqamahOffset') {
      prayer.iqamahOffset = value === '' ? null : Math.max(0, parseInt(value, 10) || 0);
      if (prayer.iqamahOffset != null && prayer.athan) {
        prayer.iqamah = toTime(toMin(prayer.athan) + prayer.iqamahOffset);
        if (inp('iqamah')) inp('iqamah').value = prayer.iqamah;
      }
    } else {
      prayer[field] = value;
      if (field === 'athan' && prayer.id !== 'sunrise' && prayer.iqamahOffset != null && value) {
        // Athan moved -> Iqamah keeps its gap
        prayer.iqamah = toTime(toMin(value) + Number(prayer.iqamahOffset));
        if (inp('iqamah')) inp('iqamah').value = prayer.iqamah;
      }
      if (field === 'iqamah' && value && prayer.athan) {
        // Iqamah typed -> work out the gap
        prayer.iqamahOffset = (toMin(value) - toMin(prayer.athan) + 1440) % 1440;
        if (inp('iqamahOffset')) inp('iqamahOffset').value = prayer.iqamahOffset;
      }
    }
    Storage.saveSettings(s);
    broadcastUpdate();
  }
}

function updateAutoModeVisibility(mode) {
  const autoPanel = document.getElementById('autoPrayerPanel');
  if (autoPanel) autoPanel.style.display = mode === 'auto' ? '' : 'none';
}

function savePrayerMode() {
  const s = Storage.getSettings();
  s.prayerMode       = getVal('prayerMode');
  s.prayerCalcMethod = parseInt(getVal('calcMethodSel')) || 1;
  s.asrMethod        = parseInt(getVal('asrMethodSel')) || 0;
  s.latitude         = parseFloat(getVal('latInput')) || 8.9833;
  s.longitude        = parseFloat(getVal('lngInput')) || 79.9000;
  Storage.saveSettings(s);
  updateAutoModeVisibility(s.prayerMode);
  broadcastUpdate();
  showToast('Prayer mode saved!', 'success');
}

async function fetchPrayerTimesNow() {
  const s = Storage.getSettings();
  try {
    await PrayerTimes.fetchAndCache(s);
    showToast('Prayer times calculated and cached for 30 days!', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============================================================
// IQAMAH SETTINGS
// ============================================================
function loadIqamahSettings() {
  const s = Storage.getSettings();
  setVal('iqamahLeadInput', s.iqamahLeadMinutes != null ? s.iqamahLeadMinutes : 5);
  setVal('iqamahScreenSecInput', s.iqamahScreenSeconds != null ? s.iqamahScreenSeconds : 60);
  setVal('iqamahMessagesInput', (s.iqamahMessages || []).join('\n'));
  setChecked('shafEnabled', s.shafEnabled !== false);
  setVal('shafMinutesInput', s.shafMinutes != null ? s.shafMinutes : 10);
}

function saveIqamahSettings() {
  const s = Storage.getSettings();
  s.iqamahLeadMinutes = Math.max(1, parseInt(getVal('iqamahLeadInput')) || 5);
  const sec = parseInt(getVal('iqamahScreenSecInput'));
  s.iqamahScreenSeconds = isNaN(sec) ? 60 : Math.max(0, sec);
  s.iqamahMessages = getVal('iqamahMessagesInput').split('\n').map(x => x.trim()).filter(Boolean);
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Iqamah settings saved!', 'success');
}

// Straighten-the-rows picture (shown after Iqamah)
function saveShafSettings() {
  const s = Storage.getSettings();
  s.shafEnabled = getChecked('shafEnabled');
  s.shafMinutes = Math.max(1, parseInt(getVal('shafMinutesInput')) || 10);
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Picture settings saved!', 'success');
}

async function uploadShafImage(file) {
  if (!file) return;
  const id = 'shaf-img-' + Date.now();
  await Storage.saveImage(id, file, { name: file.name });
  const s = Storage.getSettings();
  s.shafImageId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Picture uploaded!', 'success');
}

function resetShafImage() {
  const s = Storage.getSettings();
  s.shafImageId = null;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Using the built-in picture', 'success');
}

// ============================================================
// CLOCK SETTINGS
// ============================================================
function loadClockSettings() {
  const s = Storage.getSettings();
  setChecked('clockEnabled', s.clockEnabled !== false);
  setChecked('analogClockEnabled', s.analogClockEnabled !== false);
  setChecked('digitalClockEnabled', s.digitalClockEnabled !== false);
  setVal('clockDiameterInput', s.clockDiameter || 540);
  updateRangeDisplay('clockDiameterInput', 'clockDiameterVal', 'px');
  setVal('hijriOffsetInput', s.hijriOffset || 0);
  setVal('sunriseRangeInput', s.sunriseRangeMinutes != null ? s.sunriseRangeMinutes : 15);
  setVal('slideGapInput', s.slideGapSeconds != null ? s.slideGapSeconds : 10);
  setChecked('nextPillCheck', s.nextPrayerPill !== false);
  setVal('clockHandColorPicker', s.clockHandColor || '#c8972a');
  setVal('clockNumberColorPicker', s.clockNumberColor || '#ffffff');
  setVal('clockBorderColorPicker', s.clockBorderColor || '#c8972a');
  setVal('clockBgColorPicker',  s.colorClockBg || 'rgba(10,30,60,0.85)');
}

function saveClockSettings() {
  const s = Storage.getSettings();
  s.clockEnabled        = getChecked('clockEnabled');
  s.analogClockEnabled  = getChecked('analogClockEnabled');
  s.digitalClockEnabled = getChecked('digitalClockEnabled');
  s.clockDiameter       = parseInt(getVal('clockDiameterInput')) || 540;
  s.hijriOffset         = parseInt(getVal('hijriOffsetInput')) || 0;
  { const r = parseInt(getVal('sunriseRangeInput')); s.sunriseRangeMinutes = isNaN(r) ? 15 : r; }
  { const g = parseInt(getVal('slideGapInput'));     s.slideGapSeconds    = isNaN(g) ? 10 : g; }
  s.nextPrayerPill      = getChecked('nextPillCheck');
  s.clockHandColor      = getVal('clockHandColorPicker');
  s.clockNumberColor    = getVal('clockNumberColorPicker');
  s.clockBorderColor    = getVal('clockBorderColorPicker');
  s.colorClockBg        = getVal('clockBgColorPicker');
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Clock settings saved!', 'success');
}

// ============================================================
// ATHAN SETTINGS
// ============================================================
function loadAthanSettings() {
  const s = Storage.getSettings();
  setVal('athanDurationInput', s.athanDuration || 120);
  setVal('athanMessageInput',  s.athanMessage  || 'Come to Prayer!');
  setVal('preAthanInput', s.preAthanMinutes != null ? s.preAthanMinutes : 5);
  setVal('athanStyleSel', s.athanScreenStyle || 'progress');
}

function saveAthanSettings() {
  const s = Storage.getSettings();
  s.athanDuration = parseInt(getVal('athanDurationInput')) || 120;
  s.athanMessage  = getVal('athanMessageInput');
  { const m = parseInt(getVal('preAthanInput')); s.preAthanMinutes = isNaN(m) ? 5 : Math.max(0, m); }
  s.athanScreenStyle = getVal('athanStyleSel') || 'progress';
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Athan settings saved!', 'success');
}

async function uploadAthanAudio(file) {
  if (!file) return;
  const id = 'athan-audio';
  await Storage.saveImage(id, file, { name: file.name, type: 'audio' });
  const s = Storage.getSettings();
  s.athanAudioId = id;
  Storage.saveSettings(s);
  showToast('Athan audio uploaded!', 'success');
}

async function uploadAthanBg(file) {
  if (!file) return;
  const id = 'athan-bg-' + Date.now();
  await Storage.saveImage(id, file, { name: file.name, type: 'athan-bg' });
  const s = Storage.getSettings();
  s.athanBgId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Athan background uploaded!', 'success');
}

function previewAthan() {
  window.open('index.html?demo=all', '_blank');
  showToast('Playing Time to Athan → Athan → Towards Iqamah → Iqamah.', 'info');
}

async function testAthanAudio() {
  const s = Storage.getSettings();
  if (!s.athanAudioId) {
    showToast('No athan audio uploaded yet.', 'info');
    return;
  }
  try {
    const blob = await Storage.getImage(s.athanAudioId);
    if (!blob) { showToast('Audio file not found.', 'error'); return; }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => { showToast('Audio playback error.', 'error'); URL.revokeObjectURL(url); };
    const p = audio.play();
    if (p) p.then(() => showToast('Playing athan audio...', 'success')).catch(e => showToast('Playback blocked: ' + e.message, 'error'));
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ============================================================
// JUMMAH SETTINGS
// ============================================================
function loadJummahSettings() {
  const s = Storage.getSettings();
  setChecked('jummahEnabled', s.jummahEnabled !== false);
  setChecked('jummahAutoMode', s.jummahAutoMode !== false);
  setVal('jummahTimeInput',     s.jummahTime    || '12:30');
  setVal('jummahIqamahInput',   s.jummahIqamah  || '12:40');
  setVal('jummahKhutbahInput',  s.jummahKhutbahStart || '12:00');
  setVal('jummahTopicInput',    s.jummahTopic   || '');
  setVal('jummahKhateebInput',  s.jummahKhateeb || '');
  setVal('jummahMessageInput',  s.jummahMessage || 'JUMMAH MUBARAK');
  setVal('jummahNameInput',     s.jummahName || 'Jummah');
  setVal('jummahImageMinutesInput', s.jummahImageMinutes != null ? s.jummahImageMinutes : 20);
}

function saveJummahSettings() {
  const s = Storage.getSettings();
  s.jummahEnabled      = getChecked('jummahEnabled');
  s.jummahAutoMode     = getChecked('jummahAutoMode');
  s.jummahTime         = getVal('jummahTimeInput');
  s.jummahIqamah       = getVal('jummahIqamahInput');
  s.jummahKhutbahStart = getVal('jummahKhutbahInput');
  s.jummahTopic        = getVal('jummahTopicInput');
  s.jummahKhateeb      = getVal('jummahKhateebInput');
  s.jummahMessage      = getVal('jummahMessageInput');
  s.jummahName         = getVal('jummahNameInput').trim() || 'Jummah';
  { const m = parseInt(getVal('jummahImageMinutesInput')); s.jummahImageMinutes = isNaN(m) ? 20 : Math.max(0, m); }
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Jummah settings saved!', 'success');
}

async function uploadJummahBg(file) {
  if (!file) return;
  const id = 'jummah-bg-' + Date.now();
  await Storage.saveImage(id, file, { name: file.name });
  const s = Storage.getSettings();
  s.jummahBgId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Jummah background uploaded!', 'success');
}

async function uploadJummahImage(file) {
  if (!file) return;
  const id = 'jummah-img-' + Date.now();
  await Storage.saveImage(id, file, { name: file.name });
  const s = Storage.getSettings();
  s.jummahImageId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Jummah picture uploaded!', 'success');
}

function resetJummahImage() {
  const s = Storage.getSettings();
  s.jummahImageId = null;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Jummah picture removed', 'success');
}

async function uploadKhateebPhoto(file) {
  if (!file) return;
  const id = 'khateeb-photo-' + Date.now();
  await Storage.saveImage(id, file, { name: file.name });
  const s = Storage.getSettings();
  s.jummahKhateebPhotoId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Khateeb photo uploaded!', 'success');
}

// ============================================================
// WALLPAPER MANAGEMENT
// ============================================================
async function loadWallpaperSection() {
  loadWallpaperControls();
  await renderImageLibrary('wallpaperGrid', 'wallpaper');
}

async function renderImageLibrary(gridId, type) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  const images = await Storage.getAllImages();
  const filtered = images.filter(img => !img.meta || img.meta.type === type || !img.meta.type || img.meta.type === 'wallpaper');

  const s = Storage.getSettings();

  for (const img of filtered) {
    const url = img.blob ? URL.createObjectURL(img.blob) : img.remoteUrl;
    const item = document.createElement('div');
    item.className = 'image-preview-item' + (img.id === s.backgroundId ? ' selected' : '');
    item.innerHTML = `
      <img src="${url}" alt="${img.meta?.name || img.id}">
      <button class="image-preview-delete" onclick="deleteImageFromLibrary('${img.id}', '${gridId}', '${type}')">✕</button>
    `;
    item.addEventListener('click', (e) => selectWallpaper(img.id, gridId, item));
    grid.appendChild(item);
  }
}

async function selectWallpaper(id, gridId, clickedEl) {
  const s = Storage.getSettings();
  s.backgroundId = id;
  Storage.saveSettings(s);
  broadcastUpdate();
  document.querySelectorAll(`#${gridId} .image-preview-item`).forEach(el => el.classList.remove('selected'));
  if (clickedEl) clickedEl.classList.add('selected');
  showToast('Background updated!', 'success');
}

async function uploadWallpaper(file) {
  if (!file) return;
  const id = 'wallpaper-' + Date.now();
  await Storage.saveImage(id, file, { name: file.name, type: 'wallpaper' });
  await renderImageLibrary('wallpaperGrid', 'wallpaper');
  showToast('Wallpaper uploaded!', 'success');
}

async function deleteImageFromLibrary(id, gridId, type) {
  if (!confirm('Delete this image?')) return;
  await Storage.deleteImage(id);
  const s = Storage.getSettings();
  if (s.backgroundId === id) { s.backgroundId = null; Storage.saveSettings(s); broadcastUpdate(); }
  await renderImageLibrary(gridId, type);
  showToast('Image deleted.', 'info');
}

function saveWallpaperSettings() {
  const s = Storage.getSettings();
  s.backgroundOpacity = parseFloat(getVal('bgOpacity')) || 1;
  s.backgroundBlur    = parseInt(getVal('bgBlur'))    || 0;
  s.backgroundOverlay = parseFloat(getVal('bgOverlay')) || 0.5;
  s.backgroundSize    = getVal('bgSize') || 'cover';
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Background settings saved!', 'success');
}

function loadWallpaperControls() {
  const s = Storage.getSettings();
  setVal('bgOpacity', s.backgroundOpacity != null ? s.backgroundOpacity : 1);
  setVal('bgBlur',    s.backgroundBlur    || 0);
  setVal('bgOverlay', s.backgroundOverlay != null ? s.backgroundOverlay : 0.5);
  setVal('bgSize',    s.backgroundSize    || 'cover');
  updateRangeDisplay('bgOpacity',  'bgOpacityVal', '');
  updateRangeDisplay('bgBlur',     'bgBlurVal', 'px');
  updateRangeDisplay('bgOverlay',  'bgOverlayVal', '');
}

// ============================================================
// SLIDES (Hadith / Quran / Reminders)
// ============================================================
async function loadSlidesSection() {
  const slides = await Storage.getAllSlides();
  renderSlideList(slides);
}

function renderSlideList(slides) {
  const list = document.getElementById('slideList');
  if (!list) return;
  list.innerHTML = '';
  for (const s of slides) {
    const item = document.createElement('div');
    item.className = 'slide-card';
    const preview = s.arabic || s.translation || '';
    item.innerHTML = `
      <div class="slide-card-content">
        <div class="slide-card-type">${s.type || 'reminder'} ${s.enabled ? '' : '— <span style="color:#e74c3c">Disabled</span>'}</div>
        <div class="slide-card-preview">${preview.slice(0,80)}${preview.length>80?'…':''}</div>
        ${s.source ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px">${s.source}</div>` : ''}
      </div>
      <div class="slide-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="editSlide('${s.id}')">✏ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSlideAdmin('${s.id}')">🗑</button>
      </div>
    `;
    list.appendChild(item);
  }
}

function openAddSlideModal(existingId = null) {
  const modal = document.getElementById('slideModal');
  if (!modal) return;
  const isEdit = !!existingId;

  let slide = { id: generateId(), type: 'hadith', enabled: true, arabic: '', translation: '', translationTamil: '', source: '', bgColor: 'rgba(10,30,60,0.95)', order: 0, duration: 8000 };

  if (isEdit) {
    Storage.getAllSlides().then(slides => {
      const found = slides.find(s => s.id === existingId);
      if (found) Object.assign(slide, found);
      populateSlideModal(modal, slide, isEdit);
    });
  } else {
    populateSlideModal(modal, slide, isEdit);
  }
}

function populateSlideModal(modal, slide, isEdit) {
  modal.querySelector('.modal-title').textContent = isEdit ? 'Edit Slide' : 'Add New Slide';
  document.getElementById('slideIdHidden').value     = slide.id;
  setVal('slideType',          slide.type);
  setChecked('slideEnabled',   slide.enabled !== false);
  setVal('slideArabic',        slide.arabic      || '');
  setVal('slideTranslation',   slide.translation || '');
  setVal('slideTamil',         slide.translationTamil || '');
  setVal('slideSource',        slide.source      || '');
  setVal('slideBgColor',       slide.bgColor     || 'rgba(10,30,60,0.95)');
  setVal('slideItemDuration', slide.duration    || 8000);
  setVal('slideOrder',         slide.order       || 0);
  modal.classList.add('open');
}

async function saveSlideModal() {
  const id      = getVal('slideIdHidden') || generateId();
  const slide = {
    id,
    type:            getVal('slideType'),
    enabled:         getChecked('slideEnabled'),
    arabic:          getVal('slideArabic'),
    translation:     getVal('slideTranslation'),
    translationTamil:getVal('slideTamil'),
    source:          getVal('slideSource'),
    bgColor:         getVal('slideBgColor'),
    duration:        parseInt(getVal('slideItemDuration')) || 8000,
    order:           parseInt(getVal('slideOrder')) || 0,
  };
  await Storage.saveSlide(slide);
  closeModal('slideModal');
  await loadSlidesSection();
  broadcastUpdate();
  showToast('Slide saved!', 'success');
}

async function editSlide(id) {
  openAddSlideModal(id);
}

async function deleteSlideAdmin(id) {
  if (!confirm('Delete this slide?')) return;
  await Storage.deleteSlide(id);
  await loadSlidesSection();
  broadcastUpdate();
  showToast('Slide deleted.', 'info');
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================
async function loadAnnouncementsSection() {
  const anns = await Storage.getAllAnnouncements();
  renderAnnouncementList(anns);
}

function renderAnnouncementList(anns) {
  const list = document.getElementById('announcementList');
  if (!list) return;
  list.innerHTML = '';
  if (anns.length === 0) {
    list.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px">No announcements yet. Click "Add Announcement" to create one.</p>';
    return;
  }
  for (const a of anns) {
    const isExpired = a.expiryDate && new Date(a.expiryDate) < new Date();
    const item = document.createElement('div');
    item.className = 'slide-card';
    item.innerHTML = `
      <div class="slide-card-content">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span class="info-badge ${isExpired ? 'badge-red' : 'badge-green'}">${isExpired ? 'Expired' : 'Active'}</span>
          ${a.priority > 0 ? `<span class="info-badge badge-gold">Priority ${a.priority}</span>` : ''}
        </div>
        <div class="slide-card-preview" style="font-size:16px;font-weight:700">${a.title || 'Untitled'}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:4px">${a.description ? a.description.slice(0,80) : ''}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:4px">
          ${a.date ? '📅 '+a.date : ''} ${a.time ? '🕐 '+a.time : ''} ${a.speaker ? '🎤 '+a.speaker : ''}
          ${a.expiryDate ? ' | Expires: '+a.expiryDate : ''}
        </div>
      </div>
      <div class="slide-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="editAnnouncement('${a.id}')">✏ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteAnnouncementAdmin('${a.id}')">🗑</button>
      </div>
    `;
    list.appendChild(item);
  }
}

function openAddAnnouncementModal(existingId = null) {
  const modal = document.getElementById('announcementModal');
  if (!modal) return;
  const isEdit = !!existingId;

  let ann = {
    id: generateId(), title: '', description: '', date: '', time: '', speaker: '',
    enabled: true, priority: 0, startDate: '', expiryDate: '',
    bgColor: 'rgba(10,30,60,0.95)'
  };

  if (isEdit) {
    Storage.getAllAnnouncements().then(anns => {
      const found = anns.find(a => a.id === existingId);
      if (found) Object.assign(ann, found);
      populateAnnModal(modal, ann, isEdit);
    });
  } else {
    populateAnnModal(modal, ann, isEdit);
  }
}

function populateAnnModal(modal, ann, isEdit) {
  modal.querySelector('.modal-title').textContent = isEdit ? 'Edit Announcement' : 'Add Announcement';
  document.getElementById('annIdHidden').value  = ann.id;
  setVal('annTitle',       ann.title       || '');
  setVal('annDescription', ann.description || '');
  setVal('annDate',        ann.date        || '');
  setVal('annTime',        ann.time        || '');
  setVal('annSpeaker',     ann.speaker     || '');
  setVal('annPriority',    ann.priority    || 0);
  setVal('annStartDate',   ann.startDate   || '');
  setVal('annExpiryDate',  ann.expiryDate  || '');
  setChecked('annEnabled', ann.enabled !== false);
  modal.classList.add('open');
}

async function saveAnnouncementModal() {
  const ann = {
    id:          getVal('annIdHidden') || generateId(),
    title:       getVal('annTitle'),
    description: getVal('annDescription'),
    date:        getVal('annDate'),
    time:        getVal('annTime'),
    speaker:     getVal('annSpeaker'),
    priority:    parseInt(getVal('annPriority')) || 0,
    startDate:   getVal('annStartDate'),
    expiryDate:  getVal('annExpiryDate'),
    enabled:     getChecked('annEnabled'),
  };
  await Storage.saveAnnouncement(ann);
  closeModal('announcementModal');
  await loadAnnouncementsSection();
  broadcastUpdate();
  showToast('Announcement saved!', 'success');
}

async function editAnnouncement(id) {
  openAddAnnouncementModal(id);
}

async function deleteAnnouncementAdmin(id) {
  if (!confirm('Delete this announcement?')) return;
  await Storage.deleteAnnouncement(id);
  await loadAnnouncementsSection();
  broadcastUpdate();
  showToast('Announcement deleted.', 'info');
}

// ============================================================
// TICKER SETTINGS
// ============================================================
function loadTickerSettings() {
  const s = Storage.getSettings();
  setChecked('tickerEnabled', s.tickerEnabled !== false);
  setVal('tickerSpeed',      s.tickerSpeed || 60);
  setVal('tickerSeparator',  s.tickerSeparator || '  ◆  ');
  setVal('tickerFontSizeInput', s.tickerFontSize || 20);
  setChecked('tickerBold',  s.tickerBold || false);
  setVal('tickerBgColor',    s.colorTickerBg   || '#050f28');
  setVal('tickerTextColor',  s.colorTickerText || '#f0d080');
  updateRangeDisplay('tickerSpeed', 'tickerSpeedVal', '');
  renderTickerMessages(s.tickerMessages || []);
}

function renderTickerMessages(messages) {
  const list = document.getElementById('tickerMsgList');
  if (!list) return;
  list.innerHTML = '';
  for (let i = 0; i < messages.length; i++) {
    const item = document.createElement('div');
    item.className = 'ticker-msg-item';
    item.innerHTML = `
      <input class="form-control" type="text" value="${escHtml(messages[i])}" data-ticker-index="${i}">
      <button class="btn btn-danger btn-sm" onclick="removeTickerMsg(${i})">✕</button>
    `;
    list.appendChild(item);
  }
}

function addTickerMessage() {
  const s = Storage.getSettings();
  if (!s.tickerMessages) s.tickerMessages = [];
  s.tickerMessages.push('New message');
  Storage.saveSettings(s);
  loadTickerSettings();
}

function removeTickerMsg(index) {
  const s = Storage.getSettings();
  s.tickerMessages.splice(index, 1);
  Storage.saveSettings(s);
  loadTickerSettings();
}

function saveTickerSettings() {
  const s = Storage.getSettings();
  s.tickerEnabled   = getChecked('tickerEnabled');
  s.tickerSpeed     = parseInt(getVal('tickerSpeed'))         || 60;
  s.tickerSeparator = getVal('tickerSeparator');
  s.tickerFontSize  = parseInt(getVal('tickerFontSizeInput')) || 20;
  s.tickerBold      = getChecked('tickerBold');
  s.colorTickerBg   = getVal('tickerBgColor');
  s.colorTickerText = getVal('tickerTextColor');

  // Collect messages from inputs
  const inputs = document.querySelectorAll('#tickerMsgList input[data-ticker-index]');
  s.tickerMessages = Array.from(inputs).map(inp => inp.value).filter(v => v.trim());

  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Ticker settings saved!', 'success');
}

// ============================================================
// LAYOUT SETTINGS
// ============================================================
function loadLayoutSettings() {
  const s = Storage.getSettings();
  setVal('sidebarWidthInput',   s.sidebarWidth    || 678);
  setVal('headerHeightInput',   s.headerHeight    || 171);
  setVal('tickerHeightInput',   s.tickerHeight    || 86);
  setVal('prayerFontSizeInput', s.prayerFontSize  || 80);
  setVal('mosqueNameFsInput',   s.mosqueNameFontSize || 62);
  setVal('tickerFontSizeLayout', s.tickerFontSize  || 42);
  setVal('dateFontSizeInput',   s.dateFontSize    || 38);
  setVal('creditPositionSel',   s.creditPosition  || 'bottom-center');
  setVal('creditFontSizeInput', s.creditFontSize  || 14);
  setChecked('creditVisibleCheck', s.creditVisible !== false);
  updateRangeDisplay('sidebarWidthInput',   'sidebarWidthVal',   'px');
  updateRangeDisplay('headerHeightInput',   'headerHeightVal',   'px');
  updateRangeDisplay('tickerHeightInput',   'tickerHeightVal',   'px');
  updateRangeDisplay('prayerFontSizeInput', 'prayerFontSizeVal', 'px');
  updateRangeDisplay('mosqueNameFsInput',   'mosqueNameFsVal',   'px');
}

function saveLayoutSettings() {
  const s = Storage.getSettings();
  s.sidebarWidth     = parseInt(getVal('sidebarWidthInput'))   || 678;
  s.headerHeight     = parseInt(getVal('headerHeightInput'))   || 171;
  s.tickerHeight     = parseInt(getVal('tickerHeightInput'))   || 86;
  s.prayerFontSize   = parseInt(getVal('prayerFontSizeInput')) || 80;
  s.mosqueNameFontSize = parseInt(getVal('mosqueNameFsInput')) || 62;
  s.tickerFontSize   = parseInt(getVal('tickerFontSizeLayout'))|| 42;
  s.dateFontSize     = parseInt(getVal('dateFontSizeInput'))   || 38;
  s.creditPosition   = getVal('creditPositionSel');
  s.creditFontSize   = parseInt(getVal('creditFontSizeInput')) || 14;
  s.creditVisible    = getChecked('creditVisibleCheck');
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Layout settings saved!', 'success');
}

// ============================================================
// COLOURS & THEMES
// ============================================================
function loadColourSettings() {
  const s = Storage.getSettings();
  setVal('cpPrimary',     s.colorPrimary        || '#1a3a5c');
  setVal('cpSecondary',   s.colorSecondary      || '#c8972a');
  setVal('cpAccent',      s.colorAccent         || '#2a6496');
  setVal('cpText',        s.colorText           || '#ffffff');
  setVal('cpSidebarBg',   s.colorSidebarBg      || '#0a1e3c');
  setVal('cpHeaderBg',    s.colorHeaderBg       || '#0a1e3c');
  setVal('cpActivePrayer',s.colorActivePrayer   || '#c8972a');
  setVal('cpTickerBg',    s.colorTickerBg       || '#050f28');
  setVal('cpTickerText',  s.colorTickerText     || '#f0d080');
  setVal('cpAnnBg',       s.colorAnnouncementBg || '#0a1e3c');

  // Highlight selected theme + layout cards
  document.querySelectorAll('.theme-card[data-theme]').forEach(card => {
    card.classList.toggle('selected', card.dataset.theme === s.theme);
  });
  document.querySelectorAll('.layout-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.layout === (s.layout || 'signature'));
  });
}

function applyThemePreset(theme) {
  const themes = {
    'islamic-blue': { colorPrimary: '#1a3a5c', colorSecondary: '#c8972a', colorAccent: '#2a6496', colorText: '#ffffff', colorSidebarBg: 'rgba(10,30,60,0.92)', colorHeaderBg: 'rgba(10,30,60,0.95)', colorTickerBg: 'rgba(5,15,40,0.95)', colorTickerText: '#f0d080' },
    'royal-gold':   { colorPrimary: '#3d2b00', colorSecondary: '#ffd700', colorAccent: '#b8860b', colorText: '#fff9e6', colorSidebarBg: 'rgba(60,40,0,0.92)', colorHeaderBg: 'rgba(50,35,0,0.95)', colorTickerBg: 'rgba(30,20,0,0.95)', colorTickerText: '#ffd700' },
    'emerald-green':{ colorPrimary: '#0a3d20', colorSecondary: '#c8972a', colorAccent: '#1a6b3d', colorText: '#e8f5e9', colorSidebarBg: 'rgba(5,40,20,0.92)', colorHeaderBg: 'rgba(5,40,20,0.95)', colorTickerBg: 'rgba(2,20,10,0.95)', colorTickerText: '#a5d6a7' },
    'modern-dark':  { colorPrimary: '#121212', colorSecondary: '#bb86fc', colorAccent: '#03dac6', colorText: '#e1e1e1', colorSidebarBg: 'rgba(18,18,18,0.95)', colorHeaderBg: 'rgba(10,10,10,0.98)', colorTickerBg: 'rgba(5,5,5,0.98)', colorTickerText: '#bb86fc' },
    'white-gold':   { colorPrimary: '#f0f0e8', colorSecondary: '#c8972a', colorAccent: '#d4a843', colorText: '#1a1a1a', colorSidebarBg: 'rgba(240,240,232,0.95)', colorHeaderBg: 'rgba(255,255,248,0.98)', colorTickerBg: 'rgba(200,151,42,0.95)', colorTickerText: '#1a1a1a' },
  };
  const s = Storage.getSettings();
  Object.assign(s, themes[theme] || {});
  s.theme = theme;
  Storage.saveSettings(s);
  broadcastUpdate();
  loadColourSettings();
  showToast('Theme applied: ' + theme, 'success');
}

function saveColourSettings() {
  const s = Storage.getSettings();
  s.colorPrimary        = getVal('cpPrimary');
  s.colorSecondary      = getVal('cpSecondary');
  s.colorAccent         = getVal('cpAccent');
  s.colorText           = getVal('cpText');
  s.colorSidebarBg      = getVal('cpSidebarBg');
  s.colorHeaderBg       = getVal('cpHeaderBg');
  s.colorActivePrayer   = getVal('cpActivePrayer');
  s.colorTickerBg       = getVal('cpTickerBg');
  s.colorTickerText     = getVal('cpTickerText');
  s.colorAnnouncementBg = getVal('cpAnnBg');
  s.theme = 'custom';
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Colour settings saved!', 'success');
}

// ============================================================
// BACKUP & RESTORE
// ============================================================
function loadBackupSection() {
  const s = Storage.getSettings();
  const lastFetch = s.lastPrayerFetch ? new Date(s.lastPrayerFetch).toLocaleString() : 'Never';
  const el = document.getElementById('lastFetchDate');
  if (el) el.textContent = lastFetch;
}

async function exportBackup() {
  try {
    const data = await Storage.exportBackup();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `masjid-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported successfully!', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function importBackup(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await Storage.importBackup(data);
    broadcastUpdate();
    showToast('Backup restored! Reload the display for full effect.', 'success');
    loadSection('backup');
  } catch (err) {
    showToast('Import failed: ' + err.message, 'error');
  }
}

async function resetToDefaults() {
  if (!confirm('This will reset ALL settings to defaults and clear slides and announcements. Are you sure?')) return;
  await Storage.resetAll();
  broadcastUpdate();
  showToast('Settings reset to defaults.', 'info');
  loadSection('general');
}

// ============================================================
// ADVANCED SETTINGS
// ============================================================
function loadAdvancedSettings() {
  const s = Storage.getSettings();
  setVal('adminPinInput', s.adminPin || '1234');
  setVal('slideDurationInput', s.slideDuration || 8000);
  setVal('slideTransitionSel', s.slideTransition || 'fade');
  setChecked('slideshowEnabled', s.slideshowEnabled !== false);
}

function saveAdvancedSettings() {
  const s = Storage.getSettings();
  const newPin = getVal('adminPinInput');
  if (newPin && /^\d{4,8}$/.test(newPin)) {
    s.adminPin = newPin;
  } else if (newPin) {
    showToast('PIN must be 4-8 digits.', 'error');
    return;
  }
  s.slideDuration  = parseInt(getVal('slideDurationInput'))  || 8000;
  s.slideTransition = getVal('slideTransitionSel') || 'fade';
  s.slideshowEnabled = getChecked('slideshowEnabled');
  Storage.saveSettings(s);
  broadcastUpdate();
  showToast('Advanced settings saved!', 'success');
}

// ============================================================
// HELPERS
// ============================================================
function broadcastUpdate() {
  // Trigger storage event for the display window
  const s = Storage.getSettings();
  Storage.saveSettings(s);
  // Also dispatch custom event for same-tab updates
  window.dispatchEvent(new CustomEvent('masjidSettingsUpdated', { detail: s }));
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = (val != null ? val : '');
}

function getChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function updateRangeDisplay(inputId, valId, unit) {
  const input = document.getElementById(inputId);
  const valEl = document.getElementById(valId);
  if (!input || !valEl) return;
  valEl.textContent = input.value + unit;
  input.addEventListener('input', () => { valEl.textContent = input.value + unit; });
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openDisplayWindow() {
  window.open('index.html', 'masjidDisplay', 'width=1920,height=1080');
}

// ============================================================
// INIT ADMIN APP
// ============================================================
function initAdminApp() {
  // Show network status
  document.querySelectorAll('.network-status').forEach(el => {
    el.style.display = 'inline-flex';
    el.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
    el.className = 'network-status ' + (navigator.onLine ? 'online' : 'offline');
  });

  window.addEventListener('online',  () => { document.querySelectorAll('.network-status').forEach(el => { el.textContent = '🟢 Online'; el.className = 'network-status online'; }); });
  window.addEventListener('offline', () => { document.querySelectorAll('.network-status').forEach(el => { el.textContent = '🔴 Offline'; el.className = 'network-status offline'; }); });

  // Wire range inputs
  ['sidebarWidthInput','headerHeightInput','tickerHeightInput','prayerFontSizeInput','mosqueNameFsInput','clockDiameterInput','bgOpacity','bgBlur','bgOverlay','tickerSpeed'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = document.getElementById(id.replace('Input','') + 'Val') || document.getElementById(id + 'Val');
      if (val) val.textContent = el.value + (el.id.includes('Color') ? '' : (el.id.includes('opacity') || el.id.includes('Overlay') ? '' : 'px'));
    });
  });

  initNav();
  loadSection('general');

  // Wire save buttons in sections
  wireButton('saveGeneralBtn',     saveGeneralSettings);
  wireButton('saveMosqueBtn',      saveMosqueInfo);
  wireButton('savePrayerModeBtn',  savePrayerMode);
  wireButton('fetchPrayersBtn',    fetchPrayerTimesNow);
  wireButton('saveIqamahBtn',      saveIqamahSettings);
  wireButton('saveClockBtn',       saveClockSettings);
  wireButton('saveAthanBtn',       saveAthanSettings);
  wireButton('previewAthanBtn',    previewAthan);
  wireButton('testAthanAudioBtn',  testAthanAudio);
  wireButton('saveJummahBtn',      saveJummahSettings);
  wireButton('saveShafBtn',        saveShafSettings);
  wireButton('resetShafImageBtn',  resetShafImage);
  wireButton('resetJummahImageBtn', resetJummahImage);
  wireButton('saveWallpaperBtn',   saveWallpaperSettings);
  wireButton('saveTickerBtn',      saveTickerSettings);
  wireButton('addTickerMsgBtn',    addTickerMessage);
  wireButton('saveLayoutBtn',      saveLayoutSettings);
  wireButton('saveColoursBtn',     saveColourSettings);
  wireButton('exportBackupBtn',    exportBackup);
  wireButton('resetDefaultsBtn',   resetToDefaults);
  wireButton('saveAdvancedBtn',    saveAdvancedSettings);
  wireButton('openDisplayBtn',     openDisplayWindow);

  // Slide modal
  wireButton('addSlideBtn',        () => openAddSlideModal());
  wireButton('saveSlideBtn',       saveSlideModal);
  wireButton('cancelSlideBtn',     () => closeModal('slideModal'));

  // Announcement modal
  wireButton('addAnnBtn',          () => openAddAnnouncementModal());
  wireButton('saveAnnBtn',         saveAnnouncementModal);
  wireButton('cancelAnnBtn',       () => closeModal('announcementModal'));

  // File upload handlers
  wireFileInput('logoUpload',       file => uploadLogo(file));
  wireFileInput('wallpaperUpload',  file => uploadWallpaper(file));
  wireFileInput('athanAudioUpload', file => uploadAthanAudio(file));
  wireFileInput('athanBgUpload',    file => uploadAthanBg(file));
  wireFileInput('jummahBgUpload',   file => uploadJummahBg(file));
  wireFileInput('shafImageUpload',  file => uploadShafImage(file));
  wireFileInput('jummahImageUpload', file => uploadJummahImage(file));
  wireFileInput('khateebPhotoUpload', file => uploadKhateebPhoto(file));
  wireFileInput('backupImport',     file => importBackup(file));

  // Theme cards
  document.querySelectorAll('.theme-card[data-theme]').forEach(card => {
    card.addEventListener('click', () => applyThemePreset(card.dataset.theme));
  });
  document.querySelectorAll('.layout-card').forEach(card => {
    card.addEventListener('click', () => {
      const st = Storage.getSettings();
      st.layout = card.dataset.layout;
      Storage.saveSettings(st);
      broadcastUpdate();
      loadColourSettings();
      showToast('Layout applied: ' + card.dataset.layout, 'success');
    });
  });
  wireButton('previewIqamahBtn', () => showToast('On the display press Ctrl+Shift+3 (or open index.html?demo=iqamah)', 'info', 5000));

  // Prayer mode toggle
  const prayerModeSel = document.getElementById('prayerMode');
  if (prayerModeSel) {
    prayerModeSel.addEventListener('change', () => updateAutoModeVisibility(prayerModeSel.value));
  }

  // Wallpaper controls
  loadWallpaperControls();
}

function wireButton(id, fn) {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', fn);
}

function wireFileInput(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', e => { if (e.target.files[0]) fn(e.target.files[0]); });
}

// Boot on load
window.addEventListener('masjid-sync-error', e => showToast(e.detail, 'error', 6000));
window.addEventListener('masjid-synced', () => showToast('Saved to server ✔', 'success', 1500));
window.addEventListener('masjid-auth-failed', () => { showToast('Wrong admin token — re-enter it.', 'error', 5000); askAdminToken(true); });

// The server (Vercel) needs the ADMIN_TOKEN once per browser to accept changes
function askAdminToken(force) {
  if (!Storage.hasRemote()) return;
  if (Storage.getToken() && !force) return;
  const t = prompt('Admin token (the ADMIN_TOKEN you set on Vercel).\nNeeded to save changes to the server:');
  if (t) { Storage.setToken(t.trim()); Storage.pushNow(); }
}

document.addEventListener('DOMContentLoaded', async () => {
  await Storage.openDB();
  await Storage.syncFromServer();     // get the latest settings/images from the server first
  initLogin();
});
