// Service Worker para UPN Control Docente
// Soporte para Notificaciones Push y Alertas en Segundo Plano

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Manejador de clics en las notificaciones para enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Manejador de eventos push del servidor
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : 'Alerta de Control Docente UPN' };
  }

  const title = data.title || '🔔 UPN Control Docente';
  const options = {
    body: data.body || 'Alerta de ronda docente',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'upn-alert',
    renotify: true,
    requireInteraction: true,
    data: data.data || {}
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
