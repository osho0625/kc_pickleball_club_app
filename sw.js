/**
 * sw.js - Service Worker
 * Push通知の受信と表示を担当
 */

// Push通知受信
self.addEventListener('push', (event) => {
  let data = { title: '練習日のお知らせ', body: '' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'pickleball-notification',
    renotify: true,
    data: {
      url: self.registration.scope
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知クリック時にアプリを開く
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 既にアプリが開いている場合はフォーカス
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // 開いていない場合は新しいウィンドウで開く
      return clients.openWindow(urlToOpen);
    })
  );
});

// Service Worker インストール
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
