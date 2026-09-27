// ==================================================
// Taraclia&Shop — Service Worker (PWA, оффлайн)
// ==================================================

const CACHE_NAME = 'taraclia-shop-v1';

// Что кэшируем при первой загрузке
const ASSETS = [
    './',
    './index.html'
];

// ==================================================
// УСТАНОВКА — кэшируем основные файлы
// ==================================================
self.addEventListener('install', (event) => {
    console.log('[SW] Установка...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Кэширую файлы');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// ==================================================
// АКТИВАЦИЯ — удаляем старые кэши
// ==================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Активация...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Удаляю старый кэш:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ==================================================
// FETCH — стратегия: сначала кэш, потом сеть
// ==================================================
self.addEventListener('fetch', (event) => {
    // Пропускаем запросы к Firebase, Telegram и другим API — они должны идти в сеть
    const url = event.request.url;
    if (
        url.includes('firestore.googleapis.com') ||
        url.includes('firebaseio.com') ||
        url.includes('api.telegram.org') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        event.request.method !== 'GET'
    ) {
        return; // не трогаем — идёт напрямую в сеть
    }

    // Для остальных — сначала кэш, если нет — сеть
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // Кэшируем успешные GET-ответы
                if (
                    networkResponse &&
                    networkResponse.status === 200 &&
                    networkResponse.type === 'basic'
                ) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Если сеть недоступна и в кэше нет — показываем index.html
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
