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

// nearest point on any road edge
function nearestOnRoad(x, y) {
  let best = null
  EDGES.forEach(([a, b], ei) => {
    const ax = N[a][0], ay = N[a][1], dx = N[b][0] - ax, dy = N[b][1] - ay, l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py)
    if (!best || d < best.d) best = { d, ei, t, px, py }
  })
  return best
}
// make a node on the road at that spot (splitting the road in two) and return its id
function joinRoad(hit) {
  const [a, b] = EDGES[hit.ei]
  if (hit.t < .02) return a
  if (hit.t > .98) return b
  const id = N.push([hit.px, hit.py]) - 1
  EDGES[hit.ei] = [a, id]; EDGES.push([id, b])
  return id
}
// paths: [{ points: [[lat, lng], ...] }]  Called with the full list every time, so it can be called again safely.
export function setPaths(paths, toXY) {
  N.length = BASE_N.length; EDGES.length = 0; BASE_E.forEach(e => EDGES.push(e.slice())); PEDGES.length = 0
  ;(paths || []).forEach(pa => {
    const pts = (pa.points || []).map(q => toXY(q[0], q[1]))
    if (pts.length < 2) return
    let prev = null
    pts.forEach((q, i) => {
      const end = i === 0 || i === pts.length - 1
      const hit = nearestOnRoad(q[0], q[1])
      let id
      if (hit && hit.d <= (end ? 30 : 6)) { id = joinRoad(hit); if (hit.d > 1) { /* a short link from the path point to the road */ } }
      const nid = N.push([q[0], q[1]]) - 1
      if (id != null) PEDGES.push([nid, id])
      if (prev != null) PEDGES.push([prev, nid])
      prev = nid
    })
  })
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
