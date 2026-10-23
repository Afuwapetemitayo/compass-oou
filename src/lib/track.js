import { backend } from './backend'

// Counts visits for the admin Overview, including people who have not signed up yet.
// It stores one random id on the phone (no name, no email) so the same phone is counted once.
const get = (s, k) => { try { return s.getItem(k) } catch { return null } }
const set = (s, k, v) => { try { s.setItem(k, v) } catch { /* ignore */ } }
export const vid = () => {
  let v = get(localStorage, 'compass-vid')
  if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); set(localStorage, 'compass-vid', v) }
  return v
}
export const track = type => { try { backend.logAnon && backend.logAnon({ type, vid: vid() }) } catch { /* ignore */ } }

// one visit per browser session, so a refresh does not count twice
export function trackVisit() {
  if (get(sessionStorage, 'compass-seen')) return
  set(sessionStorage, 'compass-seen', '1'); track('landing')
  // opened from the home screen icon: the app is installed on this phone (counted once per phone)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  if (standalone && !get(localStorage, 'compass-installed')) { set(localStorage, 'compass-installed', '1'); track('installed') }
}
window.addEventListener('appinstalled', () => { if (!get(localStorage, 'compass-installed')) { set(localStorage, 'compass-installed', '1'); track('installed') } })
