/* YUKU Web Push service worker.
 * Receives server-sent push messages and displays them to the user.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Notifikasi YUKU';
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Ada pembaruan baru di akun YUKU Anda.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : 'yuku-notification',
    data: { url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/' },
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data && event.notification.data.url ? event.notification.data.url : '/',
    self.location.origin,
  ).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client && client.url !== targetUrl) await client.navigate(targetUrl);
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
