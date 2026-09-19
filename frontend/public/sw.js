/* Service worker de Viáticos VH.
 * Solo guarda el "cascarón" de la app (HTML, JS, CSS, fuentes e iconos) para que abra
 * rápido y se pueda instalar. NUNCA guarda /api ni /uploads: son datos privados con sesión. */
const VERSION = 'v1'
const CACHE = `viaticos-shell-${VERSION}`
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('viaticos-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return // siempre a la red

  // Páginas: red primero (para tener siempre la versión nueva); sin red, el cascarón guardado
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }

  // Recursos con nombre con hash (/assets/…): no cambian, se sirven del caché
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)) }
        return res
      })),
    )
  }
})
