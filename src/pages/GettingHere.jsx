import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../state'
import { ll, onCampus, distKm } from '../lib/geo'
import { slugify } from '../lib/places'
import Icon from '../components/Icon'
import { View } from '../components/ui'
import { isEntry } from './Arrive'

const TILES = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ROUTER = import.meta.env.VITE_ROUTER_URL || 'https://router.project-osrm.org'
const dot = (cls) => L.divIcon({ className: '', html: `<div class="gh-${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] })
const fmtKm = m => m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m) + ' m'
const fmtMin = s => { const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min' }

// The road from where you are to the school, drawn inside the app.
export default function GettingHere() {
  const nav = useNavigate()
  const [q] = useSearchParams()
  const { places, gps, toast } = useApp()
  const ways = useMemo(() => places.filter(p => p.x != null && isEntry(p)), [places])
  const [slug, setSlug] = useState(q.get('to') || 'school-park')
  const dest = useMemo(() => ways.find(p => slugify(p.n) === slug) || places.find(p => slugify(p.n) === slug && p.x != null) || ways[0], [ways, places, slug])
  const [fix, setFix] = useState(null)            // { la, lo }
  const [err, setErr] = useState('')
  const [route, setRoute] = useState(null)        // { coords, dist, dur }
  const [rErr, setRErr] = useState(false)
  const [follow, setFollow] = useState(true)
  const mapEl = useRef(null), map = useRef(null), layers = useRef({}), lastFetch = useRef({ at: 0, la: 0, lo: 0 }), watchId = useRef(null), fitted = useRef(false), followRef = useRef(true)
  followRef.current = follow
  const dll = dest ? (dest.lat != null ? [dest.lat, dest.lng] : ll(dest.x, dest.y)) : null

  // create the map once
  useEffect(() => {
    const m = L.map(mapEl.current, { zoomControl: false, attributionControl: true }).setView([6.9215, 3.87], 13)
    m.attributionControl.setPrefix(false)
    L.tileLayer(TILES, { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    L.control.zoom({ position: 'topright' }).addTo(m)
    m.on('dragstart', () => setFollow(false))
    map.current = m
    return () => { m.remove(); map.current = null; layers.current = {} }
  }, [])

  // destination marker
  useEffect(() => {
    const m = map.current; if (!m || !dll) return
    if (layers.current.dest) layers.current.dest.remove()
    layers.current.dest = L.marker(dll, { icon: dot('dest') }).addTo(m).bindTooltip(dest.n, { permanent: true, direction: 'top', offset: [0, -10], className: 'gh-tip' })
    fitted.current = false
    setRoute(null)
    // eslint-disable-next-line
  }, [dest && dest.n])

  // watch the phone's position
  const startWatch = () => {
    if (!navigator.geolocation) return setErr('This phone cannot share its location.')
    setErr('')
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = navigator.geolocation.watchPosition(
      p => setFix({ la: p.coords.latitude, lo: p.coords.longitude, acc: p.coords.accuracy }),
      e => setErr(e && e.code === 1 ? 'Location is blocked. Allow location for this site in your browser settings, then tap Try again.' : 'Could not find you yet. Move to an open area and tap Try again.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
  }
  useEffect(() => { startWatch(); return () => { if (watchId.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current) } }, [])  // eslint-disable-line

  // arrived on campus: hand over to the campus map
  useEffect(() => {
    if (fix && onCampus(fix.la, fix.lo) && dest) { toast('You are on campus. Switching to the campus map'); nav('/map?to=' + slugify(dest.n), { replace: true }) }
    // eslint-disable-next-line
  }, [fix])
  useEffect(() => { if (gps.current && dest) nav('/map?to=' + slugify(dest.n), { replace: true }) /* eslint-disable-next-line */ }, [])

  // you-are-here dot + follow
  useEffect(() => {
    const m = map.current; if (!m || !fix) return
    const p = [fix.la, fix.lo]
    if (!layers.current.me) layers.current.me = L.marker(p, { icon: dot('me'), zIndexOffset: 500 }).addTo(m)
    else layers.current.me.setLatLng(p)
    if (!fitted.current && dll) { fitted.current = true; m.fitBounds([p, dll], { padding: [50, 50], maxZoom: 16 }) }
    else if (followRef.current) m.panTo(p, { animate: true })
    // eslint-disable-next-line
  }, [fix, dest && dest.n])

  // road route: fetch when we first know where you are, then again when you have moved a good distance
  useEffect(() => {
    if (!fix || !dll) return
    const lf = lastFetch.current, moved = distKm(fix.la, fix.lo, lf.la, lf.lo) * 1000
    if (route && (moved < 300 || Date.now() - lf.at < 30000)) return
    lastFetch.current = { at: Date.now(), la: fix.la, lo: fix.lo }
    const ctl = new AbortController()
    fetch(`${ROUTER}/route/v1/driving/${fix.lo},${fix.la};${dll[1]},${dll[0]}?overview=full&geometries=geojson`, { signal: ctl.signal })
      .then(r => r.json()).then(j => {
        const r = j.routes && j.routes[0]; if (!r) throw new Error('no route')
        setRErr(false); setRoute({ coords: r.geometry.coordinates.map(c => [c[1], c[0]]), dist: r.distance, dur: r.duration })
      }).catch(e => { if (e.name !== 'AbortError') setRErr(true) })
    return () => ctl.abort()
    // eslint-disable-next-line
  }, [fix, dest && dest.n])
  useEffect(() => {
    const m = map.current; if (!m) return
    if (layers.current.line) { layers.current.line.remove(); layers.current.line = null }
    if (route) layers.current.line = L.polyline(route.coords, { color: '#1B3FD6', weight: 6, opacity: .85 }).addTo(m)
    else if (fix && dll && rErr) layers.current.line = L.polyline([[fix.la, fix.lo], dll], { color: '#1B3FD6', weight: 4, dashArray: '2 10', opacity: .8 }).addTo(m)
    // eslint-disable-next-line
  }, [route, rErr])

  const straight = fix && dll ? distKm(fix.la, fix.lo, dll[0], dll[1]) * 1000 : null
  const recenter = () => { setFollow(true); if (fix && map.current) map.current.setView([fix.la, fix.lo], Math.max(map.current.getZoom(), 15)) }
  const showAll = () => { setFollow(false); if (fix && dll && map.current) map.current.fitBounds([[fix.la, fix.lo], dll], { padding: [50, 50], maxZoom: 16 }) }

  return (
    <View>
      <div className="pad" style={{ paddingBottom: 24 }}>
        <div className="top" style={{ padding: 0 }}>
          <button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button>
          <div style={{ flex: 1, minWidth: 0 }}><div className="mut" style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>Getting to</div><h2 style={{ overflowWrap: 'anywhere' }}>{dest ? dest.n : 'OOU'}</h2></div>
        </div>
        {ways.length > 1 && (
          <div className="mrow" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '6px 10px' }}>
            <label htmlFor="gh-to">Drop me at</label>
            <select id="gh-to" value={dest ? slugify(dest.n) : ''} onChange={e => setSlug(e.target.value)} style={{ height: 40, border: 0, background: 'transparent', fontWeight: 600, width: '100%' }}>{ways.map(p => <option key={p.n} value={slugify(p.n)}>{p.n} · {p.t}</option>)}</select>
          </div>
        )}
        <div className="gh-map"><div ref={mapEl} style={{ position: 'absolute', inset: 0 }} />
          <button className="ib gh-loc" onClick={recenter} aria-label="Follow me"><Icon n="nav" s={20} /></button>
        </div>
        {err && <div className="card" style={{ display: 'grid', gap: 8, background: 'var(--sun)' }}><b>We cannot see where you are</b><span className="mut" style={{ lineHeight: 1.45 }}>{err}</span><button className="btn gold" style={{ minHeight: 44 }} onClick={startWatch}>Try again</button></div>}
        {!err && !fix && <div className="card mut">Finding your location…</div>}
        {fix && (
          <div className="card" style={{ display: 'grid', gap: 8 }}>
            {route ? (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div className="big">{fmtMin(route.dur)}<small>by road</small></div><span className="mut">{fmtKm(route.dist)} to go</span>
              </div>
            ) : rErr ? (
              <div style={{ display: 'grid', gap: 4 }}><b>About {fmtKm(straight)} away in a straight line</b><span className="mut" style={{ lineHeight: 1.45 }}>The dotted line points to the school. We could not load the road route right now. Check your data connection.</span></div>
            ) : <span className="mut">Finding the road…</span>}
            <span className="mut" style={{ fontSize: 13, lineHeight: 1.45 }}>Follow the blue line. The blue dot is you and it moves as you travel. When you reach the campus, this switches to the campus map by itself.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn line" style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={showAll}>See the whole way</button>
              <button className="btn line" style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={() => nav('/arrive')}>How to get in</button>
            </div>
          </div>
        )}
      </div>
    </View>
  )
}
