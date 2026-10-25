import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useApp } from '../state'
import { backend, localStore, hasSupabase } from '../lib/backend'
import { FACS, DEPS } from '../lib/places'
import Icon from '../components/Icon'
import { View, GoogleIcon, CompassMark } from '../components/ui'
import { chooseGuest } from '../App'

const LEVELS = ['100', '200', '300', '400', '500', 'Postgraduate', 'Staff', 'Visitor']
const OUTSIDER = lv => lv === 'Staff' || lv === 'Visitor'
const profileOk = p => p && ((p.fac && p.dep) || OUTSIDER(p.lv))
const okEmail = e => /.+@.+\..+/.test(e || '')
const niceError = e => {
  const m = (e && e.message) || String(e || '')
  if (/rate limit|too many|seconds/i.test(m)) return 'Too many tries. Wait a minute and try again.'
  if (/expired|invalid/i.test(m)) return 'That code is wrong or has expired. Check it or ask for a new one.'
  if (/provider.*not enabled|unsupported provider/i.test(m)) return 'Google sign-in is not switched on yet. Use your email.'
  return m || 'Something went wrong. Try again.'
}

export function Welcome() {
  const nav = useNavigate()
  const { toast } = useApp()
  const google = async () => { try { await backend.google() } catch (e) { toast(niceError(e)) } }
  return (
    <View>
      <div className="wel" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ flex: 1, minHeight: 420, padding: 'calc(32px + env(safe-area-inset-top,0px)) 24px 32px', color: '#fff', backgroundImage: 'radial-gradient(circle at 90% 15%,rgba(246,184,0,.4),rgba(246,184,0,0) 42%),linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(120deg,#0A2597,#1B3FD6 58%,#3A66FF)', backgroundSize: 'auto,28px 28px,28px 28px,auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, borderRadius: '0 0 36px 36px' }}>
          <span style={{ width: 56, height: 56, borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CompassMark size={30} stroke="#1B3FD6" /></span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#FFD566' }}>Olabisi Onabanjo University</span>
          <h1 style={{ fontSize: 40, lineHeight: 1.05, color: '#fff' }}>Find your way around OOU.</h1>
          <p style={{ fontSize: 16, lineHeight: 1.45, color: '#DCE5FF' }}>Every faculty, department, hall and office, with the path to get there.</p>
        </div>
        <div style={{ padding: '24px 24px calc(28px + env(safe-area-inset-bottom,0px))', display: 'grid', gap: 12 }}>
          <button className="btn blue block" onClick={() => nav('/signup')}>Create an account</button>
          <button className="btn line block" onClick={google}><GoogleIcon /> Continue with Google</button>
          <button className="btn block" style={{ background: 'none', color: 'var(--muted)', fontWeight: 500, fontSize: 15, minHeight: 48 }} onClick={() => nav('/signin')}>Already registered? <b style={{ color: 'var(--blue)', marginLeft: 6 }}>Sign in</b></button>
          <button className="btn line block" onClick={() => { chooseGuest(); nav('/') }}>Continue as guest</button>
          <div className="demo">Free for students, staff and visitors. No password.</div>
        </div>
      </div>
    </View>
  )
}

export function Signup() {
  const nav = useNavigate()
  const [q] = useSearchParams()
  const { session, ready, profile, toast, saveProfile } = useApp()
  const editing = q.get('edit') === '1', completing = q.get('complete') === '1'
  const loggedMode = editing || completing
  const [f, setF] = useState({ name: '', email: '', fac: '', dep: '', lv: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const filled = useRef(false)

  useEffect(() => {
    if (loggedMode && profile && !filled.current) { filled.current = true; setF({ name: profile.name || '', email: profile.email || '', fac: profile.fac || '', dep: profile.dep || '', lv: profile.lv || '' }) }
  }, [loggedMode, profile])

  if (session === undefined || (session && !ready)) return null
  if (loggedMode && !session) return <Navigate to="/welcome" replace />
  if (completing && profileOk(profile)) return <Navigate to="/" replace />
  if (!loggedMode && session && profileOk(profile)) return <Navigate to="/" replace />
  if (!loggedMode && session) return <Navigate to="/signup?complete=1" replace />

  const set = k => e => setF(o => ({ ...o, [k]: e.target.value, ...(k === 'fac' ? { dep: '' } : {}) }))
  const deps = f.fac ? DEPS[f.fac] : []
  const google = async () => { try { await backend.google() } catch (e) { toast(niceError(e)) } }

  const submit = async () => {
    const bad = !f.name.trim() ? 'Enter your full name' : (!loggedMode && !okEmail(f.email)) ? 'Enter a valid email' : !f.lv ? 'Choose your level, or Staff / Visitor' : (!OUTSIDER(f.lv) && !f.fac) ? 'Choose your faculty' : (!OUTSIDER(f.lv) && !f.dep) ? 'Choose your department' : ''
    setErr(bad); if (bad) return
    setBusy(true)
    try {
      if (loggedMode) { await saveProfile({ name: f.name.trim(), fac: f.fac, dep: f.dep, lv: f.lv }); toast(editing ? 'Saved' : 'Welcome, ' + f.name.trim().split(' ')[0]); nav('/', { replace: true }) }
      else {
        const meta = { full_name: f.name.trim(), faculty: f.fac, department: f.dep, level: f.lv }
        localStore.set('pending', meta)
        await backend.sendCode(f.email.trim().toLowerCase(), meta)
        nav('/verify', { state: { email: f.email.trim().toLowerCase(), mode: 'new' } })
      }
    } catch (e) { setErr(niceError(e)) }
    setBusy(false)
  }

  return (
    <View>
      <div className="pad">
        <div className="top" style={{ padding: 0 }}><button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button></div>
        <h1>{editing ? 'Edit my details' : completing ? 'One last step' : 'Create your account'}</h1>
        <p className="mut" style={{ marginTop: -8 }}>{completing ? 'Tell us your department so we can set up My department for you.' : 'Takes a minute. We use your department to set up My department for you.'}</p>
        {!loggedMode && <><button className="btn line block" onClick={google}><GoogleIcon /> Continue with Google</button><div className="demo">or use your email</div></>}
        <div className="field"><label htmlFor="f-name">Full name</label><input className="inp" id="f-name" value={f.name} onChange={set('name')} placeholder="e.g. Adebayo Tolu" autoComplete="name" /></div>
        {!loggedMode && <div className="field"><label htmlFor="f-email">Email</label><input className="inp" id="f-email" type="email" value={f.email} onChange={set('email')} placeholder="you@gmail.com" autoComplete="email" /></div>}
        <div className="field"><label htmlFor="f-lv">I am a</label><select className="inp" id="f-lv" value={f.lv} onChange={set('lv')}><option value="">Choose one</option>{LEVELS.map(x => <option key={x} value={x}>{OUTSIDER(x) ? x : x + ' level'}</option>)}</select></div>
        <div className="field"><label htmlFor="f-fac">Faculty{OUTSIDER(f.lv) ? ' (optional)' : ''}</label><select className="inp" id="f-fac" value={f.fac} onChange={set('fac')}><option value="">Choose faculty</option>{FACS.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="f-dep">Department{OUTSIDER(f.lv) ? ' (optional)' : ''}</label><select className="inp" id="f-dep" value={f.dep} onChange={set('dep')} disabled={!f.fac}><option value="">{f.fac ? 'Choose department' : 'Pick a faculty first'}</option>{deps.map(x => <option key={x}>{x}</option>)}</select></div>
        <p className="demo" id="f-err" style={{ color: '#C0392B' }} role="alert">{err}</p>
        <button className="btn blue block" onClick={submit} disabled={busy}>{busy ? 'Please wait…' : loggedMode ? 'Save and continue' : 'Send me a code'}</button>
        {!loggedMode && <div className="demo">By continuing you agree to the <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 700 }}>privacy notice</a>.</div>}
      </div>
    </View>
  )
}

export function SignIn() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const { toast } = useApp()
  const go = async () => {
    if (!okEmail(email)) { setErr('Enter a valid email'); return }
    setBusy(true); setErr('')
    try {
      const e = email.trim().toLowerCase()
      await backend.sendCode(e)
      nav('/verify', { state: { email: e, mode: 'signin' } })
    } catch (x) { setErr(niceError(x)) }
    setBusy(false)
  }
  const google = async () => { try { await backend.google() } catch (e) { toast(niceError(e)) } }
  return (
    <View>
      <div className="pad">
        <div className="top" style={{ padding: 0 }}><button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button></div>
        <h1>Welcome back</h1>
        <p className="mut" style={{ marginTop: -8 }}>Enter the email you registered with. We will send you a 6-digit code.</p>
        <button className="btn line block" onClick={google}><GoogleIcon /> Continue with Google</button>
        <div className="demo">or use your email</div>
        <div className="field"><label htmlFor="f-email">Email</label><input className="inp" id="f-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" /></div>
        <p className="demo" style={{ color: '#C0392B' }} role="alert">{err}</p>
        <button className="btn blue block" onClick={go} disabled={busy}>{busy ? 'Please wait…' : 'Send me a code'}</button>
      </div>
    </View>
  )
}

export function Verify() {
  const nav = useNavigate()
  const { state } = useLocation()
  const { refreshSession, toast } = useApp()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(30)
  const refs = useRef([])
  useEffect(() => { refs.current[0] && refs.current[0].focus() }, [])
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t) }, [wait])
  if (!state || !state.email) return <Navigate to="/signup" replace />
  const email = state.email

  const setAt = (i, v) => {
    const d = v.replace(/\D/g, '')
    if (d.length > 1) { // pasted a whole code
      const arr = d.slice(0, 6).split(''); while (arr.length < 6) arr.push('')
      setDigits(arr); const last = Math.min(5, d.length - 1); refs.current[last] && refs.current[last].focus(); return
    }
    setDigits(o => o.map((x, j) => j === i ? d : x))
    if (d && i < 5) refs.current[i + 1].focus()
  }
  const onKey = (i, e) => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1].focus() }

  const verify = async () => {
    const code = digits.join('')
    if (code.length < 6) { setErr('Enter all 6 digits'); return }
    setBusy(true); setErr('')
    try { await backend.verifyCode(email, code); await refreshSession(); nav('/', { replace: true }) }
    catch (e) { setErr(niceError(e)); setBusy(false) }
  }
  const resend = async () => {
    try { await backend.sendCode(email, state.mode === 'new' ? localStore.get('pending', undefined) : undefined); toast('New code sent'); setWait(30) } catch (e) { toast(niceError(e)) }
  }

  return (
    <View>
      <div className="pad" style={{ gap: 18 }}>
        <div className="top" style={{ padding: 0 }}><button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button></div>
        <span style={{ width: 64, height: 64, borderRadius: 20, background: '#FFF1CC', color: '#8A5A00', display: 'grid', placeItems: 'center' }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span>
        <div><h1>Check your email</h1><p className="mut" style={{ marginTop: 6, lineHeight: 1.45 }}>We sent a 6-digit code to <b style={{ color: 'var(--ink)' }}>{email}</b>. Enter it below. Check your spam folder too.</p></div>
        <div className="code" style={{ justifyContent: 'flex-start' }}>
          {digits.map((d, i) => <input key={i} ref={el => (refs.current[i] = el)} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={'Digit ' + (i + 1)} onChange={e => setAt(i, e.target.value)} onKeyDown={e => onKey(i, e)} />)}
        </div>
        <p className="demo" style={{ color: '#C0392B', textAlign: 'left' }} role="alert">{err}</p>
        <button className="btn blue block" onClick={verify} disabled={busy}>{busy ? 'Checking…' : 'Verify and continue'}</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)' }}>
          <button style={{ border: 0, background: 'none', color: wait ? 'var(--muted)' : 'var(--blue)', padding: 0, fontWeight: wait ? 400 : 700 }} onClick={resend} disabled={wait > 0}>{wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}</button>
          <button style={{ border: 0, background: 'none', color: 'var(--blue)', fontWeight: 700, padding: 0 }} onClick={() => nav(-1)}>Change email</button>
        </div>
        {!hasSupabase && <p className="demo">Test mode: type any 6 digits.</p>}
      </div>
    </View>
  )
}
