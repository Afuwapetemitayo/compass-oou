import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { View } from '../components/ui'

// Plain-language notice. Have it read over before launch; edit the wording to suit you.
export default function Privacy() {
  const nav = useNavigate()
  return (
    <View>
      <div className="pad">
        <div className="top" style={{ padding: 0 }}><button className="ib" onClick={() => nav(-1)} aria-label="Back"><Icon n="back" /></button></div>
        <h1>Privacy notice</h1>
        <p className="mut" style={{ lineHeight: 1.5 }}>Compass OOU helps students find places on the OOU campus. It is a student project, not an official university service.</p>
        <div className="card"><h3>What we keep</h3><p className="mut" style={{ marginTop: 6, lineHeight: 1.5 }}>Your name, email, faculty, department and level, so we can set up My department. We also count visits, searches, places opened and walks started, to see what to improve. Before you sign in, a random code is saved on your phone so one phone counts once. It has no name or email.</p></div>
        <div className="card"><h3>Your location</h3><p className="mut" style={{ marginTop: 6, lineHeight: 1.5 }}>Your phone's location is used on your phone only, to show the arrow and guide you. We do not send it to our servers or store it.</p></div>
        <div className="card"><h3>Who sees it</h3><p className="mut" style={{ marginTop: 6, lineHeight: 1.5 }}>The Compass admin sees totals and your registration details. We do not sell your data or share it for adverts. Our database and sign-in are run by Supabase, and the site is hosted by Vercel.</p></div>
        <div className="card"><h3>Your choices</h3><p className="mut" style={{ marginTop: 6, lineHeight: 1.5 }}>You can edit your details in the app. To delete your account and data, email the Compass admin and we will remove it.</p></div>
      </div>
    </View>
  )
}
