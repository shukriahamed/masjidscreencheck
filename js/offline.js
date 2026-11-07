/**
 * offline.js
 * Service Worker registration and offline status management
 */

const Offline = (() => {
  let isOnline = navigator.onLine;

  function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
          console.log('[Offline] Service Worker registered:', reg.scope);
          // Check for updates
          reg.addEventListener('updatefound', () => {
            console.log('[Offline] Service Worker update found.');
          });
        })
        .catch(err => {
          console.warn('[Offline] Service Worker registration failed:', err);
        });
    }

    // Online/offline events
    window.addEventListener('online', () => {
      isOnline = true;
      updateStatusIndicator(true);
      onConnectionRestored();
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      updateStatusIndicator(false);
    });

    updateStatusIndicator(navigator.onLine);
  }

  function updateStatusIndicator(online) {
    const indicators = document.querySelectorAll('.network-status');
    indicators.forEach(el => {
      el.textContent = online ? '🟢 Online' : '🔴 Offline';
      el.className = 'network-status ' + (online ? 'online' : 'offline');
    });
  }

  async function onConnectionRestored() {
    // Re-fetch prayer times when back online (auto mode)
    const settings = Storage.getSettings();
    if (settings.prayerMode === 'auto') {
      try {
        await PrayerTimes.fetchAndCache(settings);
        console.log('[Offline] Prayer times refreshed after reconnection.');
      } catch (e) {
        console.warn('[Offline] Failed to refresh prayer times:', e);
      }
    }
  }

  function getStatus() { return isOnline; }

  // Screen wake lock (prevent TV screen saver)
  let wakeLock = null;
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('[Offline] Wake lock acquired.');
        wakeLock.addEventListener('release', () => {
          console.log('[Offline] Wake lock released.');
        });
      } catch (e) {
        console.warn('[Offline] Wake lock not available:', e.message);
      }
    }
  }

  // Re-acquire wake lock when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  return { init, getStatus, requestWakeLock };
})();
