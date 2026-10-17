// Draws the campus map and the route on an <svg>. Plain DOM drawing (fast, no re-render per frame).
import { N, EDGES, BLDS } from './routing'

const NS = 'http://www.w3.org/2000/svg'
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

export class MapEngine {
  constructor(svg, { getBottomH, onPick }) {
    this.svg = svg; this.getBottomH = getBottomH; this.onPick = onPick
    this.vb = null; this.tween = 0; this.raf = 0; this.nav = null
    this.click = e => { if (this.nav) return; const i = e.target.getAttribute && e.target.getAttribute('data-p'); if (i != null) this.onPick(+i) }
    svg.addEventListener('click', this.click)
  }
  destroy() { cancelAnimationFrame(this.tween); cancelAnimationFrame(this.raf); this.svg.removeEventListener('click', this.click) }
  el(t, a, p) { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || this.svg).appendChild(e); return e }
  build(places) {
    const { svg } = this
    svg.replaceChildren()
    this.gB = this.el('g', {}); this.gR = this.el('g', {}); this.gP = this.el('g', {}); this.gRoute = this.el('g', {})
    BLDS.forEach(poly => this.el('polygon', { points: poly.map(p => p.join(',')).join(' '), fill: cssv('--bld') }, this.gB))
    EDGES.forEach(([a, b]) => this.el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: cssv('--roadEdge'), 'stroke-width': 9, 'stroke-linecap': 'round' }, this.gR))
    EDGES.forEach(([a, b]) => this.el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: cssv('--road'), 'stroke-width': 6, 'stroke-linecap': 'round' }, this.gR))
    places.filter(p => p.x != null).forEach(p => {
      this.el('circle', { cx: p.x, cy: p.y, r: 3.4, fill: p.v === 2 ? cssv('--gold') : cssv('--blue'), stroke: cssv('--card'), 'stroke-width': 1.2 }, this.gP)
      this.el('circle', { cx: p.x, cy: p.y, r: 12, fill: 'transparent', 'data-p': p.i, style: 'cursor:pointer' }, this.gP)
    })
  }
  full() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; N.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) }); return [[x0, y0], [x1, y1]] }
  setVB(v) { this.svg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' ')) }
  fit(pts, pad) {
    const w = this.svg.clientWidth || 400, h = this.svg.clientHeight || 700
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) })
    const topPx = 150, botPx = this.getBottomH() + 30
    const aw = w - 60, ah = h - topPx - botPx
    let s = Math.max((x1 - x0 + 2 * pad) / aw, (y1 - y0 + 2 * pad) / ah); s = Math.max(s, .18)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, vw = w * s, vh = h * s, off = (topPx - botPx) / 2 * s
    return [cx - vw / 2, cy - vh / 2 - off, vw, vh]
  }
  tweenTo(t, instant) {
    cancelAnimationFrame(this.tween)
    const from = this.vb && !instant ? this.vb : t, t0 = performance.now()
    const step = now => {
      const k = Math.min(1, (now - t0) / 800), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.vb = from.map((v, i) => v + (t[i] - v) * e); this.setVB(this.vb)
      if (k < 1) this.tween = requestAnimationFrame(step)
    }
    this.tween = requestAnimationFrame(step)
  }
  labelAt(p, txt, col, s) {
    const g = this.el('g', {}, this.gRoute)
    const t = this.el('text', { x: p.x, y: p.y - 14 * s, 'text-anchor': 'middle', 'font-size': 13 * s, 'font-weight': 700, fill: cssv('--ink'), 'paint-order': 'stroke', stroke: cssv('--card'), 'stroke-width': 4 * s, 'stroke-linejoin': 'round' }, g)
    t.textContent = txt.replace('Department of ', 'Dept. ').replace('Faculty of ', 'Fac. ')
    this.el('circle', { cx: p.x, cy: p.y, r: 7 * s, fill: col, stroke: cssv('--card'), 'stroke-width': 2.5 * s }, g)
  }
  clearRoute() { this.stopNav(); this.gRoute.replaceChildren() }
  showAll(to) {
    this.clearRoute()
    const b = this.full(), t = this.fit([b[0], b[1]], 20)
    if (this.vb) this.tweenTo(t); else { this.vb = t; this.setVB(t) }
    if (to) this.labelAt(to, to.n, cssv('--pin'), (t[2] / (this.svg.clientWidth || 400)) * 1.2)
  }
  showRoute(cur, a, b) {
    this.clearRoute()
    const pts = cur.pts, target = this.fit(pts, 40)
    this.tweenTo(target)
    const s = target[2] / (this.svg.clientWidth || 400), d = 'M' + pts.map(p => p.join(' ')).join(' L')
    this.el('path', { d, fill: 'none', stroke: cssv('--gold'), 'stroke-width': 7 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.gRoute)
    this.labelAt(a, a.n, cssv('--blue'), s * 1.25); this.labelAt(b, b.n, cssv('--pin'), s * 1.25)
  }
  /* ---- live navigation ---- */
  drawNav(cur, b) {
    const n = this.nav, s = n.sN, pts = cur.pts, d = 'M' + pts.map(p => p.join(' ')).join(' L')
    this.gRoute.replaceChildren(); cancelAnimationFrame(this.tween)
    this.el('path', { d, fill: 'none', stroke: cssv('--blue'), 'stroke-width': 6 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': `${s} ${12 * s}`, opacity: .55 }, this.gRoute)
    n.trail = this.el('path', { d, fill: 'none', stroke: cssv('--gold'), 'stroke-width': 7 * s, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.gRoute)
    n.L = n.trail.getTotalLength(); n.trail.setAttribute('stroke-dasharray', `0 ${n.L + 50}`)
    this.labelAt(b, b.n, cssv('--pin'), s * 1.25)
    n.ar = this.el('g', {}, this.gRoute)
    this.el('circle', { r: 13 * s, fill: cssv('--card'), stroke: cssv('--blue'), 'stroke-width': 3 * s }, n.ar)
    this.el('path', { d: `M${9 * s} 0 L${-6 * s} ${-7 * s} L${-3 * s} 0 L${-6 * s} ${7 * s}Z`, fill: cssv('--blue') }, n.ar)
  }
  // opts: { real, speed() -> metres per second, start:{x,y}, onTick(progress), onArrive() }
  startNav(cur, b, opts) {
    this.clearRoute()
    this.nav = { real: opts.real, prog: 0, t: 0, pt: { x: opts.start.x, y: opts.start.y }, done: false, sN: .26, opts }
    this.drawNav(cur, b)
    this.nav.raf = requestAnimationFrame(now => this.loop(now))
  }
  setFix(pt, prog) { if (this.nav) { this.nav.pt = pt; this.nav.prog = prog } }
  reroute(cur, b, pt) { if (!this.nav) return; this.nav.prog = 0; this.nav.pt = pt; this.drawNav(cur, b) }
  loop(now) {
    const n = this.nav
    if (!n || n.done) return
    const dt = Math.min(.1, (now - (n.t || now)) / 1000); n.t = now
    if (!n.real) n.prog = Math.min(n.L, n.prog + n.opts.speed() * (window.__sim || 12) * dt)
    const l = Math.min(n.L, n.prog), tr = n.trail
    tr.setAttribute('stroke-dasharray', `${l} ${n.L + 50}`)
    const p = tr.getPointAtLength(l), p2 = tr.getPointAtLength(Math.min(n.L, l + 4)), p0 = tr.getPointAtLength(Math.max(0, l - 4))
    const pt = n.real ? n.pt : { x: p.x, y: p.y }
    n.ar.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${Math.atan2(p2.y - p0.y, p2.x - p0.x) * 180 / Math.PI})`)
    const w = this.svg.clientWidth || 400, h = this.svg.clientHeight || 700, vw = w * n.sN, vh = h * n.sN
    const off = (130 - this.getBottomH()) / 2 * n.sN
    const tg = [pt.x - vw / 2, pt.y - vh / 2 - off, vw, vh]
    this.vb = this.vb ? this.vb.map((v, i) => v + (tg[i] - v) * .14) : tg; this.setVB(this.vb)
    if (!n.u || now - n.u > 400) { n.u = now; n.opts.onTick(n.prog, n.L) }
    if (n.L - n.prog < 12) { n.done = true; n.opts.onArrive(); return }
    n.raf = requestAnimationFrame(t => this.loop(t))
  }
  stopNav() { if (this.nav) { cancelAnimationFrame(this.nav.raf); this.nav = null } }
}
