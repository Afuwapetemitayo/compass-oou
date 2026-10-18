import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state'
import { CATS, sub, slugify } from '../lib/places'
import { FACS } from '../lib/places'
import Icon, { catIcon } from '../components/Icon'
import { Badge, PlaceRow, View, Sheet, initials } from '../components/ui'
import ReportSheet from '../components/ReportSheet'

export const placePath = p => '/place/' + slugify(p.n)
const mapPath = p => '/map?to=' + slugify(p.n)

/* ------------------------------- Home ------------------------------- */
export function Home() {
  const nav = useNavigate()
  const { profile: u, places, pins, signOut, isAdmin, hasSupabase } = useApp()
  const [sheet, setSheet] = useState(false)
  const [report, setReport] = useState(false)
  const dp = places.find(p => p.n === 'Department of ' + u.dep)
  const pop = ['Motion Ground', 'School Park', 'Senate Building', 'University Library', 'Faculty of Science', 'Office of the University Registrar'].map(n => places.find(p => p.n === n)).filter(Boolean)
  const cats = [['Faculties', 'build'], ['Departments', 'build'], ['Halls', 'build'], ['Offices', 'build'], ['Library', 'build'], ['Facilities', 'pin']]
  const open = p => nav(placePath(p))
  return (
    <View>
      <div className="pad">
        <div className="top" style={{ padding: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}><div className="mut" style={{ fontSize: 13 }}>Hello,</div><h2>{(u.name || 'Student').split(' ')[0]}</h2></div>
          <button className="av" onClick={() => setSheet(true)} aria-label="Account">{initials(u.name)}</button>
        </div>
        <button className="search" onClick={() => nav('/directory')} style={{ textAlign: 'left', color: 'var(--muted)' }}><Icon n="search" /><span>Search any place on campus</span></button>
        {dp ? (
          <div className="hero">
            <span style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .8 }}>My department</span>
            <h2 style={{ color: '#fff' }}>{dp.n}</h2>
            <span style={{ opacity: .85 }}>{sub(dp)}</span>
            {dp.x != null ? <button className="btn gold" onClick={() => nav(mapPath(dp))}><Icon n="nav" s={18} /> Directions</button> : <span className="pill off">Location coming soon</span>}
          </div>
        ) : <div className="card"><b>No department yet</b><p className="mut">Pin yours from the Directory.</p></div>}
        <div>
          <h3 style={{ marginBottom: 10 }}>Browse</h3>
          <div className="stats" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            {cats.map(([c, i]) => <button key={c} className="card" style={{ display: 'grid', gap: 6, justifyItems: 'center', padding: '12px 4px', fontWeight: 600, fontSize: 13 }} onClick={() => nav('/directory', { state: { cat: c } })}><span className="ic"><Icon n={i} /></span>{c}</button>)}
          </div>
        </div>
        <div><h3 style={{ marginBottom: 10 }}>Popular places</h3><div className="list">{pop.map(p => <PlaceRow key={p.n} p={p} onOpen={open} />)}</div></div>
        {pins.length > 0 && <div><h3 style={{ marginBottom: 10 }}>Pinned</h3><div className="list">{pins.map(p => <PlaceRow key={p.n} p={p} onOpen={open} />)}</div></div>}
      </div>
      {sheet && (
        <Sheet onClose={() => setSheet(false)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="av">{initials(u.name)}</span>
            <div><b>{u.name}</b><div className="mut" style={{ fontSize: 13 }}>{u.dep || 'No department'} · {u.lv} level</div></div>
          </div>
          <button className="btn line block" onClick={() => nav('/signup?edit=1')}>Edit my details</button>
          {isAdmin && <button className="btn line block" onClick={() => nav('/admin')}>Admin dashboard{hasSupabase ? '' : ' (test)'}</button>}
          <button className="btn line block" onClick={() => { setSheet(false); setReport(true) }}>Report a problem</button>
          <button className="btn line block" onClick={() => { setSheet(false); nav('/map?credits=1') }}>About and map credits</button>
          <button className="btn block" style={{ background: 'none', color: '#C0392B' }} onClick={() => signOut().then(() => nav('/welcome', { replace: true }))}>Sign out</button>
        </Sheet>
      )}
      {report && <ReportSheet onClose={() => setReport(false)} />}
    </View>
  )
}

/* ----------------------------- Directory ----------------------------- */
export function Directory() {
  const nav = useNavigate()
  const { state } = useLocation()
  const { places, pins, togglePin, log, profile } = useApp()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState((state && state.cat) || 'All')
  const [fac, setFac] = useState('')
  const pinned = pins.map(p => p.n)
  const ql = q.trim().toLowerCase()
  const list = useMemo(() => places.filter(p => (cat === 'All' || p.c === cat) && (!fac || p.f === fac) && (!ql || (p.n + ' ' + p.t + ' ' + p.f + ' ' + p.a).toLowerCase().includes(ql))), [places, cat, fac, ql])
  useEffect(() => { // count a search once the person stops typing
    if (ql.length < 2) return
    const t = setTimeout(() => log({ type: 'search', query: ql, results: list.length }), 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [ql])
  const count = c => c === 'All' ? places.length : places.filter(p => p.c === c).length
  return (
    <View>
      <div className="pad">
        <h1>Directory</h1>
        <label className="search" htmlFor="dq"><Icon n="search" /><input id="dq" value={q} onChange={e => setQ(e.target.value)} placeholder="Search faculty, department, hall, office" autoComplete="off" /></label>
        <div className="chips">{CATS.map(c => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => { setCat(c); setFac('') }}>{c} · {count(c)}</button>)}</div>
        {cat === 'Departments' && <div className="chips">{['', ...FACS].map(f => <button key={f} className="chip g" aria-pressed={fac === f} onClick={() => setFac(f)}>{f || 'All faculties'}</button>)}</div>}
        <div className="mut" style={{ fontSize: 13 }}>{list.length} {list.length === 1 ? 'place' : 'places'}</div>
        <div className="list">
          {list.length ? list.map(p => (
            <div key={p.n} className="li" style={{ padding: 0 }}>
              <button className="li" style={{ border: 0, flex: 1 }} onClick={() => nav(placePath(p))}>
                <span className="ic"><Icon n={catIcon[p.c] || 'build'} /></span>
                <span className="t"><b>{p.n}</b><span>{sub(p)}</span></span>
                <Badge p={p} />
              </button>
              {p.c === 'Departments' && <button className="ib" style={{ marginRight: 10, borderRadius: 12, ...(pinned.includes(p.n) ? { background: 'var(--gold)', color: '#0A1B4D', borderColor: 'var(--gold)' } : {}) }} onClick={() => togglePin(p)} aria-label={'Pin ' + p.n}><Icon n="star" /></button>}
            </div>
          )) : <div className="li"><span className="t"><b>No match</b><span>Try another word, like FOS or ICT.</span></span></div>}
        </div>
      </div>
    </View>
  )
}

/* ------------------------------- Place ------------------------------- */
export function Place() {
  const nav = useNavigate()
  const { slug } = useParams()
  const { bySlug, pins, togglePin, log } = useApp()
  const [report, setReport] = useState(false)
  const p = bySlug(slug)
  useEffect(() => { if (p) log({ type: 'place_view' }, p) /* eslint-disable-next-line */ }, [slug])
  if (!p) return <View><div className="pad"><div className="top" style={{ padding: 0 }}><button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button></div><h1>Place not found</h1><button className="btn blue block" onClick={() => nav('/directory')}>Open the Directory</button></div></View>
  const isPinned = pins.some(x => x.n === p.n)
  return (
    <View>
      <div className="pad">
        <div className="top" style={{ padding: 0 }}>
          <button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button><div className="sp" />
          {p.c === 'Departments' && <button className="btn line" style={{ minHeight: 44, fontSize: 14 }} onClick={() => togglePin(p)}><Icon n="star" s={18} /> {isPinned ? 'Pinned' : 'Pin as mine'}</button>}
        </div>
        <div className="photo">{p.photo ? <img src={p.photo} alt={p.n} /> : <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}><Icon n="cam" /><span>Photo coming soon</span></div>}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <h1>{p.n}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><Badge p={p} /><span className="mut">{sub(p)}{p.a ? ' · also ' + p.a : ''}</span></div>
        </div>
        {p.x != null ? (
          <>
            <button className="btn gold block" onClick={() => nav(mapPath(p))}><Icon n="nav" s={18} /> Get directions</button>
            <button className="btn line block" onClick={() => nav(mapPath(p))}><Icon n="map" s={18} /> Show on map</button>
          </>
        ) : <div className="card"><b>Location coming soon</b><p className="mut" style={{ marginTop: 4 }}>We have not captured this place on site yet. You can still ask at the faculty office.</p></div>}
        {p.v === 2 && <div className="card" style={{ background: 'var(--tint)' }}><b>Not yet checked on site</b><p className="mut" style={{ marginTop: 4 }}>We have not checked this position on site yet. It may be a few metres off.</p></div>}
        <div className="card"><h3>Getting there</h3><ol className="steps" style={{ marginTop: 10 }}><li><i>1</i><span>Tap Get directions and choose where you are, or use your location.</span></li><li><i>2</i><span>Follow the gold path. The arrow shows the way.</span></li><li><i>3</i><span>Pick Walk, Keke Napep or Car to see the minutes.</span></li></ol></div>
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <h3>About and history</h3>
          {p.h ? p.h.split(/\n\s*\n/).map((para, i) => <p key={i} style={{ lineHeight: 1.55, overflowWrap: 'anywhere' }}>{para}</p>)
            : <p className="mut" style={{ lineHeight: 1.5 }}>The story of this place has not been added yet. Do you know when it was built or why it is called this? Tell us and we will add it.</p>}
          {!p.h && <button className="btn line" style={{ minHeight: 44, fontSize: 14, justifySelf: 'start' }} onClick={() => setReport(true)}>Share what you know</button>}
        </div>
        {p.note && <div className="card"><b>Good to know</b><p className="mut" style={{ marginTop: 4 }}>{p.note}</p></div>}
        <button className="btn block" style={{ background: 'none', color: 'var(--muted)', fontWeight: 600, fontSize: 14, minHeight: 44 }} onClick={() => setReport(true)}>Wrong or missing info? Report a problem</button>
      </div>
      {report && <ReportSheet place={p} onClose={() => setReport(false)} />}
    </View>
  )
}

/* -------------------------------- FAQ -------------------------------- */
const FAQ = [
  ['Where do I collect my ID card?', "Go to your faculty officer or the Dean's office. They will tell you the days and what to bring."],
  ['How do I find my lecture hall?', 'Ask your class rep first, then search the hall name in the Directory and tap Get directions.'],
  ['Who do I call if I am lost?', 'Call the university support line, then use Map to see where you are.']
]
export function Faq() {
  const nav = useNavigate()
  const [open, setOpen] = useState(0)
  return (
    <View>
      <div className="pad">
        <h1>FAQ</h1><p className="mut">Quick answers for new students.</p>
        <div className="photo" style={{ aspectRatio: '16/8', background: 'linear-gradient(135deg,var(--blue2),var(--blue))', color: '#fff', textAlign: 'left', placeItems: 'end start', padding: 16 }}>
          <div><div style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .8 }}>New here?</div><h2 style={{ color: '#fff' }}>Start at School Park</h2><span style={{ opacity: .85 }}>The drop-off point. Most people are dropped here, then walk or take a keke.</span></div>
        </div>
        <button className="btn gold block" style={{ minHeight: 48 }} onClick={() => nav('/map?to=school-park')}>Show School Park on map</button>
        <div>{FAQ.map((f, i) => (
          <div className="faq" key={i}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{f[0]}<span>{open === i ? '−' : '+'}</span></button>
            {open === i && <p>{f[1]}</p>}
          </div>
        ))}</div>
        <div className="card"><h3>University contacts</h3><p className="mut" style={{ marginTop: 6, lineHeight: 1.6 }}>+234 913 500 4446<br />+234 913 500 4447<br />enquiry@oouagoiwoye.edu.ng</p></div>
      </div>
    </View>
  )
}
