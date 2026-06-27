/**
 * Service Worker for Tabungan & E-Kas RT
 * Version: 3.0.0
 * Strategy: Cache First (static), Network First (API)
 */

const CACHE_VERSION = 'ekas-rt-v3.0.0';
const STATIC_CACHE = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';
const API_CACHE = CACHE_VERSION + '-api';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  'https://unpkg.com/@phosphor-icons/web',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Asap+Condensed:wght@300;400;500;600;700&display=swap'
];

// ==================== INSTALL EVENT ====================
self.addEventListener('install', function(event) {
  console.log('[SW] Installing Service Worker v3.0.0...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS).catch(function(err) {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
      .then(function() {
        console.log('[SW] Skip waiting...');
        return self.skipWaiting();
      })
  );
});

// ==================== ACTIVATE EVENT ====================
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function(cacheName) {
              // Delete old cache versions
              return cacheName.startsWith('ekas-rt-') && 
                     cacheName !== STATIC_CACHE && 
                     cacheName !== DYNAMIC_CACHE && 
                     cacheName !== API_CACHE;
            })
            .map(function(cacheName) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(function() {
        console.log('[SW] Claiming clients...');
        return self.clients.claim();
      })
  );
});

// ==================== FETCH EVENT ====================
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') return;
  
  // Strategy: Network First for API calls (Google Apps Script)
  if (url.hostname === 'script.google.com' && url.pathname.includes('/macros/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Strategy: Cache First for static assets (CDN, fonts)
  if (
    url.hostname === 'unpkg.com' ||
    url.hostname === 'cdn.tailwindcss.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'cdnjs.cloudflare.com' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // Strategy: Network First for everything else
  event.respondWith(networkFirst(event.request));
});

// ==================== CACHE STRATEGIES ====================

// Cache First: Return from cache, fallback to network
function cacheFirst(request) {
  return caches.match(request)
    .then(function(cachedResponse) {
      if (cachedResponse) {
        // Update cache in background
        updateCache(request, STATIC_CACHE);
        return cachedResponse;
      }
      
      return fetch(request)
        .then(function(networkResponse) {
          return caches.open(STATIC_CACHE)
            .then(function(cache) {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
        })
        .catch(function() {
          return offlineFallback(request);
        });
    });
}

// Network First: Try network, fallback to cache
function networkFirst(request) {
  return fetch(request)
    .then(function(networkResponse) {
      // Cache successful responses
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(API_CACHE)
          .then(function(cache) {
            cache.put(request, responseToCache);
          });
      }
      return networkResponse;
    })
    .catch(function() {
      // Network failed, try cache
      return caches.match(request)
        .then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          return offlineFallback(request);
        });
    });
}

// ==================== HELPERS ====================

// Update cache in background
function updateCache(request, cacheName) {
  fetch(request)
    .then(function(response) {
      if (response && response.status === 200) {
        caches.open(cacheName)
          .then(function(cache) {
            cache.put(request, response);
          });
      }
    })
    .catch(function() {
      // Silent fail for background updates
    });
}

// Offline fallback response
function offlineFallback(request) {
  // For API requests, return JSON error
  if (request.headers.get('Accept') && request.headers.get('Accept').includes('application/json')) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Kamu sedang offline. Data terakhir yang tersedia mungkin tidak terbaru.',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // For page requests, return HTML offline page
  return new Response(
    `<!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Tabungan & E-Kas RT</title>
      <style>
        body {
          font-family: 'Asap Condensed', sans-serif;
          background: #f9fafb;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
          padding: 20px;
          text-align: center;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 40px 30px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          max-width: 400px;
          width: 100%;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 22px;
          color: #0F766E;
          margin: 0 0 10px 0;
        }
        p {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }
        button {
          background: #0F766E;
          color: white;
          border: none;
          padding: 12px 28px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover {
          background: #115E59;
        }
        button:active {
          transform: scale(0.98);
        }
        @media (prefers-color-scheme: dark) {
          body { background: #111827; }
          .card { background: #1F2937; }
          h1 { color: #14B8A6; }
          p { color: #9ca3af; }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">📡</div>
        <h1>Kamu Sedang Offline</h1>
        <p>
          Tidak ada koneksi internet. Beberapa fitur mungkin tidak tersedia.
          Coba periksa koneksi internet kamu.
        </p>
        <button onclick="window.location.reload()">
          Coba Lagi
        </button>
      </div>
    </body>
    </html>`,
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// ==================== PUSH NOTIFICATION (Optional) ====================
self.addEventListener('push', function(event) {
  let data = {
    title: 'E-Kas RT',
    body: 'Ada pembaruan data terbaru.',
    icon: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/wallet.svg'
  };
  
  if (event.data) {
    try {
      data = JSON.parse(event.data.text());
    } catch(e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.icon,
    vibrate: [200, 100, 200],
    tag: 'ekas-rt-notification',
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Focus existing window if available
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url && client.url.includes('/macros/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// ==================== MESSAGE HANDLER ====================
self.addEventListener('message', function(event) {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_VERSION') {
    // Send version info back to client
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      static: STATIC_CACHE,
      dynamic: DYNAMIC_CACHE,
      api: API_CACHE
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            return caches.delete(cacheName);
          })
        );
      }).then(function() {
        console.log('[SW] All caches cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('[SW] Service Worker v3.0.0 loaded and ready!');