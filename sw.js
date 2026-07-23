// ============================================================
// ===== SERVICE WORKER PARA NOTIFICACIONES PUSH =====
// ============================================================

const CACHE_NAME = 'gestor-entregas-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/usuarios.html',
    '/styles.css',
    '/app.js',
    '/firebase-config.js'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Activar Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptar peticiones
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});

// Notificaciones push
self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <rect width="100" height="100" rx="20" fill="#ff6b35"/>
                <text x="50" y="70" font-size="60" text-anchor="middle">📦</text>
            </svg>
        `),
        badge: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <rect width="100" height="100" rx="20" fill="#ff6b35"/>
                <text x="50" y="70" font-size="60" text-anchor="middle">📦</text>
            </svg>
        `),
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: {
            url: data.url || '/usuarios.html'
        }
    };
    event.waitUntil(
        self.registration.showNotification(data.title || '📦 Nuevo Pedido', options)
    );
});

// Click en notificación
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});