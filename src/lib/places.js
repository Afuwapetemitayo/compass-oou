import seed from '../data/seed.json'
import { xy, ll } from './geo'
import { snap } from './routing'

export const FACS = seed.facs
export const DEPS = seed.deps
export const CATS = ['All', 'Faculties', 'Departments', 'Offices', 'Halls', 'Library', 'Facilities', 'Buildings']
export const slugify = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// v: 0 = no location, 1 = checked on site (GPS), 2 = taken from OpenStreetMap, not checked yet
function finish(list) {
  const deptCount = {}
  list.forEach(p => { if (p.c === 'Departments') deptCount[p.f] = (deptCount[p.f] || 0) + 1 })
  list.forEach((p, i) => {
    p.i = i
    if (p.c === 'Faculties') p.k = deptCount[p.f] || p.k || 0
    if (p.x != null) p.s = snap(p)
  })
  return list
}

export function seedPlaces() {
  return finish(seed.places.map(p => ({ ...p, id: null, photo: null })))
}

export function fromRows(rows, photoUrl) {
  return finish(rows.map(r => {
    const [x, y] = r.lat != null ? xy(r.lat, r.lng) : [null, null]
    return {
      id: r.id, slug: r.slug, n: r.name, c: r.category, t: r.type_label || r.category.replace(/ies$/, 'y').replace(/s$/, ''),
      f: r.faculty || '', a: (r.aliases || []).join(', '), k: 0, x, y, lat: r.lat, lng: r.lng,
      v: r.lat == null ? 0 : (r.verified ? 1 : 2), note: r.note || '', photo: r.photo_path ? photoUrl(r.photo_path) : null
    }
  }))
}

export function toRow(p) {
  const [lat, lng] = p.x != null ? ll(p.x, p.y) : [null, null]
  return {
    slug: p.slug || slugify(p.n), name: p.n, category: p.c, type_label: p.t || null,
    faculty: p.f || null, aliases: p.a ? p.a.split(',').map(s => s.trim()).filter(Boolean) : [],
    note: p.note || null, lat, lng,
    location_source: lat == null ? null : (p.v === 1 ? 'gps' : 'osm'), verified: p.v === 1
  }
}

export const sub = p => p.c === 'Departments' ? 'Faculty of ' + p.f : (p.c === 'Faculties' ? p.k + ' departments' : p.t)
