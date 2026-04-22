/**
 * Caches Albion Online render PNGs (render.albiononline.com) in the Cache API
 * so weapon/resource icons load from disk on repeat visits.
 * Bump CACHE_NAME when you need to invalidate old entries.
 */
const CACHE_NAME = 'albion-render-icons-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('albion-render-icons-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.hostname !== 'render.albiononline.com') return
  if (!url.pathname.includes('/v1/item/')) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const hit = await cache.match(event.request, { ignoreVary: true })
      if (hit) return hit

      try {
        const res = await fetch(event.request)
        const cacheable = res.ok || res.type === 'opaque'
        if (cacheable) {
          try {
            await cache.put(event.request, res.clone())
          } catch {
            /* ignore quota / opaque put edge cases */
          }
        }
        return res
      } catch {
        const stale = await cache.match(event.request, { ignoreVary: true })
        if (stale) return stale
        return Response.error()
      }
    })()
  )
})
