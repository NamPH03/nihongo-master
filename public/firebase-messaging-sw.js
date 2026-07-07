// public/firebase-messaging-sw.js
// Service Worker xử lý push notification khi app đóng (background)
// iOS 16.4+ PWA yêu cầu file này tại root public/

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBAerv56pYND3CpTWaa8SxhlcVrTxpKlRY",
  authDomain: "japanesewithnamph.firebaseapp.com",
  projectId: "japanesewithnamph",
  storageBucket: "japanesewithnamph.firebasestorage.app",
  messagingSenderId: "861167804007",
  appId: "1:861167804007:web:ed9f14b8f26e16d076fec2",
});

const messaging = firebase.messaging();

// Nhận thông báo khi app đang ở background / đóng
messaging.onBackgroundMessage(function (payload) {
  const { title, body, icon } = payload.notification || {};

  self.registration.showNotification(title || 'Nihongo Master', {
    body: body || 'Đến giờ học tiếng Nhật rồi!',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'nihongo-master',
    data: payload.data || {},
    requireInteraction: false,
  });
});

// Khi người dùng bấm vào thông báo → mở app
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Nếu app đang mở → focus vào đó
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Nếu app đóng → mở tab mới
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
