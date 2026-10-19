import roads from '../data/roads.json'

// The base road map never changes. Recorded shortcuts (footpaths) are added on top by setPaths().
const BASE_N = roads.nodes, BASE_E = roads.edges
export const N = BASE_N.map(n => n.slice())     // nodes: [x, y]  (metres from the campus origin)
export const EDGES = BASE_E.map(e => e.slice()) // road edges (a road can be split where a shortcut joins it)
export const PEDGES = []                         // footpath edges
export const BLDS = roads.blds
let adj = [], adjR = []                          // adj: roads + footpaths, adjR: roads only
function rebuild() {
  adj = N.map(() => []); adjR = N.map(() => [])
  const add = (list, a, b, only) => { const w = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]); adj[a].push([b, w]); adj[b].push([a, w]); if (only) { adjR[a].push([b, w]); adjR[b].push([a, w]) } }
  EDGES.forEach(([a, b]) => add(null, a, b, true))
  PEDGES.forEach(([a, b]) => add(null, a, b, false))
}
rebuild()

// Edge lists: roads are [a, b]; footpaths are [a, b, pathNumber].
const listOf = k => k === 'r' ? EDGES : PEDGES
// nearest point on any edge that does not belong to path `own` (roads count as nobody's)
function nearestEdge(x, y, own) {
  let best = null
  ;[['r', EDGES], ['p', PEDGES]].forEach(([kind, L]) => L.forEach((e, idx) => {
    if (kind === 'p' && e[2] === own) return
    const ax = N[e[0]][0], ay = N[e[0]][1], dx = N[e[1]][0] - ax, dy = N[e[1]][1] - ay, l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py)
    if (!best || d < best.d) best = { d, kind, idx, t, px, py }
  }))
  return best
}
// put a node on an edge (splitting it in two) and return that node's id
function splitAt(kind, idx, t, px, py) {
  const L = listOf(kind), e = L[idx]
  if (t < .02) return e[0]
  if (t > .98) return e[1]
  const id = N.push([px, py]) - 1
  const own = e[2]
  L[idx] = kind === 'p' ? [e[0], id, own] : [e[0], id]
  L.push(kind === 'p' ? [id, e[1], own] : [id, e[1]])
  return id
}
// where two segments cross (proper crossing only), or null
function cross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], q = [d[0] - c[0], d[1] - c[1]], den = r[0] * q[1] - r[1] * q[0]
  if (Math.abs(den) < 1e-9) return null
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
  return t > .02 && t < .98 && u > .02 && u < .98 ? { t, u, x: a[0] + t * r[0], y: a[1] + t * r[1] } : null
}
// paths: [{ points: [[lat, lng], ...] }]. Called with the full list every time, so it is safe to call again.
// A footpath joins a road or another footpath where its ends are close to it (20 m), where it passes right by it (5 m), or where they cross.
export function setPaths(paths, toXY) {
  N.length = BASE_N.length; EDGES.length = 0; BASE_E.forEach(e => EDGES.push(e.slice())); PEDGES.length = 0
  const owned = (paths || []).map((pa, pi) => {
    const pts = (pa.points || []).map(q => toXY(q[0], q[1]))
    if (pts.length < 2) return null
    const ids = pts.map(q => N.push([q[0], q[1]]) - 1)
    for (let i = 1; i < ids.length; i++) PEDGES.push([ids[i - 1], ids[i], pi])
    return ids
  })
  // 1) ends and close passes
  owned.forEach((ids, pi) => {
    if (!ids) return
    ids.forEach((id, k) => {
      const end = k === 0 || k === ids.length - 1, hit = nearestEdge(N[id][0], N[id][1], pi)
      if (hit && hit.d <= (end ? 20 : 5)) { const j = splitAt(hit.kind, hit.idx, hit.t, hit.px, hit.py); if (j !== id) PEDGES.push([id, j, -1]) }
    })
  })
  // 2) footpaths that cross a road or another footpath
  for (let guard = 0; guard < 300; guard++) {
    let found = null
    outer: for (let i = 0; i < PEDGES.length; i++) {
      const e = PEDGES[i]; if (e[2] < 0) continue
      for (const [kind, L] of [['r', EDGES], ['p', PEDGES]]) for (let j = 0; j < L.length; j++) {
        const f = L[j]; if (kind === 'p' && (f[2] < 0 || f[2] === e[2])) continue
        const x = cross(N[e[0]], N[e[1]], N[f[0]], N[f[1]])
        if (x) { found = { i, kind, j, x }; break outer }
      }
    }
    if (!found) break
    const { i, kind, j, x } = found
    const id = splitAt('p', i, x.t, x.x, x.y)
    // split the other edge at the same spot, reusing the node
    const L = listOf(kind), f = L[j], own = f[2]
    L[j] = kind === 'p' ? [f[0], id, own] : [f[0], id]
    L.push(kind === 'p' ? [id, f[1], own] : [id, f[1]])
  }
  rebuild()
}
export const pathCount = () => PEDGES.length

export const MODES = [{ k: 'walk', n: 'Walk', v: 5 }, { k: 'keke', n: 'Keke Napep', v: 15 }, { k: 'car', n: 'Car', v: 20 }]
export const mins = (len, m) => Math.max(1, Math.round(len / (MODES.find(x => x.k === m).v / 3.6) / 60))

export function snap(p) {
  let b = 0, bd = 1e9
  N.forEach((q, i) => { const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; b = i } })
  return b
}

// nearest node that is part of the road network (not a footpath node)
export function snapRoad(p) {
  let b = 0, bd = 1e9
  N.forEach((q, i) => { if (!adjR[i].length) return; const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; b = i } })
  return b
}

// Shortest path along the roads between two points that have x, y and s (snapped node).
export function route(a, b, opts) {
  const A = opts && opts.roadsOnly ? adjR : adj
  const s = a.s, t = b.s, dist = new Float64Array(N.length).fill(1e18), prev = new Int32Array(N.length).fill(-1)
  dist[s] = 0
  const done = new Uint8Array(N.length)
  for (;;) {
    let u = -1, m = 1e18
    for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < m) { m = dist[i]; u = i }
    if (u < 0 || u === t) break
    done[u] = 1
    for (const [v, w] of A[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u }
  }
  if (dist[t] > 1e17) return { pts: [[a.x, a.y], [b.x, b.y]], len: Math.hypot(a.x - b.x, a.y - b.y), broken: true }
  const ids = [t]
  while (ids[0] !== s && prev[ids[0]] >= 0) ids.unshift(prev[ids[0]])
  const pts = [[a.x, a.y], ...ids.map(i => N[i]), [b.x, b.y]]
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return { pts, len }
}

// How far a point is from the route, and how far along the route it is.
export function project(cur, pt) {
  const p = cur.pts
  let best = 1e9, at = 0, cum = 0
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][0], ay = p[i - 1][1], bx = p[i][0], by = p[i][1], dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy, len = Math.sqrt(l2)
    let t = l2 ? ((pt.x - ax) * dx + (pt.y - ay) * dy) / l2 : 0
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(pt.x - (ax + t * dx), pt.y - (ay + t * dy))
    if (d < best) { best = d; at = cum + t * len }
    cum += len
  }
  return { off: best, d: at }
}
