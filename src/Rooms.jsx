import { useEffect, useState } from 'react'
import { api } from './api.js'

const card = { background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }
const btn = (primary) => ({
  padding: '10px 18px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, border: 'none',
  borderRadius: 20, cursor: 'pointer', background: primary ? '#ffb830' : 'rgba(255,255,255,0.15)', color: primary ? '#000' : '#fff',
})

export default function Rooms({ user, joinCode, onJoinHandled, onOpen, onVault, onLogout }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (joinCode) {
        const j = await api('/api/join', { code: joinCode }, user.token)
        if (alive) setMsg(j.ok ? '✅ انضممت إلى غرفة ' + j.data.room.name : j.data.error)
        onJoinHandled()
      }
      const r = await api('/api/rooms', null, user.token)
      if (alive) {
        if (r.ok) setRooms(r.data.rooms)
        else setMsg(r.data.error)
        setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [user.token, joinCode, onJoinHandled])

  async function join() {
    setBusy(true)
    setMsg('')
    const j = await api('/api/join', { code }, user.token)
    if (j.ok) {
      setCode('')
      setMsg('✅ انضممت إلى غرفة ' + j.data.room.name)
      const r = await api('/api/rooms', null, user.token)
      if (r.ok) setRooms(r.data.rooms)
    } else setMsg(j.data.error)
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100dvh' }}>
      <h2>غرفي</h2>
      <div style={{ opacity: 0.8, fontSize: 14 }}>أهلاً {user.username} 👋</div>

      {loading && <div>جارٍ التحميل...</div>}
      {!loading && rooms.length === 0 && (
        <div style={{ opacity: 0.85, lineHeight: 1.9 }}>لم تنضم لأي غرفة بعد. اكتب كود الغرفة الذي أرسله لك المنظّم في الخانة بالأسفل.</div>
      )}

      {rooms.map((r) => (
        <div key={r.code} style={card}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{r.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {r.members} أعضاء · {r.hasWish ? '🔒 أمنيتك محفوظة' : '✏️ لم تكتب أمنية بعد'}
            </div>
          </div>
          <button style={btn(true)} onClick={() => onOpen(r)}>ادخل</button>
        </div>
      ))}

      <div style={card}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>📮 رسالة من الماضي</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>اختيارية، خاصة بك وحدك، تنفتح في رأس السنة</div>
        </div>
        <button style={btn(false)} onClick={onVault}>افتح</button>
      </div>

      <div style={{ ...card, flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ fontWeight: 700 }}>الانضمام لغرفة جديدة</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="الكود"
            maxLength={6}
            dir="ltr"
            style={{
              flex: 1, minWidth: 0, padding: '12px 14px', fontSize: 18, letterSpacing: 3, textAlign: 'center',
              borderRadius: 12, border: '2px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', outline: 'none',
            }}
          />
          <button style={{ ...btn(true), opacity: busy || code.length < 6 ? 0.5 : 1 }} disabled={busy || code.length < 6} onClick={join}>انضم</button>
        </div>
      </div>

      {msg && <div style={{ color: '#ffd166', textAlign: 'center', lineHeight: 1.7 }}>{msg}</div>}

      <button style={{ ...btn(false), alignSelf: 'center', marginTop: 8 }} onClick={onLogout}>تسجيل الخروج</button>
    </div>
  )
}