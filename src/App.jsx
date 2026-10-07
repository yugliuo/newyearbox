import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Editor from './Editor.jsx'
import Auth from './AuthPage.jsx'
import Rooms from './Rooms.jsx'
import Admin from './Admin.jsx'
import Vault from './Vault.jsx'
import Test from './Test.jsx'
import { api, getSession, setSession, clearSession } from './api.js'

function readJoinCode() {
  const c = new URLSearchParams(window.location.search).get('room')
  return c ? c.toUpperCase() : null
}

export default function App() {
  const [page, setPage] = useState('welcome')
  const [user, setUser] = useState(() => getSession())
  const [room, setRoom] = useState(null)
  const [joinCode, setJoinCode] = useState(() => readJoinCode())

  useEffect(() => {
    const s = getSession()
    if (!s) return
    api('/api/me', null, s.token).then((r) => {
      if (!r.ok && r.data.error !== 'تعذّر الاتصال، تأكد من الإنترنت') {
        clearSession()
        setUser(null)
      }
    })
  }, [])

  const onJoinHandled = useCallback(() => {
    setJoinCode(null)
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [])

  function onDone(data) {
    setSession(data)
    setUser(data)
    setPage('rooms')
  }
  function logout() {
    clearSession()
    setUser(null)
    setRoom(null)
    setPage('welcome')
  }

  if (window.location.hash === '#admin') return <Admin />
  if (window.location.hash === '#test') return <Test />
  if (page === 'editor' && user && room) return <Editor user={user} room={room} onBack={() => setPage('rooms')} />
  if (page === 'vault' && user) return <Vault user={user} onBack={() => setPage('rooms')} />
  if (page === 'rooms' && user) {
    return (
      <Rooms
        user={user}
        joinCode={joinCode}
        onJoinHandled={onJoinHandled}
        onOpen={(r) => { setRoom(r); setPage('editor') }}
        onVault={() => setPage('vault')}
        onLogout={logout}
      />
    )
  }
  if (page === 'auth') return <Auth onDone={onDone} onBack={() => setPage('welcome')} />

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
      {joinCode && <p style={{ color: '#ffd166' }}>🎟 لديك دعوة للانضمام إلى غرفة</p>}
      {user && <p style={{ opacity: 0.8 }}>مسجّل باسم: {user.username}</p>}
      <button
        onClick={() => setPage(user ? 'rooms' : 'auth')}
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