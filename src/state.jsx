import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { backend, hasSupabase, localStore } from './lib/backend'
import { slugify } from './lib/places'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)
export const pk = p => p.id || p.n          // key used for pins

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined)   // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [places, setPlaces] = useState([])
  const [pinKeys, setPinKeys] = useState([])
  const [loadedFor, setLoadedFor] = useState(null)   // id of the user whose data has loaded, 'none' when signed out
  const [toastMsg, setToastMsg] = useState('')
  const toastT = useRef(0)
  const gps = useRef(null)           // last good GPS fix on campus, {x,y}
  const asked = useRef(false)        // location prompt shown this session

  const toast = useCallback(m => { setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 2200) }, [])

  // 1) who is signed in
  useEffect(() => {
    let off = () => {}
    backend.getSession().then(s => setSession(s || null))
    off = backend.onAuth(s => setSession(s || null))
    return () => off()
  }, [])
  const refreshSession = useCallback(async () => { setSession((await backend.getSession()) || null) }, [])

  // 2) load their profile, places and pins
  const uid = session ? session.user.id : null
  useEffect(() => {
    if (session === undefined) return
    if (!session) { setProfile(null); setPlaces([]); setPinKeys([]); setLoadedFor('none'); return }
    let dead = false
    ;(async () => {
      try {
        const [pr, pl] = await Promise.all([backend.loadProfile(session), backend.listPlaces()])
        const pn = await backend.listPins(session.user.id)
        if (dead) return
        setProfile(pr); setPlaces(pl); setPinKeys(pn)
        // first time: pin their own department
        if (pr && pr.dep) {
          const seeded = 'seeded-' + session.user.id
          if (!localStore.get(seeded, false)) {
            localStore.set(seeded, true)
            const dp = pl.find(p => p.n === 'Department of ' + pr.dep)
            if (dp && !pn.includes(pk(dp))) { await backend.setPin(session.user.id, pk(dp), true); if (!dead) setPinKeys(k => [pk(dp), ...k]) }
          }
        }
        backend.logEvent(session.user.id, { type: 'visit' }); backend.touch(session.user.id)
      } catch (e) { console.error(e); if (!dead) toast('Could not load. Check your internet and refresh.') }
      if (!dead) setLoadedFor(session.user.id)
    })()
    return () => { dead = true }
  }, [session, toast])

  const ready = session === null ? loadedFor === 'none' : (session !== undefined && loadedFor === session.user.id)
  const reloadPlaces = useCallback(async () => { setPlaces(await backend.listPlaces()) }, [])
  const reloadProfile = useCallback(async () => { if (session) setProfile(await backend.loadProfile(session)) }, [session])

  const log = useCallback((ev, place) => { if (uid) backend.logEvent(uid, { ...ev, place_id: place && place.id ? place.id : null }).catch(() => {}) }, [uid])

  const saveProfile = useCallback(async ({ name, fac, dep, lv }) => {
    const dp = places.find(p => p.n === 'Department of ' + dep)
    await backend.saveProfile(uid, { name, fac, dep, depId: dp ? dp.id : null, lv })
    await reloadProfile()
    if (dp && !pinKeys.includes(pk(dp))) { await backend.setPin(uid, pk(dp), true); setPinKeys(k => [pk(dp), ...k]) }
  }, [uid, places, pinKeys, reloadProfile])

  const togglePin = useCallback(async p => {
    const on = !pinKeys.includes(pk(p))
    await backend.setPin(uid, pk(p), on)
    setPinKeys(k => on ? [pk(p), ...k] : k.filter(x => x !== pk(p)))
    if (on && p.c === 'Departments' && profile) await saveProfile({ name: profile.name, fac: p.f, dep: p.n.replace('Department of ', ''), lv: profile.lv })
    toast(on ? 'Pinned as My department' : 'Unpinned')
  }, [uid, pinKeys, profile, saveProfile, toast])

  const signOut = useCallback(async () => { await backend.signOut(); setSession(null); setProfile(null); setPlaces([]); setPinKeys([]) }, [])

  const pins = useMemo(() => pinKeys.map(k => places.find(p => pk(p) === k)).filter(Boolean), [pinKeys, places])
  const bySlug = useCallback(s => places.find(p => slugify(p.n) === s), [places])

  const value = { session, profile, places, pins, ready, toastMsg, toast, gps, asked, log, saveProfile, togglePin, signOut, reloadPlaces, refreshSession, reloadProfile, bySlug, hasSupabase, isAdmin: hasSupabase ? !!(profile && profile.role === 'admin') : !!profile }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
