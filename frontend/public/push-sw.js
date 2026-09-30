// Notificaciones push: el service worker de Workbox importa este archivo.
// El backend manda { title, body, url, tag }.

self.addEventListener('push', (event) => {
  let datos = {}
  try { datos = event.data ? event.data.json() : {} } catch { datos = { body: event.data?.text() } }

  event.waitUntil(
    self.registration.showNotification(datos.title || 'FinTracker', {
      body: datos.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: datos.tag || undefined,   // un aviso nuevo de la misma tarjeta reemplaza al anterior
      data: { url: datos.url || '/' },
    })
  )
})

// Al tocarla: si la app ya está abierta se enfoca y navega; si no, se abre
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const abierta = ventanas.find(v => v.url.startsWith(self.location.origin))
    if (abierta) {
      await abierta.focus()
      return abierta.navigate ? abierta.navigate(url) : undefined
    }
    return self.clients.openWindow(url)
  })())
})
