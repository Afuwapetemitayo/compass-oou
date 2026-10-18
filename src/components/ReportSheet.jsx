import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { backend } from '../lib/backend'
import { useApp } from '../state'
import { Sheet } from './ui'

// "Report a problem" box. Pass a place to attach it to that place.
export default function ReportSheet({ place, onClose }) {
  const { session, toast } = useApp()
  const { pathname } = useLocation()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (msg.trim().length < 3) return toast('Write a few words about the problem')
    setBusy(true)
    try {
      await backend.sendReport(session.user.id, { placeId: place && place.id, placeName: place && place.n, message: msg.trim(), page: pathname })
      toast('Thank you. We got your report'); onClose()
    } catch (e) { toast((e && e.message) || 'Could not send. Try again.'); setBusy(false) }
  }
  return (
    <Sheet onClose={onClose}>
      <h2>{place ? 'Report a problem with this place' : 'Report a problem'}</h2>
      {place && <p className="mut" style={{ marginTop: -6 }}>{place.n}</p>}
      <p className="mut" style={{ lineHeight: 1.45 }}>{place ? 'Is the location wrong, the name wrong, or something missing?' : 'Something not working, a wrong place, or a place we are missing? Tell us.'}</p>
      <textarea className="inp" value={msg} onChange={e => setMsg(e.target.value)} maxLength={1000} placeholder="Write here…" style={{ minHeight: 110 }} autoFocus />
      <button className="btn blue block" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      <button className="btn line block" onClick={onClose}>Cancel</button>
    </Sheet>
  )
}
