// ============================================================================
// CHATVISTA - Service Worker for PWA
// Provides offline support, caching, and push notifications
// ============================================================================

const CACHE_NAME = 'chatvista-v1';
const STATIC_CACHE = 'chatvista-static-v1';
const DYNAMIC_CACHE = 'chatvista-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.json',
  '/favicon.png',
  '/icon.png',
  '/logo.png',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(asset => !asset.includes('offline')));
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.log('[SW] Cache failed:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests - always go to network
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return;
  }

  // Skip WebSocket and media requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  if (request.destination === 'video' || request.destination === 'audio') return;

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update in background
          event.waitUntil(updateCache(request));
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (request.destination === 'document') {
              return caches.match('/') || new Response(
                '<!DOCTYPE html><html><head><title>ChatVista - Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111827;color:white;text-align:center;padding:20px}h1{margin-bottom:10px}p{opacity:0.7}</style></head><body><div><h1>You\'re Offline</h1><p>Please check your internet connection and try again.</p></div></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            }
            return new Response('', { status: 503 });
          });
      })
  );
});

// Update cache in background
async function updateCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, response);
    }
  } catch (err) {
    // Network error, ignore
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from ChatVista',
      icon: '/icon.png',
      badge: '/icon.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
        ...data
      },
      actions: data.actions || [],
      tag: data.tag || 'chatvista-notification',
      renotify: true
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'ChatVista', options)
    );
  } catch (err) {
    console.error('[SW] Push notification error:', err);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Implement offline message sync when back online
  console.log('[SW] Syncing offline messages...');
}

console.log('[SW] Service worker loaded');
