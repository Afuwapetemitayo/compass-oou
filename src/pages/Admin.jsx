import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state'
import { backend, hasSupabase } from '../lib/backend'
import { CATS } from '../lib/places'
import { ll, xy, inOOUBounds } from '../lib/geo'
import Icon from '../components/Icon'
import { View } from '../components/ui'

const SAMPLE = { users_total: 1284, visits: 2887, visitors: 640, daily: [212, 260, 198, 310, 284, 342, 390].map((v, i) => ({ day: i, visits: v })), top_places: [['Motion Ground', 92], ['Department of Statistics', 71], ['University Library', 64], ['Registrar', 52], ['LLT2', 38]].map(([place, count]) => ({ place, count })), no_result_searches: ['hostel', 'bursary', 'chapel', 'bank', 'atm'].map(query => ({ query, count: 3 })), modes: [{ mode: 'walk', count: 58 }, { mode: 'keke', count: 27 }, { mode: 'car', count: 15 }], by_faculty: [] }

export default function Admin() {
  const nav = useNavigate()
  const { profile, places } = useApp()
  const [tab, setTab] = useState('overview')
  const [edit, setEdit] = useState(null)
  return (
    <View>
      <div className="pad">
        <div className="top" style={{ padding: 0 }}>
          <button className="ib" onClick={() => nav('/')} aria-label="Leave admin"><Icon n="back" /></button>
          <div style={{ flex: 1 }}><div className="mut" style={{ fontSize: 12 }}>Admin · signed in as {profile.name.split(' ')[0]}</div><h2>Dashboard</h2></div>
        </div>
        <div className="seg" role="tablist">
          {[['overview', 'Overview'], ['users', 'Users'], ['places', 'Places'], ['add', 'Add place'], ['reports', 'Reports']].map(([k, l]) => <button key={k} aria-pressed={tab === k || (k === 'places' && tab === 'edit')} onClick={() => { setTab(k); setEdit(null) }}>{l}</button>)}
        </div>
        {tab === 'overview' && <Overview places={places} />}
        {tab === 'reports' && <Reports />}
        {tab === 'users' && <Users />}
        {tab === 'places' && <PlacesList places={places} onEdit={p => { setEdit(p); setTab('edit') }} />}
        {tab === 'add' && <PlaceForm key="new" place={null} onDone={() => setTab('places')} />}
        {tab === 'edit' && <><button className="btn line" style={{ justifySelf: 'start', minHeight: 40 }} onClick={() => setTab('places')}><Icon n="back" s={18} /> All places</button><PlaceForm key={edit.n} place={edit} onDone={() => setTab('places')} /></>}
      </div>
    </View>
  )
}

function Overview({ places }) {
  const [range, setRange] = useState(7)
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let dead = false
    setErr('')
    backend.adminStats(range).then(r => { if (!dead) setS(r) }).catch(e => { if (!dead) setErr(e.message || 'Could not load numbers') })
    return () => { dead = true }
  }, [range])
  const sample = !hasSupabase
  const d = sample ? SAMPLE : s
  const live = places.filter(p => p.x != null).length
  const bars = useMemo(() => {
    if (!d) return []
    if (sample) return d.daily.map(x => x.visits)
    const map = new Map(d.daily.map(x => [String(x.day).slice(0, 10), x.visits]))
    return Array.from({ length: range }, (_, i) => { const t = new Date(Date.now() - (range - 1 - i) * 864e5).toISOString().slice(0, 10); return map.get(t) || 0 })
  }, [d, range, sample])
  const mx = Math.max(1, ...bars)
  const tag = sample ? ' (sample)' : ''
  const totalModes = d ? d.modes.reduce((a, b) => a + b.count, 0) : 0
  return (
    <>
      <div className="seg">{[7, 14].map(n => <button key={n} aria-pressed={range === n} onClick={() => setRange(n)}>{n} days</button>)}</div>
      {err && <div className="card" style={{ color: '#C0392B' }}>{err}</div>}
      {!d && !err && <div className="card mut">Loading…</div>}
      {d && <>
        <div className="stats">
          <div className="card stat"><b>{d.users_total.toLocaleString()}</b><span>Registered students{tag}</span></div>
          <div className="card stat"><b>{d.visits.toLocaleString()}</b><span>Visits, last {range} days{tag}</span></div>
          <div className="card stat"><b>{d.visitors}</b><span>People who visited{tag}</span></div>
          <div className="card stat"><b>{live}/{places.length}</b><span>Places on map</span></div>
        </div>
        <div className="card"><h3>Visits per day</h3><div className="bars" style={{ marginTop: 12 }}>{bars.map((v, i) => <i key={i} className={v === Math.max(...bars) && v > 0 ? 'pk' : ''} style={{ height: Math.max(4, Math.round(v / mx * 100)) + '%' }} title={v + ' visits'} />)}</div><div className="mut" style={{ fontSize: 12, marginTop: 6 }}>Peak: {Math.max(...bars)} visits</div></div>
        <div className="card"><h3>Most opened places{tag}</h3><div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{d.top_places.length ? d.top_places.map(t => <div key={t.place} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{t.place}</span><b>{t.count}</b></div>) : <span className="mut">Nothing yet</span>}</div></div>
        <div className="card"><h3>Searches with no result{tag}</h3><p className="mut" style={{ marginTop: 8 }}>{d.no_result_searches.length ? d.no_result_searches.map(x => x.query).join(' · ') : 'None yet'}</p></div>
        <div className="card"><h3>How students travel{tag}</h3><p className="mut" style={{ marginTop: 8 }}>{totalModes ? d.modes.map(m => `${m.mode === 'keke' ? 'Keke Napep' : m.mode[0].toUpperCase() + m.mode.slice(1)} ${Math.round(m.count / totalModes * 100)}%`).join(' · ') : 'No walks started yet'}</p></div>
        {d.by_faculty.length > 0 && <div className="card"><h3>Students by faculty</h3><div style={{ display: 'grid', gap: 8, marginTop: 10 }}>{d.by_faculty.map(f => <div key={f.faculty} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{f.faculty}</span><b>{f.users}</b></div>)}</div></div>}
        {sample && <p className="demo">Test mode: numbers marked sample are placeholders. With the database connected they are real.</p>}
      </>}
    </>
  )
}

function PlacesList({ places, onEdit }) {
  const [aq, setAq] = useState('')
  const [af, setAf] = useState('all')
  const [at, setAt] = useState('All')
  const live = places.filter(p => p.x != null).length, miss = places.length - live
  const ql = aq.trim().toLowerCase()
  const list = places.filter(p => (af === 'all' || (af === 'live' ? p.x != null : p.x == null)) && (at === 'All' || p.c === at) && (!ql || (p.n + ' ' + p.f).toLowerCase().includes(ql)))
  return (
    <>
      <div className="stats"><div className="card stat"><b>{places.length}</b><span>All places</span></div><div className="card stat"><b>{live}</b><span>Live</span></div></div>
      <label className="search" htmlFor="aq"><Icon n="search" /><input id="aq" value={aq} onChange={e => setAq(e.target.value)} placeholder="Search places" autoComplete="off" /></label>
      <div className="chips">{[['all', 'All · ' + places.length], ['live', 'Live · ' + live], ['miss', 'Needs location · ' + miss]].map(([k, l]) => <button key={k} className="chip g" aria-pressed={af === k} onClick={() => setAf(k)}>{l}</button>)}</div>
      <div className="chips">{CATS.map(c => <button key={c} className="chip" aria-pressed={at === c} onClick={() => setAt(c)}>{c}</button>)}</div>
      <div className="list">
        {list.length ? list.map(p => (
          <button key={p.n} className="li" onClick={() => onEdit(p)}>
            <span className="t"><b>{p.n}</b><span>{p.c}{p.photo ? ' · has photo' : ''}</span></span>
            {p.x != null ? (p.v === 2 ? <span className="pill un">Live · unverified</span> : <span className="pill on">Live</span>) : <span className="pill off">Needs location</span>}
          </button>
        )) : <div className="li"><span className="t"><b>No places match</b></span></div>}
      </div>
    </>
  )
}

// Shrink a photo to 800 px wide so the app stays light.
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = reject
    r.onload = () => {
      const im = new Image()
      im.onerror = reject
      im.onload = () => {
        const w = Math.min(800, im.width), h = im.height * (w / im.width)
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(im, 0, 0, w, h)
        const data = c.toDataURL('image/jpeg', .78)
        c.toBlob(blob => resolve({ blob, data }), 'image/jpeg', .78)
      }
      im.src = r.result
    }
    r.readAsDataURL(file)
  })
}

function PlaceForm({ place: p, onDone }) {
  const { places, reloadPlaces, toast } = useApp()
  const [la0, lo0] = p && p.x != null ? ll(p.x, p.y) : ['', '']
  const [name, setName] = useState(p ? p.n : '')
  const [cat, setCat] = useState('Buildings')
  const [lat, setLat] = useState(la0 === '' ? '' : la0.toFixed(6))
  const [lng, setLng] = useState(lo0 === '' ? '' : lo0.toFixed(6))
  const [note, setNote] = useState(p ? p.note || '' : '')
  const [photo, setPhoto] = useState(null)            // { blob, data }
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [acc, setAcc] = useState(null)
  const watch = useRef({ id: null, t: null })
  useEffect(() => () => stopLocate(), [])   // eslint-disable-line
  const preview = photo ? photo.data : (p && p.photo)

  function stopLocate() {
    if (watch.current.id != null && navigator.geolocation) navigator.geolocation.clearWatch(watch.current.id)
    clearTimeout(watch.current.t); watch.current = { id: null, t: null }; setLocating(false)
  }
  // Stand at the building and tap: waits a few seconds for the most accurate reading.
  const useMyLocation = () => {
    if (!navigator.geolocation) return toast('This phone cannot share its location')
    stopLocate(); setLocating(true); setAcc(null)
    let best = null
    const finish = () => {
      stopLocate()
      if (!best) toast('Could not get your location. Allow location for this site and try again.')
      else if (!inOOUBounds(best.coords.latitude, best.coords.longitude)) toast('You are not at OOU, so this location was not used')
    }
    watch.current.id = navigator.geolocation.watchPosition(p => {
      if (!inOOUBounds(p.coords.latitude, p.coords.longitude)) { best = best || p; return }
      if (!best || !inOOUBounds(best.coords.latitude, best.coords.longitude) || p.coords.accuracy < best.coords.accuracy) {
        best = p; setLat(p.coords.latitude.toFixed(6)); setLng(p.coords.longitude.toFixed(6)); setAcc(Math.round(p.coords.accuracy))
      }
      if (p.coords.accuracy <= 6) finish()
    }, () => finish(), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
    watch.current.t = setTimeout(finish, 12000)
  }

  const pick = async e => { const f = e.target.files[0]; if (!f) return; try { setPhoto(await resizePhoto(f)) } catch { toast('Could not read that photo') } }

  const save = async () => {
    const la = parseFloat(lat), lo = parseFloat(lng)
    const hasCoords = !isNaN(la) && !isNaN(lo)
    if (!p) {
      if (!name.trim()) return toast('Enter a name')
      if (places.some(x => x.n.toLowerCase() === name.trim().toLowerCase())) return toast('That name already exists')
    }
    if (hasCoords && !inOOUBounds(la, lo)) return toast('Those coordinates are outside OOU')
    setBusy(true)
    try {
      const np = p ? { ...p } : { n: name.trim(), c: cat, t: cat.replace(/ies$/, 'y').replace(/s$/, ''), f: '', a: '', k: 0, x: null, y: null, v: 0, id: null }
      if (hasCoords) {
        const [x, y] = xy(la, lo)
        if (np.x == null || Math.hypot(np.x - x, np.y - y) > .5) { np.x = x; np.y = y; np.v = 1 }
      }
      np.note = note.trim()
      await backend.savePlace(np, photo && photo.blob, photo && photo.data)
      await reloadPlaces()
      toast('Saved. ' + np.n + (np.x != null ? ' is live' : ' needs a location'))
      onDone()
    } catch (e) { toast((e && e.message) || 'Could not save') }
    setBusy(false)
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <h3>{p ? 'Edit place' : 'Add a place'}</h3>
      <div className="field"><label htmlFor="p-name">Name</label><input className="inp" id="p-name" value={name} onChange={e => setName(e.target.value)} disabled={!!p} placeholder="e.g. Faculty of Law" /></div>
      {!p && <div className="field"><label htmlFor="p-cat">Type</label><select className="inp" id="p-cat" value={cat} onChange={e => setCat(e.target.value)}>{CATS.slice(1).map(c => <option key={c}>{c}</option>)}</select></div>}
      <div className="row2">
        <div className="field"><label htmlFor="p-lat">Latitude</label><input className="inp" id="p-lat" inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} placeholder="6.926624" /></div>
        <div className="field"><label htmlFor="p-lng">Longitude</label><input className="inp" id="p-lng" inputMode="decimal" value={lng} onChange={e => setLng(e.target.value)} placeholder="3.868849" /></div>
      </div>
      <button className="btn line block" style={{ minHeight: 48 }} onClick={useMyLocation} disabled={locating}><Icon n="pin" s={18} /> {locating ? 'Getting your position…' : 'Use my current location'}</button>
      {acc != null && <p className="demo" style={{ textAlign: 'left', marginTop: -4, color: acc > 20 ? '#7A5200' : 'var(--mintInk)' }}>{acc > 20 ? `Weak signal (±${acc} m). Move to open sky and tap again.` : `Position taken, accurate to about ${acc} m.`}</p>}
      <div className="field"><label htmlFor="p-note">Good to know</label><textarea className="inp" id="p-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Second floor, turn left" /></div>
      <div className="field"><label>Building photo</label>
        <div className="photo" style={{ aspectRatio: '16/9' }}>{preview ? <img src={preview} alt="Preview" /> : <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}><Icon n="cam" /><span>No photo yet</span></div>}</div>
        <input type="file" id="p-photo" accept="image/*" className="inp" style={{ paddingTop: 11 }} onChange={pick} />
        <span className="mut" style={{ fontSize: 12 }}>Photos are resized to 800 px wide so the app stays light.</span>
      </div>
      <button className="btn gold block" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save place'}</button>
      <p className="demo">Saving makes the place live right away. No review step.</p>
    </div>
  )
}

function Reports() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const load = () => backend.listReports().then(setList).catch(e => setErr(e.message || 'Could not load reports. Did you run reports.sql?'))
  useEffect(() => { load() }, [])
  const flip = async r => {
    try { await backend.setReportStatus(r.id, r.status === 'open' ? 'done' : 'open'); load() } catch (e) { toast(e.message || 'Could not update') }
  }
  const open = list ? list.filter(r => r.status === 'open').length : 0
  return (
    <>
      <div className="stats"><div className="card stat"><b>{open}</b><span>Open reports</span></div><div className="card stat"><b>{list ? list.length : 0}</b><span>All reports</span></div></div>
      {err && <div className="card" style={{ color: '#C0392B' }}>{err}</div>}
      {list && !list.length && <div className="card mut">No reports yet.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {(list || []).map(r => (
          <div className="card" key={r.id} style={{ display: 'grid', gap: 6, opacity: r.status === 'done' ? .6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b>{r.place_name || 'General'}</b>
              <span className={'pill ' + (r.status === 'open' ? 'off' : 'on')}>{r.status === 'open' ? 'Open' : 'Done'}</span>
            </div>
            <p style={{ lineHeight: 1.45, overflowWrap: 'anywhere' }}>{r.message}</p>
            <div className="mut" style={{ fontSize: 12 }}>{r.who ? (r.who.full_name || '') + ' · ' + (r.who.email || '') : 'Unknown'} · {new Date(r.created_at).toLocaleString()}</div>
            <button className="btn line" style={{ minHeight: 40, justifySelf: 'start', fontSize: 14 }} onClick={() => flip(r)}>{r.status === 'open' ? 'Mark as done' : 'Reopen'}</button>
          </div>
        ))}
      </div>
    </>
  )
}

function Users() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => { backend.listUsers().then(setList).catch(e => setErr(e.message || 'Could not load users')) }, [])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (list || []).filter(u => !t || [u.name, u.email, u.faculty, u.dept, u.level].some(v => (v || '').toLowerCase().includes(t)))
  }, [list, q])
  const day = d => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not yet'
  const copy = async text => { try { await navigator.clipboard.writeText(text); toast('Copied') } catch { toast('Could not copy') } }
  const csv = () => {
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"'
    const rows = [['Name', 'Email', 'Faculty', 'Department', 'Level', 'Role', 'Joined', 'Last seen'], ...shown.map(u => [u.name, u.email, u.faculty, u.dept, u.level, u.role, u.joined, u.seen || ''])]
    const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'compass-users.csv'; a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <>
      <div className="stats"><div className="card stat"><b>{list ? list.length : 0}</b><span>Registered</span></div><div className="card stat"><b>{list ? list.filter(u => u.seen && Date.now() - new Date(u.seen) < 7 * 864e5).length : 0}</b><span>Active this week</span></div></div>
      {err && <div className="card" style={{ color: '#C0392B' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="inp" style={{ flex: 1 }} placeholder="Search name, email, faculty…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn line" style={{ minHeight: 44 }} onClick={csv} disabled={!shown.length}>Download CSV</button>
      </div>
      {list && !shown.length && <div className="card mut">No users found.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {shown.map(u => (
          <div className="card" key={u.id} style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <b>{u.name}</b>
              {u.role === 'admin' && <span className="pill on">Admin</span>}
            </div>
            <button onClick={() => copy(u.email)} style={{ background: 'none', border: 0, padding: 0, font: 'inherit', textAlign: 'left', color: 'var(--blue, #1B3FD6)', overflowWrap: 'anywhere' }}>{u.email}</button>
            <div className="mut" style={{ fontSize: 13 }}>{[u.faculty, u.dept, u.level && u.level + ' level'].filter(Boolean).join(' · ') || 'Profile not completed'}</div>
            <div className="mut" style={{ fontSize: 12 }}>Joined {day(u.joined)} · Last seen {day(u.seen)}</div>
          </div>
        ))}
      </div>
    </>
  )
}
