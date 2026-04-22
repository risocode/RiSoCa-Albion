import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/** Cache render.albiononline.com PNGs across sessions (see public/sw.js). */
function registerIconCacheWorker() {
  if (!('serviceWorker' in navigator)) return
  const canUseSw =
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  if (!canUseSw) return

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      if (import.meta.env.DEV) void reg.update()
    })
    .catch((err) => {
      console.warn('[albion-craft] service worker not registered:', err)
    })
}

registerIconCacheWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
