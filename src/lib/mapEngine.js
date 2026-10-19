// Draws the campus map and the route on an <svg>. Plain DOM drawing (fast, no re-render per frame).
import { N, EDGES, PEDGES, BLDS } from './routing'

const NS = 'http://www.w3.org/2000/svg'
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()

export class MapEngine {
  constructor(svg, { getBottomH, onPick }) {
    this.svg = svg; this.getBottomH = getBottomH; this.onPick = onPick
    this.vb = null; this.tween = 0; this.raf = 0; this.nav = null; this.me = null; this.places = []; this.labelsOn = true; this.lraf = 0
    this.ptrs = new Map(); this.moved = false
    this.hidden = new Set()
    this.click = e => { if (this.moved) return; const i = e.target.getAttribute && e.target.getAttribute('data-p'); if (i != null) this.onPick(+i) }
    this.down = e => { this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.ptrs.size === 1) this.moved = false; this.pinch = null }
    this.move = e => {
      const o = this.ptrs.get(e.pointerId); if (!o || this.nav || !this.vb) return
      const n = { x: e.clientX, y: e.clientY }
      if (this.ptrs.size === 1) {
        const dx = n.x - o.x, dy = n.y - o.y
        if (!this.moved && Math.hypot(dx, dy) < 6) return
        this.moved = true; cancelAnimationFrame(this.tween)
        const sc = this.vb[2] / (this.svg.clientWidth || 400)
        this.vb = [this.vb[0] - dx * sc, this.vb[1] - dy * sc, this.vb[2], this.vb[3]]; this.setVB(this.vb)
        this.ptrs.set(e.pointerId, n)
      } else if (this.ptrs.size === 2) {
        this.moved = true; cancelAnimationFrame(this.tween)
        this.ptrs.set(e.pointerId, n)
        const [a, b] = [...this.ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        if (this.pinch) this.zoomBy(this.pinch / d, mx, my)
        this.pinch = d
      }
    }
    this.up = e => { this.ptrs.delete(e.pointerId); this.pinch = null; if (!this.ptrs.size) setTimeout(() => { this.moved = false }, 0) }
    this.wheel = e => { if (this.nav) return; e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * .0015), e.clientX, e.clientY) }
    svg.addEventListener('click', this.click); svg.addEventListener('pointerdown', this.down); svg.addEventListener('pointermove', this.move)
    svg.addEventListener('pointerup', this.up); svg.addEventListener('pointercancel', this.up); svg.addEventListener('wheel', this.wheel, { passive: false })
  }
  destroy() {
    cancelAnimationFrame(this.tween); cancelAnimationFrame(this.raf); cancelAnimationFrame(this.lraf)
    const { svg } = this; svg.removeEventListener('click', this.click); svg.removeEventListener('pointerdown', this.down); svg.removeEventListener('pointermove', this.move)
    svg.removeEventListener('pointerup', this.up); svg.removeEventListener('pointercancel', this.up); svg.removeEventListener('wheel', this.wheel)
  }
  // metres per pixel at the current zoom
  scale() { return this.vb ? this.vb[2] / (this.svg.clientWidth || 400) : 1 }
  // f > 1 zooms out, f < 1 zooms in; (cx, cy) is the screen point that stays put
  zoomBy(f, cx, cy) {
    if (!this.vb) return
    const r = this.svg.getBoundingClientRect(), [x, y, w, h] = this.vb, sc = w / (r.width || 400)
    const nsc = Math.min(3, Math.max(.07, sc * f)), k = nsc / sc
    const px = cx == null ? r.width / 2 : cx - r.left, py = cy == null ? r.height / 2 : cy - r.top
    const wx = x + px * sc, wy = y + py * sc
    this.vb = [wx - px * nsc, wy - py * nsc, w * k, h * k]; this.setVB(this.vb)
  }
  zoomStep(f) { cancelAnimationFrame(this.tween); this.zoomBy(f) }
  centerOn(pt, sc) {
    const w = this.svg.clientWidth || 400, h = this.svg.clientHeight || 700, s = sc || Math.min(this.scale(), .3)
    const off = (150 - this.getBottomH()) / 2 * s
    this.tweenTo([pt.x - w * s / 2, pt.y - h * s / 2 - off, w * s, h * s])
  }
  el(t, a, p) { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (p || this.svg).appendChild(e); return e }
  build(places) {
    const { svg } = this
    svg.replaceChildren()
    this.places = places
    this.gB = this.el('g', {}); this.gA = this.el('g', { 'pointer-events': 'none' }); this.gR = this.el('g', {}); this.gP = this.el('g', {}); this.gL = this.el('g', { 'pointer-events': 'none' }); this.gRoute = this.el('g', {}); this.gMe = this.el('g', { 'pointer-events': 'none' })
    // which building holds which place, so that building can be coloured and tapped
    const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt.y) !== (b[1] > pt.y) && pt.x < (b[0] - a[0]) * (pt.y - a[1]) / (b[1] - a[1]) + a[0]) c = !c } return c }
    const rank = { Faculties: 0, Library: 1, Halls: 2, Offices: 3, Facilities: 4, Buildings: 5, Departments: 6 }
    this.bOf = {}; this.bEl = {}
    const owner = BLDS.map(() => null)
    places.filter(p => p.x != null && !p.inherit).forEach(p => { BLDS.forEach((poly, bi) => { if (inPoly(p, poly) && (owner[bi] == null || (rank[p.c] ?? 9) < (rank[places[owner[bi]].c] ?? 9))) owner[bi] = p.i }) })
    BLDS.forEach(poly => this.el('polygon', { points: poly.map(q => (q[0] + 1.3) + ',' + (q[1] + 1.7)).join(' '), fill: '#8D9ACB', opacity: .35 }, this.gB))   // soft shadow
    BLDS.forEach((poly, bi) => {
      const pts = poly.map(q => q.join(',')).join(' '), o = owner[bi]
      const e = this.el('polygon', { points: pts, fill: o != null ? '#C7D5FF' : cssv('--bld'), stroke: o != null ? '#7F98E8' : '#B4BEDC', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, this.gB)
      if (o != null) { e.setAttribute('data-p', o); e.style.cursor = 'pointer'; this.bEl[o] = e; this.bOf[o] = bi }
    })
    EDGES.forEach(([a, b]) => this.el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: cssv('--roadEdge'), 'stroke-width': 9, 'stroke-linecap': 'round' }, this.gR))
    EDGES.forEach(([a, b]) => this.el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: cssv('--road'), 'stroke-width': 6, 'stroke-linecap': 'round' }, this.gR))
    PEDGES.forEach(([a, b]) => this.el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '1 5', 'stroke-linecap': 'round', opacity: .95 }, this.gR))
    this.pin = {}; this.lab = []
    places.filter(p => p.x != null && !p.inherit).forEach(p => {
      this.pin[p.i] = this.el('circle', { cx: p.x, cy: p.y, r: 3.4, fill: p.v === 2 ? cssv('--gold') : cssv('--blue'), stroke: cssv('--card'), 'stroke-width': 1.2 }, this.gP)
      this.el('circle', { cx: p.x, cy: p.y, r: 12, fill: 'transparent', 'data-p': p.i, style: 'cursor:pointer' }, this.gP)
      const t = this.el('text', { 'text-anchor': 'middle', 'font-weight': 700, fill: cssv('--ink'), 'paint-order': 'stroke', stroke: '#fff', 'stroke-linejoin': 'round', display: 'none' }, this.gL)
      t.textContent = p.n.replace('Department of ', '').replace('Faculty of ', '')
      this.lab.push({ p, t, r: rank[p.c] ?? 9 })
    })
    this.lab.sort((a, b) => a.r - b.r)
    this.drawMe(); this.updateLabels()
  }
  // soft circle that shows how big the place's area is
  showArea(p, r) {
    if (!this.gA) return
    this.gA.replaceChildren()
    if (!p || p.x == null) return
    this.el('circle', { cx: p.x, cy: p.y, r, fill: '#F6B800', opacity: .18 }, this.gA)
    this.el('circle', { cx: p.x, cy: p.y, r, fill: 'none', stroke: '#C98F00', 'stroke-width': 1.5, 'stroke-dasharray': '6 5', 'vector-effect': 'non-scaling-stroke' }, this.gA)
  }
  setSelected(i) {
    if (this.selB != null && this.bEl[this.selB]) this.bEl[this.selB].setAttribute('fill', '#C7D5FF')
    this.selB = i
    if (i != null && this.bEl[i]) { this.bEl[i].setAttribute('fill', '#FFD866'); this.bEl[i].setAttribute('stroke', '#C98F00') }
  }
  setHidden(names) { this.hidden = new Set(names); this.updateLabels() }
  showLabels(on) { this.labelsOn = on; this.updateLabels() }
  // Names on the map: constant size on screen, and only the ones that fit without overlapping
  updateLabels() {
    cancelAnimationFrame(this.lraf)
    this.lraf = requestAnimationFrame(() => {
      if (!this.lab || !this.vb) return
      const s = this.scale(), vx = this.vb[0], vy = this.vb[1], w = this.svg.clientWidth || 400, h = this.svg.clientHeight || 700, boxes = []
      const fs = 11 * s
      this.lab.forEach(({ p, t }) => {
        let show = this.labelsOn && !this.hidden.has(p.n)
        if (show) {
          const px = (p.x - vx) / s, py = (p.y - vy) / s
          const bw = t.textContent.length * 6.4 + 10, box = [px - bw / 2, py - 24, px + bw / 2, py - 8]
          if (px < -20 || px > w + 20 || py < 0 || py > h || boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) show = false
          else boxes.push(box)
        }
        if (show) { t.setAttribute('x', p.x); t.setAttribute('y', p.y - 11 * s); t.setAttribute('font-size', fs); t.setAttribute('stroke-width', 3.2 * s); t.removeAttribute('display') }
        else t.setAttribute('display', 'none')
      })
    })
  }
  // blue "you are here" dot with an accuracy ring; heading is degrees clockwise from north
  setMe(pt, acc, heading) { this.me = pt ? { x: pt.x, y: pt.y, acc: acc || 0, h: heading } : null; this.drawMe() }
  drawMe() {
    if (!this.gMe) return
    this.gMe.replaceChildren()
    const m = this.me; if (!m || this.nav) return
    const s = this.scale()
    this.el('circle', { cx: m.x, cy: m.y, r: Math.max(m.acc, 4), fill: cssv('--blue'), opacity: .12 }, this.gMe)
    if (m.h != null && !isNaN(m.h)) this.el('path', { d: `M0 ${-26 * s} L${-9 * s} ${-9 * s} L${9 * s} ${-9 * s}Z`, fill: cssv('--blue'), opacity: .55, transform: `translate(${m.x} ${m.y}) rotate(${m.h})` }, this.gMe)
    this.el('circle', { cx: m.x, cy: m.y, r: 9 * s, fill: '#fff' }, this.gMe)
    this.el('circle', { cx: m.x, cy: m.y, r: 6.2 * s, fill: cssv('--blue') }, this.gMe)
  }
  full() { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; N.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) }); return [[x0, y0], [x1, y1]] }
  setVB(v) { this.svg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' ')); this.drawMe(); this.updateLabels() }
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
  showRoute(cur, a, b, fit = true) {
    this.clearRoute()
    const pts = cur.pts, target = fit || !this.vb ? this.fit(pts, 40) : this.vb
    if (fit || !this.vb) this.tweenTo(target)
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
    this.gMe.replaceChildren()
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
    if (n.L - n.prog < (n.opts.arriveAt || 12)) { n.done = true; n.opts.onArrive(); return }
    n.raf = requestAnimationFrame(t => this.loop(t))
  }
  stopNav() { if (this.nav) { cancelAnimationFrame(this.nav.raf); this.nav = null; this.drawMe() } }
}
