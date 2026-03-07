// public/sw.js
// Script ini berjalan di background browser, terpisah dari App.vue

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('ZieSen Background System Activated');
});

// Menangani notifikasi push atau trigger background
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Buka kembali aplikasi saat notifikasi diklik
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Logic getar sistemik melalui Push (Opsional jika pakai backend)
self.addEventListener('push', (event) => {
    const options = {
        body: 'Anda belum absen hari ini! Segera lakukan absensi.',
        icon: '/favicon.ico',
        vibrate: [500, 110, 500, 110, 450], // Getar HP
        badge: '/favicon.ico',
        tag: 'absen-reminder',
        renotify: true
    };
    event.waitUntil(
        self.registration.showNotification('ZieSen Reminder', options)
    );
});