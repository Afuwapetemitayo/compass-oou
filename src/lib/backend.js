// One small API the whole app talks to. If the Supabase keys are present it uses Supabase
// (real accounts, shared places, analytics). If not, it runs in TEST MODE on this device only.
import { createClient } from '@supabase/supabase-js'
import { seedPlaces, fromRows, toRow } from './places'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const hasSupabase = Boolean(url && key)
export const supabase = hasSupabase ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null

const ls = {
  get(k, d) { try { const v = localStorage.getItem('compass-' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem('compass-' + k, JSON.stringify(v)); return true } catch { return false } },
  del(k) { try { localStorage.removeItem('compass-' + k) } catch { /* ignore */ } }
}
const photoUrl = path => supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl

/* ------------------------------ Supabase ------------------------------ */
const DEFAULT_TIPS = [
  { id: 't1', title: 'Getting to Ago-Iwoye', body: 'From your city, take a bus or car going to Ago-Iwoye. Ask at the park which vehicle is going there, and agree the fare before you get in.', sort_order: 10 },
  { id: 't2', title: 'Once you are in Ago-Iwoye', body: 'Tell the driver or keke rider you are going to OOU, at School Park (the drop-off point). They will know it.', sort_order: 20 },
  { id: 't3', title: 'Stay safe', body: 'Keep your phone, money and admission documents close. Do not hand your bags to strangers. If you are lost, ask a student or a security officer.', sort_order: 30 }
]

const sb = {
  async getSession() { const { data } = await supabase.auth.getSession(); return data.session },
  onAuth(cb) { const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s)); return () => data.subscription.unsubscribe() },
  async sendCode(email, meta) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: meta || undefined } })
    if (error) throw error
  },
  async verifyCode(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw error
    return data.session
  },
  async google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) throw error
  },
  async signOut() { await supabase.auth.signOut() },
  async loadProfile(session) {
    const { data, error } = await supabase.from('profiles').select('*, dept:department_id(id,name)').eq('id', session.user.id).maybeSingle()
    if (error) throw error
    if (!data) return null
    return { id: data.id, name: data.full_name, email: data.email, fac: data.faculty || '', dep: data.dept ? data.dept.name.replace('Department of ', '') : '', depId: data.dept ? data.dept.id : null, lv: data.level || '', role: data.role }
  },
  async saveProfile(uid, { name, fac, depId, lv }) {
    const { error } = await supabase.from('profiles').update({ full_name: name, faculty: fac, department_id: depId, level: lv }).eq('id', uid)
    if (error) throw error
  },
  async touch(uid) { await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', uid) },
  async listPlaces() {
    const { data, error } = await supabase.from('places').select('*').order('sort_order').order('name')
    if (error) throw error
    return fromRows(data, photoUrl)
  },
  async savePlace(p, photoBlob) {
    const row = toRow(p)
    if (photoBlob) {
      const path = `${row.slug}-${Date.now()}.jpg`
      const up = await supabase.storage.from('place-photos').upload(path, photoBlob, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw up.error
      row.photo_path = path
    }
    if (p.id) {
      const { error } = await supabase.from('places').update(row).eq('id', p.id)
      if (error) throw error
    } else {
      row.sort_order = 1000
      const { error } = await supabase.from('places').insert(row)
      if (error) throw error
    }
  },
  async listPins(uid) { const { data } = await supabase.from('user_pins').select('place_id').eq('user_id', uid); return (data || []).map(r => r.place_id) },
  async setPin(uid, placeId, on) {
    if (on) await supabase.from('user_pins').upsert({ user_id: uid, place_id: placeId })
    else await supabase.from('user_pins').delete().eq('user_id', uid).eq('place_id', placeId)
  },
  async logEvent(uid, ev) { if (uid) await supabase.from('events').insert({ user_id: uid, ...ev }) },
  async adminStats(days) { const { data, error } = await supabase.rpc('admin_stats', { days }); if (error) throw error; return data },
  async sendReport(uid, r) {
    const { error } = await supabase.from('reports').insert({ user_id: uid, place_id: r.placeId || null, place_name: r.placeName || null, message: r.message, page: r.page || null })
    if (error) throw error
  },
  async listReports() {
    const { data, error } = await supabase.from('reports').select('*, who:profiles(full_name,email)').order('status', { ascending: true }).order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    return data
  },
  async setReportStatus(id, status) { const { error } = await supabase.from('reports').update({ status }).eq('id', id); if (error) throw error },
  async listTips() { const { data, error } = await supabase.from('arrival_tips').select('*').order('sort_order').order('created_at'); if (error) throw error; return data },
  async saveTip(t) {
    const row = { title: t.title, body: t.body, sort_order: t.sort_order ?? 100 }
    const { error } = t.id ? await supabase.from('arrival_tips').update(row).eq('id', t.id) : await supabase.from('arrival_tips').insert(row)
    if (error) throw error
  },
  async deleteTip(id) { const { error } = await supabase.from('arrival_tips').delete().eq('id', id); if (error) throw error },
  async listUsers() {
    const { data, error } = await supabase.from('profiles').select('id,full_name,email,faculty,level,role,created_at,last_seen_at,dept:department_id(name)').order('created_at', { ascending: false }).limit(2000)
    if (error) throw error
    return data.map(u => ({ id: u.id, name: u.full_name, email: u.email, faculty: u.faculty || '', dept: u.dept ? u.dept.name.replace(/^Department of /, '') : '', level: u.level || '', role: u.role, joined: u.created_at, seen: u.last_seen_at }))
  }
}

/* ------------------------------ Test mode (this device only) ------------------------------ */
const local = {
  async getSession() { const u = ls.get('user', null); return u ? { user: { id: 'local', email: u.email } } : null },
  onAuth() { return () => {} },
  async sendCode() {},
  async verifyCode(email) {
    const meta = ls.get('pending', {})
    ls.set('user', { id: 'local', name: meta.full_name || email.split('@')[0], email, fac: meta.faculty || '', dep: meta.department || '', lv: meta.level || '', role: 'student' })
    return { user: { id: 'local', email } }
  },
  async google() { ls.set('pending', { full_name: 'Adebayo Tolu', faculty: '', department: '', level: '' }); ls.set('user', { id: 'local', name: 'Adebayo Tolu', email: 'adebayo.tolu@gmail.com', fac: '', dep: '', lv: '', role: 'student' }); window.location.assign('/') },
  async signOut() { ls.del('user') },
  async loadProfile() { return ls.get('user', null) },
  async saveProfile(_uid, { name, fac, dep, lv }) { const u = ls.get('user', {}); ls.set('user', { ...u, name, fac, dep, lv }) },
  async touch() {},
  async listPlaces() {
    const base = seedPlaces()
    const edits = ls.get('edits', {}), extra = ls.get('extra', []), photos = ls.get('photos', {})
    extra.forEach(e => base.push({ ...e }))
    return base.map((p, i) => { const e = edits[p.n]; if (e) Object.assign(p, e); p.photo = photos[p.n] || null; p.i = i; return p })
  },
  async savePlace(p, photoBlob, photoData) {
    const edits = ls.get('edits', {})
    edits[p.n] = { x: p.x, y: p.y, v: p.v, note: p.note, h: p.h }
    ls.set('edits', edits)
    if (!p.id && !seedPlaces().some(s => s.n === p.n)) {
      const extra = ls.get('extra', []).filter(e => e.n !== p.n)
      extra.push({ n: p.n, c: p.c, t: p.t, f: '', a: '', k: 0, x: p.x, y: p.y, v: p.v, note: p.note, h: p.h })
      ls.set('extra', extra)
    }
    if (photoData) { const ph = ls.get('photos', {}); ph[p.n] = photoData; ls.set('photos', ph) }
  },
  async listPins() { return ls.get('pins', []) },
  async setPin(_u, name, on) { const pn = ls.get('pins', []).filter(n => n !== name); if (on) pn.unshift(name); ls.set('pins', pn) },
  async logEvent() {},
  async adminStats() { return null },
  async sendReport(_uid, r) { const l = ls.get('reports', []); l.unshift({ id: Date.now(), place_name: r.placeName || null, message: r.message, page: r.page || null, status: 'open', created_at: new Date().toISOString(), who: { full_name: (ls.get('user', {}) || {}).name, email: (ls.get('user', {}) || {}).email } }); ls.set('reports', l) },
  async listReports() { return ls.get('reports', []) },
  async setReportStatus(id, status) { ls.set('reports', ls.get('reports', []).map(r => r.id === id ? { ...r, status } : r)) },
  async listTips() { return ls.get('tips', DEFAULT_TIPS) },
  async saveTip(t) { const l = ls.get('tips', DEFAULT_TIPS); ls.set('tips', t.id ? l.map(x => x.id === t.id ? { ...x, ...t } : x) : [...l, { ...t, id: 't' + Date.now(), sort_order: t.sort_order ?? 100 }]) },
  async deleteTip(id) { ls.set('tips', ls.get('tips', DEFAULT_TIPS).filter(x => x.id !== id)) },
  async listUsers() {
    const u = ls.get('user', null)
    const me = u ? [{ id: 'local', name: u.name, email: u.email, faculty: u.fac, dept: u.dep, level: u.lv, role: u.role, joined: new Date().toISOString(), seen: new Date().toISOString() }] : []
    return [...me, { id: 's1', name: 'Adebayo Tolu', email: 'adebayo.tolu@gmail.com', faculty: 'Social Sciences', dept: 'Economics', level: '200', role: 'student', joined: '2026-10-12T10:00:00Z', seen: '2026-10-17T09:00:00Z' }, { id: 's2', name: 'Sample Student', email: 'sample@example.com', faculty: 'Science', dept: 'Statistics', level: '100', role: 'student', joined: '2026-10-14T10:00:00Z', seen: null }]
  }
}

export const backend = hasSupabase ? sb : local
export const localStore = ls
