// public/sw.js

// Instalasi Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Langsung aktifkan SW baru
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); // Ambil kendali halaman segera
});

// Menangani klik pada notifikasi
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Jika tab aplikasi sudah terbuka, fokuskan ke tab itu
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) return client.focus();
            }
            // Jika tidak ada, buka tab baru
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});