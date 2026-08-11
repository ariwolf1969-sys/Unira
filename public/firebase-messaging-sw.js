// Firebase Cloud Messaging Service Worker
// Handles background push notifications for Unira/TEYEVO

importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDE1GOSjZskt8LtGIFPh26bEBIPgJl6ASI",
  authDomain: "cooperativa-unira.firebaseapp.com",
  projectId: "cooperativa-unira",
  storageBucket: "cooperativa-unira.firebasestorage.app",
  messagingSenderId: "408829290850",
  appId: "1:408829290850:web:0a22a47d55ed4f6877e43b"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, data } = payload.notification || {};
  const notificationTitle = title || 'Unira';
  const notificationOptions: NotificationOptions = {
    body: body || '',
    icon: icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: data || {},
    vibrate: [200, 100, 200],
    tag: data?.tag || 'unira-notification',
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the app and navigate to the relevant screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If there's already an open window, focus it
        for (const client of clientList) {
          if (client.url.includes('unira.vercel.app') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
