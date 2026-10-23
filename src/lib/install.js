import { useEffect, useState } from 'react'

// The browser offers "install" only once, and only if we are listening early. Catch it here and keep it,
// so the Install button can use it whenever the person asks, not just when the browser pops up.
let deferred = null
const subs = new Set()
const tell = () => subs.forEach(f => f())
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; tell() })
  window.addEventListener('appinstalled', () => { deferred = null; tell() })
}
const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// state: 'installed' (already running as an app) | 'ready' (one tap installs) | 'ios' | 'manual' (show steps)
export function useInstall() {
  const [, bump] = useState(0)
  useEffect(() => { const f = () => bump(n => n + 1); subs.add(f); return () => subs.delete(f) }, [])
  const state = standalone() ? 'installed' : deferred ? 'ready' : isIOS() ? 'ios' : 'manual'
  const install = async () => {
    if (!deferred) return false
    import('./track').then(m => m.track('install_click')).catch(() => {})
    deferred.prompt(); const r = await deferred.userChoice.catch(() => null); deferred = null; tell(); return !!r && r.outcome === 'accepted'
  }
  return { state, install }
}
