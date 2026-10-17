import roads from '../data/roads.json'

export const N = roads.nodes
export const EDGES = roads.edges
export const BLDS = roads.blds
const adj = N.map(() => [])
EDGES.forEach(([a, b]) => {
  const w = Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1])
  adj[a].push([b, w]); adj[b].push([a, w])
})

export const MODES = [{ k: 'walk', n: 'Walk', v: 5 }, { k: 'keke', n: 'Keke Napep', v: 15 }, { k: 'car', n: 'Car', v: 20 }]
export const mins = (len, m) => Math.max(1, Math.round(len / (MODES.find(x => x.k === m).v / 3.6) / 60))

export function snap(p) {
  let b = 0, bd = 1e9
  N.forEach((q, i) => { const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; b = i } })
  return b
}

// Shortest path along the roads between two points that have x, y and s (snapped node).
export function route(a, b) {
  const s = a.s, t = b.s, dist = new Float64Array(N.length).fill(1e18), prev = new Int32Array(N.length).fill(-1)
  dist[s] = 0
  const done = new Uint8Array(N.length)
  for (;;) {
    let u = -1, m = 1e18
    for (let i = 0; i < N.length; i++) if (!done[i] && dist[i] < m) { m = dist[i]; u = i }
    if (u < 0 || u === t) break
    done[u] = 1
    for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u }
  }
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
