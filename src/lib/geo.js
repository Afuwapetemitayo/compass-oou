export const xy = (lat, lng) => { const k = 111320; return [(lng - 3.87) * k * Math.cos(6.9215 * Math.PI / 180), -(lat - 6.9215) * k] }
export const ll = (x, y) => { const k = 111320; return [(-y / k) + 6.9215, x / (k * Math.cos(6.9215 * Math.PI / 180)) + 3.87] }
export const onCampus = (la, lo) => la > 6.905 && la < 6.94 && lo > 3.86 && lo < 3.885
export const inOOUBounds = (la, lo) => la >= 6.90 && la <= 6.95 && lo >= 3.85 && lo <= 3.89
export function askLocation(cb) {
  let done = false
  const fin = (p, e) => { if (done) return; done = true; clearTimeout(tm); cb(p, e) }
  const tm = setTimeout(() => fin(null, 'timeout'), 7000)
  if (!navigator.geolocation) { fin(null, 'unsupported'); return }
  try { navigator.geolocation.getCurrentPosition(p => fin(p), e => fin(null, e || 'denied'), { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }) } catch (e) { fin(null, e) }
}

// straight-line distance in km between two lat/lng points
export const distKm = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r, h = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)) }
