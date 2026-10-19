import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state'
import { backend, hasSupabase } from '../lib/backend'
import { CATS, areaOf } from '../lib/places'
import { ll, xy, inOOUBounds, distKm } from '../lib/geo'
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
          {[['overview', 'Overview'], ['users', 'Users'], ['places', 'Places'], ['add', 'Add place'], ['reports', 'Reports'], ['paths', 'Shortcuts'], ['tips', 'Arrival']].map(([k, l]) => <button key={k} aria-pressed={tab === k || (k === 'places' && tab === 'edit')} onClick={() => { setTab(k); setEdit(null) }}>{l}</button>)}
        </div>
        {tab === 'overview' && <Overview places={places} />}
        {tab === 'reports' && <Reports />}
        {tab === 'users' && <Users />}
        {tab === 'tips' && <Tips />}
        {tab === 'paths' && <Shortcuts />}
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
  const list = places.filter(p => (af === 'all' || (af === 'live' ? p.x != null : (p.x == null || !!p.inherit))) && (at === 'All' || p.c === at) && (!ql || (p.n + ' ' + p.f).toLowerCase().includes(ql)))
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
            {p.inherit ? <span className="pill un">In faculty building</span> : p.x != null ? (p.v === 2 ? <span className="pill un">Live · unverified</span> : <span className="pill on">Live</span>) : <span className="pill off">Needs location</span>}
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
  const [la0, lo0] = p && p.x != null && !p.inherit ? ll(p.x, p.y) : ['', '']
  const [name, setName] = useState(p ? p.n : '')
  const [cat, setCat] = useState('Buildings')
  const [lat, setLat] = useState(la0 === '' ? '' : la0.toFixed(6))
  const [lng, setLng] = useState(lo0 === '' ? '' : lo0.toFixed(6))
  const [note, setNote] = useState(p ? p.note || '' : '')
  const [hist, setHist] = useState(p ? p.h || '' : '')
  const [rad, setRad] = useState(p && p.r ? String(p.r) : '')
  const [tlabel, setTlabel] = useState(p ? p.t || '' : '')
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
      const np = p ? { ...p, ...(p.inherit ? { x: null, y: null, v: 0 } : {}) } : { n: name.trim(), c: cat, t: cat.replace(/ies$/, 'y').replace(/s$/, ''), f: '', a: '', k: 0, x: null, y: null, v: 0, id: null }
      if (hasCoords) {
        const [x, y] = xy(la, lo)
        if (np.x == null || Math.hypot(np.x - x, np.y - y) > .5) { np.x = x; np.y = y; np.v = 1 }
      }
      np.note = note.trim(); np.h = hist.trim(); if (tlabel.trim()) np.t = tlabel.trim()
      const rn = parseInt(rad); np.r = rad.trim() === '' ? 0 : (isNaN(rn) || rn < 5 || rn > 500 ? null : rn)
      if (np.r === null) { setBusy(false); return toast('Area size must be between 5 and 500 metres') }
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
      <div className="field"><label htmlFor="p-tl">Label (optional)</label><input className="inp" id="p-tl" value={tlabel} onChange={e => setTlabel(e.target.value)} placeholder="e.g. Main gate, Bus stop, Drop-off point" /><span className="mut" style={{ fontSize: 12 }}>Places labelled gate, park, drop-off or bus stop appear under Get into the school in Coming to OOU.</span></div>
      <div className="row2">
        <div className="field"><label htmlFor="p-lat">Latitude</label><input className="inp" id="p-lat" inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} placeholder="6.926624" /></div>
        <div className="field"><label htmlFor="p-lng">Longitude</label><input className="inp" id="p-lng" inputMode="decimal" value={lng} onChange={e => setLng(e.target.value)} placeholder="3.868849" /></div>
      </div>
      <div className="field"><label htmlFor="p-rad">Area size in metres (optional)</label><input className="inp" id="p-rad" inputMode="numeric" value={rad} onChange={e => setRad(e.target.value)} placeholder={'Default: ' + areaOf(p || { c: cat }) + ' m'} /><span className="mut" style={{ fontSize: 12 }}>How far from the pin still counts as being at this place. A big faculty may need 80 to 100. Standing inside this circle, the app says "You are at …".</span></div>
      <button className="btn line block" style={{ minHeight: 48 }} onClick={useMyLocation} disabled={locating}><Icon n="pin" s={18} /> {locating ? 'Getting your position…' : 'Use my current location'}</button>
      {acc != null && <p className="demo" style={{ textAlign: 'left', marginTop: -4, color: acc > 20 ? '#7A5200' : 'var(--mintInk)' }}>{acc > 20 ? `Weak signal (±${acc} m). Move to open sky and tap again.` : `Position taken, accurate to about ${acc} m.`}</p>}
      <div className="field"><label htmlFor="p-note">Good to know</label><textarea className="inp" id="p-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Second floor, turn left" /></div>
      <div className="field"><label htmlFor="p-hist">History and facts</label><textarea className="inp" id="p-hist" style={{ minHeight: 130, height: 'auto', padding: 12, lineHeight: 1.45 }} value={hist} onChange={e => setHist(e.target.value)} placeholder="When it was built, who it is named after, what it is known for. Leave a blank line between paragraphs." /></div>
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
  const { toast, session } = useApp()
  const [list, setList] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [em, setEm] = useState('')
  const load = () => backend.listUsers().then(setList).catch(e => setErr(e.message || 'Could not load users'))
  useEffect(() => { load() }, [])   // eslint-disable-line
  const me = session && session.user ? session.user.id : null
  const setRole = async (u, role) => {
    const msg = role === 'admin' ? 'Make ' + u.name + ' (' + u.email + ') an admin? They will see every student\'s details and can edit places.' : 'Remove admin access from ' + u.name + '?'
    if (!window.confirm(msg)) return
    try { await backend.setRole(u.id, role); toast(role === 'admin' ? u.name + ' is now an admin' : 'Admin access removed'); load() } catch (e) { toast(e.message || 'Could not change the role') }
  }
  const addByEmail = () => {
    const t = em.trim().toLowerCase(); if (!t) return
    const u = (list || []).find(x => (x.email || '').toLowerCase() === t)
    if (!u) return toast('No one has signed up with that email yet. Ask them to register first.')
    if (u.role === 'admin') return toast(u.name + ' is already an admin')
    setRole(u, 'admin').then(() => setEm(''))
  }
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
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <b>Add an admin</b>
        <span className="mut" style={{ fontSize: 13, lineHeight: 1.45 }}>The person must register first. Type the email they used.</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="inp" style={{ flex: 1 }} type="email" inputMode="email" autoCapitalize="none" placeholder="their@email.com" value={em} onChange={e => setEm(e.target.value)} />
          <button className="btn gold" style={{ minHeight: 52 }} onClick={addByEmail} disabled={!em.trim()}>Make admin</button>
        </div>
      </div>
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
            {u.id !== me && u.id !== 'local' && (u.role === 'admin'
              ? <button className="btn line" style={{ minHeight: 40, fontSize: 14, justifySelf: 'start', color: '#C0392B' }} onClick={() => setRole(u, 'student')}>Remove admin</button>
              : <button className="btn line" style={{ minHeight: 40, fontSize: 14, justifySelf: 'start' }} onClick={() => setRole(u, 'admin')}>Make admin</button>)}
          </div>
        ))}
      </div>
    </>
  )
}

function Tips() {
  const { toast } = useApp()
  const [list, setList] = useState(null)
  const [edit, setEdit] = useState(null)       // null | {id?, title, body, sort_order}
  const load = () => backend.listTips().then(setList).catch(e => toast(e.message || 'Could not load. Did you run arrival.sql?'))
  useEffect(() => { load() }, [])   // eslint-disable-line
  const save = async () => {
    if (!edit.title.trim() || !edit.body.trim()) return toast('Add a title and some text')
    try { await backend.saveTip({ ...edit, title: edit.title.trim(), body: edit.body.trim() }); setEdit(null); toast('Saved'); load() } catch (e) { toast(e.message || 'Could not save') }
  }
  const del = async t => { if (!window.confirm('Delete "' + t.title + '"?')) return; try { await backend.deleteTip(t.id); load() } catch (e) { toast(e.message || 'Could not delete') } }
  return (
    <>
      <p className="mut" style={{ lineHeight: 1.5 }}>This is Step 1 of Coming to OOU. Write it for someone who has never been to Ago-Iwoye: which park, which bus, what to tell the driver, roughly what it costs. To add gates and drop-off points, add a place and give it a label like Main gate.</p>
      {edit ? (
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div className="field"><label htmlFor="t-title">Title</label><input className="inp" id="t-title" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. From Lagos (Ikorodu / Ojota)" /></div>
          <div className="field"><label htmlFor="t-body">Details</label><textarea className="inp" id="t-body" style={{ minHeight: 120, padding: 12, lineHeight: 1.45 }} value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })} /></div>
          <div className="field"><label htmlFor="t-ord">Order (small numbers first)</label><input className="inp" id="t-ord" inputMode="numeric" value={edit.sort_order} onChange={e => setEdit({ ...edit, sort_order: parseInt(e.target.value) || 0 })} /></div>
          <button className="btn gold block" onClick={save}>Save</button>
          <button className="btn line block" onClick={() => setEdit(null)}>Cancel</button>
        </div>
      ) : <button className="btn blue block" onClick={() => setEdit({ title: '', body: '', sort_order: ((list || []).length + 1) * 10 })}>Add a tip</button>}
      <div style={{ display: 'grid', gap: 10 }}>
        {(list || []).map(t => (
          <div className="card" key={t.id} style={{ display: 'grid', gap: 6 }}>
            <b>{t.title}</b>
            <p className="mut" style={{ lineHeight: 1.45, overflowWrap: 'anywhere' }}>{t.body}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn line" style={{ minHeight: 40, fontSize: 14 }} onClick={() => setEdit({ ...t })}>Edit</button>
              <button className="btn line" style={{ minHeight: 40, fontSize: 14, color: '#C0392B' }} onClick={() => del(t)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// Record a shortcut by walking it, or paste a route from the collector.
function Shortcuts() {
  const { toast, reloadPlaces } = useApp()
  const [list, setList] = useState(null)
  const [rec, setRec] = useState(false)
  const [pts, setPts] = useState([])           // [[lat, lng], ...]
  const [acc, setAcc] = useState(null)
  const [name, setName] = useState('')
  const [paste, setPaste] = useState('')
  const wid = useRef(null)
  const load = () => backend.listPaths().then(setList).catch(e => toast(e.message || 'Could not load. Did you run paths.sql?'))
  useEffect(() => { load(); return () => stop() }, [])   // eslint-disable-line
  const lenOf = a => a.reduce((t, q, i) => i ? t + distKm(a[i - 1][0], a[i - 1][1], q[0], q[1]) * 1000 : 0, 0)
  const stop = () => { if (wid.current != null && navigator.geolocation) navigator.geolocation.clearWatch(wid.current); wid.current = null; setRec(false) }
  const start = () => {
    if (!navigator.geolocation) return toast('This phone cannot share its location')
    setPts([]); setRec(true)
    wid.current = navigator.geolocation.watchPosition(p => {
      const la = p.coords.latitude, lo = p.coords.longitude
      setAcc(Math.round(p.coords.accuracy))
      if (!inOOUBounds(la, lo) || p.coords.accuracy > 20) return
      setPts(a => (!a.length || distKm(a[a.length - 1][0], a[a.length - 1][1], la, lo) * 1000 >= 6) ? [...a, [+la.toFixed(6), +lo.toFixed(6)]] : a)
    }, () => { toast('Could not read your location. Allow location and try again.'); stop() }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
  }
  // collector text: any line holding "latitude, longitude" counts, in order
  const importText = () => {
    const out = []
    paste.split('\n').forEach(l => { const m = l.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/); if (m) out.push([+m[1], +m[2]]) })
    if (out.length < 3) return toast('Need at least 3 points. Record waypoints along the path, not just the start and end.')
    if (out.some(q => !inOOUBounds(q[0], q[1]))) return toast('Some points are outside OOU')
    for (let i = 1; i < out.length; i++) if (distKm(out[i - 1][0], out[i - 1][1], out[i][0], out[i][1]) * 1000 > 150) return toast('Points ' + i + ' and ' + (i + 1) + ' are more than 150 m apart. Add points every 30 to 50 m so the path follows the real way.')
    setPts(out); setPaste(''); toast(out.length + ' points ready. Add a name and save.')
  }
  const save = async () => {
    if (pts.length < 3) return toast('Walk a bit more, we need at least 3 points')
    if (!name.trim()) return toast('Give the shortcut a name')
    try { await backend.savePath({ name: name.trim(), points: pts }); setPts([]); setName(''); await reloadPlaces(); load(); toast('Shortcut saved. It is on the map now') } catch (e) { toast(e.message || 'Could not save') }
  }
  const del = async x => { if (!window.confirm('Delete "' + x.name + '"?')) return; try { await backend.deletePath(x.id); await reloadPlaces(); load() } catch (e) { toast(e.message || 'Could not delete') } }
  const len = Math.round(lenOf(pts))
  return (
    <>
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <b>How to record shortcuts</b>
        <ol className="steps" style={{ lineHeight: 1.45 }}>
          <li><i>1</i><span>Record each footpath once, as its own piece. Do not record whole trips between two places. The app joins the pieces for you.</span></li>
          <li><i>2</i><span>Start where the footpath leaves a road, another shortcut, or a building door. End where it reaches one of those. Ends within 20 m of a road or another shortcut join it. Shortcuts that cross also join.</span></li>
          <li><i>3</i><span>Walk at a normal pace in the open, with the phone in your hand. Wait for accuracy under 10 m before you start.</span></li>
          <li><i>4</i><span>Name it by where it goes, like "Motion Ground to ICT, path 1". A place with five shortcuts means five recordings.</span></li>
          <li><i>5</i><span>One direction is enough. Walkers can use it both ways.</span></li>
          <li><i>6</i><span>Check it: open Map, choose the two places, and look for the white dotted line and "Includes a shortcut".</span></li>
        </ol>
      </div>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        {!rec ? <button className="btn blue block" onClick={start}>{pts.length ? 'Record again' : 'Start recording a shortcut'}</button> : <button className="btn gold block" onClick={stop}>Stop recording</button>}
        {(rec || pts.length > 0) && <div className="mut" style={{ lineHeight: 1.5 }}>{pts.length} points · {len} m{acc != null && rec ? ' · accuracy about ' + acc + ' m' : ''}{rec && acc > 20 ? ' (too weak, move to open sky)' : ''}</div>}
        {!rec && pts.length > 0 && (
          <>
            <div className="field"><label htmlFor="sc-name">Name</label><input className="inp" id="sc-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Motion Ground to ICT" /></div>
            <button className="btn gold block" onClick={save}>Save shortcut</button>
            <button className="btn line block" onClick={() => setPts([])}>Discard</button>
          </>
        )}
      </div>
      <div className="card" style={{ display: 'grid', gap: 8 }}>
        <b>Or paste from the collector</b>
        <textarea className="inp" style={{ minHeight: 100, padding: 12, fontSize: 14 }} value={paste} onChange={e => setPaste(e.target.value)} placeholder={'1 | Start | 6.922998, 3.87354 | 1 m\n2 | Waypoint | 6.923210, 3.87390 | 2 m\n3 | Destination | 6.923500, 3.87410 | 2 m'} />
        <button className="btn line block" onClick={importText} disabled={!paste.trim()}>Use these points</button>
      </div>
      <h3>Saved shortcuts</h3>
      {list && !list.length && <div className="card mut">None yet.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {(list || []).map(x => (
          <div className="card" key={x.id} style={{ display: 'grid', gap: 6 }}>
            <b>{x.name}</b><span className="mut" style={{ fontSize: 13 }}>{x.points.length} points · {Math.round(lenOf(x.points))} m</span>
            <button className="btn line" style={{ minHeight: 40, fontSize: 14, color: '#C0392B', justifySelf: 'start' }} onClick={() => del(x)}>Delete</button>
          </div>
        ))}
      </div>
    </>
  )
}
