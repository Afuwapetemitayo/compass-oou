import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state'
import { backend } from '../lib/backend'
import { ll } from '../lib/geo'
import { slugify } from '../lib/places'
import Icon from '../components/Icon'
import { View } from '../components/ui'

// Places that count as a way into the school: gates, parks, drop-off points, bus stops
export const isEntry = p => /gate|entran|drop|\bpark\b|\bbus\b|\bstop\b|junction/i.test(p.n + ' ' + p.t) && !/car park|department|faculty/i.test(p.n)
export const gmaps = p => { const [la, lo] = p.lat != null ? [p.lat, p.lng] : ll(p.x, p.y); return `https://www.google.com/maps/dir/?api=1&destination=${la.toFixed(6)},${lo.toFixed(6)}&travelmode=driving` }

const Step = ({ n, title, children }) => (
  <div className="card" style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="av" style={{ width: 32, height: 32, fontSize: 15 }}>{n}</span><h3>{title}</h3></div>
    {children}
  </div>
)

export default function Arrive() {
  const nav = useNavigate()
  const { places, gps } = useApp()
  const [tips, setTips] = useState(null)
  useEffect(() => { backend.listTips().then(setTips).catch(() => setTips([])) }, [])
  const ways = useMemo(() => places.filter(p => p.x != null && isEntry(p)), [places])
  const first = tips && tips.length ? tips : []
  return (
    <View>
      <div className="pad">
        <div><h1>Coming to OOU?</h1><p className="mut" style={{ marginTop: 4 }}>Three steps, from wherever you are now to the door of your faculty.</p></div>
        {gps.current && <div className="card" style={{ background: 'var(--mint)', display: 'grid', gap: 8 }}><b style={{ color: 'var(--mintInk)' }}>You are already on campus</b><button className="btn blue block" onClick={() => nav('/map')}>Open the map</button></div>}

        <Step n="1" title="Get to Ago-Iwoye">
          {tips === null && <p className="mut">Loading…</p>}
          {first.map(t => (
            <div key={t.id} style={{ display: 'grid', gap: 2 }}>
              <b>{t.title}</b>
              <p className="mut" style={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t.body}</p>
            </div>
          ))}
        </Step>

        <Step n="2" title="Get into the school">
          <p className="mut" style={{ lineHeight: 1.5 }}>Ask the driver to drop you at one of these. Tap Directions to open Google Maps from where you are. It works anywhere, even before you reach Ago-Iwoye.</p>
          {ways.length === 0 && <p className="mut">No entry points have been added yet.</p>}
          <div className="list">
            {ways.map(p => (
              <div key={p.n} className="li" style={{ display: 'grid', gap: 8, padding: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="ic"><Icon n="pin" /></span><span className="t"><b>{p.n}</b><span>{p.t}{p.note ? ' · ' + p.note : ''}</span></span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a className="btn gold" style={{ flex: 1, minHeight: 44, fontSize: 14, textDecoration: 'none' }} href={gmaps(p)} target="_blank" rel="noreferrer"><Icon n="nav" s={18} /> Directions</a>
                  <button className="btn line" style={{ flex: 1, minHeight: 44, fontSize: 14 }} onClick={() => nav('/map?to=' + slugify(p.n))}>On campus map</button>
                </div>
              </div>
            ))}
          </div>
        </Step>

        <Step n="3" title="Find your way inside">
          <p className="mut" style={{ lineHeight: 1.5 }}>Once you are through the gate, Compass takes over. Search your faculty, department, hall or office and follow the arrow.</p>
          <button className="btn blue block" onClick={() => nav('/directory')}><Icon n="search" s={18} /> Find a place</button>
          <button className="btn line block" onClick={() => nav('/map')}><Icon n="map" s={18} /> Open the map</button>
        </Step>
      </div>
    </View>
  )
}
