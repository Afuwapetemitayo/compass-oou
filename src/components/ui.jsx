import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Icon, { catIcon } from './Icon'
import { sub } from '../lib/places'

export function Badge({ p }) {
  if (p.x == null) return <span className="pill off">Coming soon</span>
  if (p.v === 2) return <span className="pill un">On map · unverified</span>
  return <span className="pill on">On map</span>
}

export function PlaceRow({ p, onOpen }) {
  return (
    <button className="li" onClick={() => onOpen(p)}>
      <span className="ic"><Icon n={catIcon[p.c] || 'build'} /></span>
      <span className="t"><b>{p.n}</b><span>{sub(p)}</span></span>
      <Badge p={p} />
    </button>
  )
}

// Scrolling page area. Goes back to the top when you open a new page.
export function View({ children }) {
  const ref = useRef(null)
  const { pathname } = useLocation()
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0 }, [pathname])
  return <div id="view" ref={ref}>{children}</div>
}

export function Sheet({ onClose, children }) {
  return (
    <div className="sheetbg" onClick={onClose}>
      <div className="sheetp" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export const initials = n => (n || 'S').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" /><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" /><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" /></svg>
  )
}

export function CompassMark({ size = 24, stroke = '#F6B800' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" fill="#F6B800" /></svg>
  )
}
