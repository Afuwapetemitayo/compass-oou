import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state'
import { MapEngine } from '../lib/mapEngine'
import { MODES, mins, project, route, snap } from '../lib/routing'
import { askLocation, onCampus, xy } from '../lib/geo'
import { slugify } from '../lib/places'
import Icon from '../components/Icon'
import { Sheet } from '../components/ui'

export default function MapPage() {
  const nav = useNavigate()
  const [q, setQ] = useSearchParams()
  const { places, gps, asked, toast, log } = useApp()
  const svgRef = useRef(null)
  const eng = useRef(null)
  const located = useMemo(() => places.filter(p => p.x != null).sort((a, b) => a.n.localeCompare(b.n)), [places])
  const byIdx = i => places[i]

  const toSlug = q.get('to')
  const initTo = toSlug ? places.findIndex(p => slugify(p.n) === toSlug) : -1
  const [to, setTo] = useState(initTo >= 0 ? initTo : null)
  const [from, setFrom] = useState(null)
  const [mode, setMode] = useState('walk')
  const [sheet, setSheet] = useState(() => (q.get('credits') ? 'credits' : (asked.current ? null : 'perm')))
  const [, force] = useState(0)                     // re-draw when GPS changes
  const [navState, setNav] = useState(null)         // null | {real, done}
  const [remain, setRemain] = useState(null)        // metres left while navigating
  const curRef = useRef(null)
  const watchRef = useRef(null)
  const modeRef = useRef(mode); modeRef.current = mode
  useEffect(() => { asked.current = true }, [asked])

  const testStart = useMemo(() => places.find(p => p.n === 'School Park'), [places])
  const myLoc = () => gps.current ? { n: 'My location', x: gps.current.x, y: gps.current.y, s: snap(gps.current), v: 1 } : testStart
  const origin = from != null ? byIdx(from) : myLoc()
  const dest = to != null ? byIdx(to) : null
  const hasRoute = !!(dest && origin && dest !== origin)

  // create the map once
  useEffect(() => {
    const e = new MapEngine(svgRef.current, { getBottomH: () => { const m = document.getElementById('msheet'); return (m && m.offsetHeight) || 240 }, onPick: i => { setTo(i) } })
    eng.current = e
    return () => { stopWatch(); e.destroy(); eng.current = null }
    // eslint-disable-next-line
  }, [])
  useEffect(() => { if (eng.current && places.length) { eng.current.build(places); redraw() } /* eslint-disable-next-line */ }, [places])

  const stopWatch = () => { if (watchRef.current != null && navigator.geolocation) { try { navigator.geolocation.clearWatch(watchRef.current) } catch { /* ignore */ } } watchRef.current = null }
  const stopNav = useCallback(() => { stopWatch(); if (eng.current) eng.current.stopNav(); setNav(null); setRemain(null) }, [])

  // draw the right thing when the choices change (not while walking)
  const redraw = () => {
    const e = eng.current
    if (!e || !e.gRoute || navState) return
    if (!hasRoute) { curRef.current = null; e.showAll(dest); return }
    curRef.current = route(origin, dest)
    e.showRoute(curRef.current, origin, dest)
  }
  useEffect(() => { redraw(); if (hasRoute && dest.id !== undefined) log({ type: 'directions_preview' }, dest) /* eslint-disable-next-line */ }, [to, from, gps.current, places, testStart])
  useEffect(() => { if (navState) stopNav() /* eslint-disable-next-line */ }, [to, from])

  const lenNow = remain != null ? remain : (curRef.current ? curRef.current.len : 0)

  const allow = () => {
    setSheet(null)
    askLocation(pos => {
      if (pos && okFix(pos)) toast('Location is on')
      else if (pos) toast('You are not on campus, using School Park as the test start')
      else toast('Location is blocked here, so this is test mode')
      force(n => n + 1)
    })
  }
  const okFix = pos => { const la = pos.coords.latitude, lo = pos.coords.longitude; if (!onCampus(la, lo)) { gps.current = null; return false } const p = xy(la, lo); gps.current = { x: p[0], y: p[1] }; return true }

  const start = () => {
    if (!curRef.current) return
    askLocation(pos => {
      const real = !!(pos && okFix(pos))
      if (!real) { gps.current = null; toast(pos ? 'You are not on campus, so this is a test walk' : 'Location is off here, so this is a test walk') }
      const fr = real ? myLoc() : origin
      if (fr === dest) { toast('You are already there'); return }
      curRef.current = route(fr, dest)
      setNav({ real, done: false }); setRemain(curRef.current.len)
      log({ type: 'directions_start', mode: modeRef.current }, dest)
      const e = eng.current
      e.startNav(curRef.current, dest, {
        real, start: { x: fr.x, y: fr.y },
        speed: () => MODES.find(m => m.k === modeRef.current).v / 3.6,
        onTick: (prog, L) => setRemain(Math.max(0, L - prog)),
        onArrive: () => { setNav({ real, done: true }); log({ type: 'directions_done', mode: modeRef.current }, dest) }
      })
      if (real && navigator.geolocation) {
        try {
          watchRef.current = navigator.geolocation.watchPosition(p => {
            const la = p.coords.latitude, lo = p.coords.longitude
            if (!onCampus(la, lo) || !eng.current || !eng.current.nav) return
            const q2 = xy(la, lo), pt = { x: q2[0], y: q2[1] }, pr = project(curRef.current, pt)
            if (pr.off > 40) { const me = { n: 'My location', x: pt.x, y: pt.y, s: snap(pt), v: 1 }; curRef.current = route(me, dest); eng.current.reroute(curRef.current, dest, pt); toast('Finding a new path'); return }
            eng.current.setFix(pt, pr.d)
          }, () => {}, { enableHighAccuracy: true, maximumAge: 2000 })
        } catch { /* ignore */ }
      }
    })
  }
  const end = () => { stopNav(); redraw() }
  useEffect(() => { if (!navState && eng.current && eng.current.gRoute) redraw() /* eslint-disable-next-line */ }, [navState])

  const opt = sel => located.map(p => <option key={p.i} value={p.i}>{p.n}{p.v === 2 ? ' (unverified)' : ''}</option>)
  const fromLabel = gps.current ? 'My location' : 'My location (test: School Park)'

  return (
    <div id="mapbox" style={{ display: 'block' }}>
      <svg id="map" ref={svgRef} role="img" aria-label="Campus map" />
      <div id="mapui">
        {!navState && (
          <div className="mtop">
            <div className="mrow"><label htmlFor="mfrom">From</label><select id="mfrom" value={from == null ? '' : from} onChange={e => setFrom(e.target.value === '' ? null : +e.target.value)}><option value="">{fromLabel}</option>{opt()}</select></div>
            <div className="mrow"><label htmlFor="mto">To</label><select id="mto" value={to == null ? '' : to} onChange={e => setTo(e.target.value === '' ? null : +e.target.value)}><option value="">Choose where you are going</option>{opt()}</select></div>
          </div>
        )}
        {navState && !navState.done && (
          <div className="mtop" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center', display: 'grid' }}>
            <div style={{ minWidth: 0 }}><div className="mut" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>Heading to</div><b style={{ overflowWrap: 'anywhere' }}>{dest.n}</b></div>
            <button className="btn line" style={{ minHeight: 44, padding: '0 16px', fontSize: 14 }} onClick={end}>End</button>
          </div>
        )}
        {navState && navState.done && <div />}

        {navState && navState.done ? (
          <div className="msheet" id="msheet" style={{ gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ic" style={{ background: 'var(--mint)', color: 'var(--mintInk)' }}><Icon n="pin" /></span><div><b style={{ fontSize: 18 }}>You have arrived</b><div className="mut">{dest.n}</div></div></div>
            <button className="btn blue block" onClick={end}>Done</button>
          </div>
        ) : (
          <div className="msheet" id="msheet">
            <button className="info" onClick={() => setSheet('credits')} aria-label="Map credits">i</button>
            {hasRoute ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div className="big">{mins(lenNow, mode)}<small>min {navState ? 'left' : 'by ' + (mode === 'walk' ? 'walking' : MODES.find(m => m.k === mode).n)}</small></div>
                  <span className="mut">{lenNow >= 1000 ? (lenNow / 1000).toFixed(2) + ' km' : Math.round(lenNow) + ' m'}</span>
                </div>
                <div className="modes">{MODES.map(m => <button key={m.k} className="mode" onClick={() => setMode(m.k)} aria-pressed={mode === m.k}><b>{mins(lenNow, m.k)}</b><span>{m.n}</span></button>)}</div>
                {!navState && <button className="btn gold block" onClick={start}><Icon n="nav" s={18} /> Start</button>}
                {navState && <span className="nowtag" style={{ justifySelf: 'start' }}>{navState.real ? 'Following your location' : 'Test walk, moving by itself'}</span>}
                {!navState && (dest.v === 2 || origin.v === 2) && <p className="demo" style={{ textAlign: 'left' }}>One end is not checked on site yet, so the path may be a little off.</p>}
              </>
            ) : (
              <div><b>{dest && dest === origin ? 'Pick a different start or destination' : 'Tap a dot or choose a place'}</b><p className="mut" style={{ marginTop: 4 }}>{located.length} places are on the map. Gold dots are places we have not checked on site yet.</p></div>
            )}
          </div>
        )}
      </div>

      {sheet === 'perm' && (
        <Sheet onClose={() => setSheet(null)}>
          <span className="ic" style={{ width: 56, height: 56, borderRadius: 18 }}><Icon n="pin" s={26} /></span>
          <h2>Allow location?</h2>
          <p className="mut" style={{ lineHeight: 1.45 }}>Compass uses your location to show where you are and guide you step by step. It stays on your phone.</p>
          <button className="btn blue block" onClick={allow}>Allow location</button>
          <button className="btn line block" onClick={() => { setSheet(null); toast('Location is off. You can start a test walk') }}>Not now</button>
        </Sheet>
      )}
      {sheet === 'credits' && (
        <Sheet onClose={() => { setSheet(null); if (q.get('credits')) setQ({}, { replace: true }) }}>
          <h2>Map credits</h2>
          <p className="mut" style={{ lineHeight: 1.5 }}>Roads and building outlines: © OpenStreetMap contributors (openstreetmap.org/copyright). Place names and positions: Compass.</p>
          <button className="btn line block" onClick={() => { setSheet(null); if (q.get('credits')) setQ({}, { replace: true }) }}>Close</button>
        </Sheet>
      )}
    </div>
  )
}
