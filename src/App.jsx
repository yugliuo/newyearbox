import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import './App.css'
import Editor from './Editor.jsx'
import Auth from './AuthPage.jsx'
import Rooms from './Rooms.jsx'
import Hall from './Hall.jsx'
import Admin from './Admin.jsx'
import Vault from './Vault.jsx'
import Test from './Test.jsx'

const Pan3D = lazy(() => import('./Pan3D.jsx'))
import { api, getSession, setSession, clearSession } from './api.js'

function readJoinCode() {
  const c = new URLSearchParams(window.location.search).get('room')
  return c ? c.toUpperCase() : null
}
function readNav() {
  try {
    return JSON.parse(localStorage.getItem('nav')) || null
  } catch {
    return null
  }
}
function saveNav(page, room) {
  try {
    localStorage.setItem('nav', JSON.stringify({ page, room }))
  } catch {
    /* ignore */
  }
}
function startState() {
  const user = getSession()
  const nav = readNav()
  if (user && readJoinCode()) return { page: 'rooms', room: null }
  if (user && nav) {
    if ((nav.page === 'room' || nav.page === 'editor') && nav.room) return nav
    if (nav.page === 'rooms' || nav.page === 'vault') return { page: nav.page, room: null }
  }
  return { page: 'welcome', room: null }
}

export default function App() {
  const [start] = useState(startState)
  const [page, setPage] = useState(start.page)
  const [room, setRoom] = useState(start.room)
  const [justDone, setJustDone] = useState(false)
  const [user, setUser] = useState(() => getSession())
  const [joinCode, setJoinCode] = useState(() => readJoinCode())

  useEffect(() => {
    const s = getSession()
    if (!s) return
    api('/api/me', null, s.token).then((r) => {
      if (!r.ok && r.data.error !== 'تعذّر الاتصال، تأكد من الإنترنت') {
        clearSession()
        setUser(null)
        setPage('welcome')
      }
    })
  }, [])

  const onJoinHandled = useCallback(() => {
    setJoinCode(null)
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [])

  function go(p, r = null, done = false) {
    setPage(p)
    setRoom(r)
    setJustDone(done)
    saveNav(p, r)
  }
  const openEditor = useCallback(() => go('editor', room), [room])

  function onDone(data) {
    setSession(data)
    setUser(data)
    go('rooms')
  }
  function logout() {
    clearSession()
    setUser(null)
    go('welcome')
  }

  if (window.location.hash === '#admin') return <Admin />
  if (window.location.hash === '#test') return <Test />
  if (window.location.hash === '#pan') {
    return (
      <Suspense fallback={<div style={{ padding: 24 }}>جارٍ التحميل...</div>}>
        <Pan3D />
      </Suspense>
    )
  }

  if (page === 'editor' && user && room) {
    return <Editor user={user} room={room} onBack={() => go('room', room)} onFinished={() => go('room', room, true)} />
  }
  if (page === 'room' && user && room) {
    return <Hall user={user} room={room} justDone={justDone} onBack={() => go('rooms')} onEdit={openEditor} />
  }
  if (page === 'vault' && user) return <Vault user={user} onBack={() => go('rooms')} />
  if (page === 'rooms' && user) {
    return (
      <Rooms
        user={user}
        joinCode={joinCode}
        onJoinHandled={onJoinHandled}
        onOpen={(r) => go('room', r)}
        onVault={() => go('vault')}
        onLogout={logout}
      />
    )
  }
  if (page === 'auth') return <Auth onDone={onDone} onBack={() => go('welcome')} />

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '24px', gap: '16px'
    }}>
      <div style={{ fontSize: '80px' }}>🍳</div>
      <h1 style={{ fontSize: '32px', fontWeight: 900 }}>صندوق رأس السنة</h1>
      <p style={{ maxWidth: '320px', lineHeight: 1.8, opacity: 0.9 }}>
        اكتب أمنيتك على ورقة، واقفلها في الصندوق،
        وسنفتحه معاً في رأس السنة القادمة!
      </p>
      {joinCode && <p style={{ color: '#ffd166' }}>🎟️ لديك دعوة للانضمام إلى غرفة</p>}
      {user && <p style={{ opacity: 0.8 }}>مسجّل باسم: {user.username}</p>}
      <button
        onClick={() => go(user ? 'rooms' : 'auth')}
        style={{
          padding: '14px 36px', fontSize: '18px', fontFamily: 'inherit',
          fontWeight: 700, border: 'none', borderRadius: '30px',
          background: '#ffb830', cursor: 'pointer'
        }}>
        ابدأ
      </button>
      {user && (
        <button onClick={logout} style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.7, fontFamily: 'inherit', cursor: 'pointer' }}>
          تسجيل الخروج
        </button>
      )}
    </div>
  )
}