// Service worker de FinTracker (VitePWA en modo injectManifest, igual que NutriFit)
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// La página (index.html) siempre se pide primero a la red: así una versión nueva
// llega en la primera apertura y no en la segunda, y las etiquetas que iOS lee al
// instalar (barra de estado) son las del último deploy. Sin red o si tarda más de
// 3 s, se usa la última que se guardó. Va antes del precache para ganarle la ruta "/".
registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: 'paginas', networkTimeoutSeconds: 3 })))

// JS, CSS e imágenes llevan hash en el nombre: servirlos desde caché es seguro
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// API: siempre intenta la red; sin señal, lo último que respondió (24 h)
registerRoute(
  /\/api\/.*/,
  new NetworkFirst({
    cacheName: 'fintracker-api',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// Google Fonts: no cambian, un año en caché
registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// registerType 'autoUpdate': la versión nueva toma el control apenas se instala
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// ── Notificaciones push ─────────────────────────────────────────────
// El backend manda { title, body, url, tag }.
self.addEventListener('push', (event) => {
  let datos
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
