import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

const KEY = 'admin_token'
function getTok() {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}
function saveTok(t) {
  try {
    if (t) sessionStorage.setItem(KEY, t)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

const card = { background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14 }
const inp = {
  padding: '12px 14px', fontSize: 16, fontFamily: 'inherit', borderRadius: 12, minWidth: 0,
  border: '2px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.1)', color: '#fff', outline: 'none',
}
const btn = (primary, danger) => ({
  padding: '8px 14px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 18, cursor: 'pointer',
  background: danger ? '#e5484d' : primary ? '#ffb830' : 'rgba(255,255,255,0.18)', color: primary && !danger ? '#000' : '#fff',
})

export default function Admin() {
  const [token, setToken] = useState(() => getTok())
  const [pw, setPw] = useState('')
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('rooms')
  const [msg, setMsg] = useState('')
  const [roomName, setRoomName] = useState('')
  const [resetFor, setResetFor] = useState(null)
  const [newPass, setNewPass] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)

  const refresh = useCallback(async () => {
    if (!token) return
    const r = await api('/api/admin/overview', null, token)
    if (r.ok) setData(r.data)
    else if (r.data.error === 'غير مصرّح') {
      saveTok(null)
      setToken(null)
    }
  }, [token])

  useEffect(() => {
    if (!token) return undefined
    const first = setTimeout(refresh, 0)
    const t = setInterval(refresh, 4000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [token, refresh])

  async function login() {
    setMsg('')
    const r = await api('/api/admin/login', { password: pw })
    if (r.ok) {
      saveTok(r.data.token)
      setToken(r.data.token)
      setPw('')
    } else setMsg(r.data.error)
  }

  async function act(path, body, okMsg) {
    const r = await api(path, body, token)
    setMsg(r.ok ? okMsg : r.data.error)
    refresh()
    return r
  }

  async function createRoom() {
    const r = await act('/api/admin/room', { name: roomName }, '✅ تم إنشاء الغرفة')
    if (r.ok) setRoomName('')
  }
  async function doReset(username) {
    const r = await act('/api/admin/reset', { username, password: newPass }, '✅ تم تغيير كلمة سر ' + username)
    if (r.ok) {
      setResetFor(null)
      setNewPass('')
    }
  }
  async function doDelete() {
    const d = confirmDel
    setConfirmDel(null)
    if (d.type === 'room') await act('/api/admin/delete-room', { code: d.id }, '🗑 حُذفت الغرفة')
    else await act('/api/admin/delete-user', { username: d.id }, '🗑 حُذف المستخدم')
  }
  async function copyLink(code) {
    const url = window.location.origin + window.location.pathname + '?room=' + code
    try {
      await navigator.clipboard.writeText(url)
      setMsg('📋 نُسخ رابط الدعوة: ' + url)
    } catch {
      setMsg('رابط الدعوة: ' + url)
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 360, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2>🔧 لوحة المطوّر</h2>
        <input type="password" style={inp} placeholder="كلمة سر المطوّر" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button style={{ ...btn(true), padding: 14, fontSize: 17 }} onClick={login}>دخول</button>
        {msg && <div style={{ color: '#ffd166' }}>{msg}</div>}
      </div>
    )
  }

  const pending = data ? data.users.filter((u) => u.reset_requested).length : 0

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>🔧 لوحة المطوّر</h2>
        <button style={btn(false)} onClick={() => { saveTok(null); setToken(null); setData(null) }}>خروج</button>
      </div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>🟢 تتحدث تلقائياً كل 4 ثوانٍ</div>

      {data && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...card, flex: 1, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 900 }}>{data.users.length}</div><div style={{ fontSize: 12 }}>أعضاء</div></div>
          <div style={{ ...card, flex: 1, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 900 }}>{data.rooms.length}</div><div style={{ fontSize: 12 }}>غرف</div></div>
          <div style={{ ...card, flex: 1, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 900 }}>{data.rooms.reduce((s, r) => s + r.wishes, 0)}</div><div style={{ fontSize: 12 }}>أمنيات</div></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...btn(tab === 'rooms'), flex: 1 }} onClick={() => setTab('rooms')}>الغرف</button>
        <button style={{ ...btn(tab === 'users'), flex: 1 }} onClick={() => setTab('users')}>الأعضاء {pending > 0 ? '🔔' + pending : ''}</button>
      </div>

      {msg && <div style={{ color: '#ffd166', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-all' }}>{msg}</div>}

      {confirmDel && (
        <div style={{ ...card, border: '2px solid #e5484d' }}>
          <div style={{ marginBottom: 10 }}>هل أنت متأكد من حذف «{confirmDel.name}»؟ لا يمكن التراجع.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn(true, true)} onClick={doDelete}>نعم، احذف</button>
            <button style={btn(false)} onClick={() => setConfirmDel(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {tab === 'rooms' && data && (
        <>
          <div style={{ ...card, display: 'flex', gap: 8 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="اسم غرفة جديدة (مثال: العائلة)" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            <button style={btn(true)} onClick={createRoom}>إنشاء</button>
          </div>
          {data.rooms.map((r) => (
            <div key={r.code} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{r.name}</div>
                  <div style={{ fontSize: 13, opacity: 0.8 }}>الكود: <b dir="ltr">{r.code}</b> · {r.members.length} أعضاء · {r.wishes} أمنيات</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button style={btn(true)} onClick={() => copyLink(r.code)}>📋 نسخ رابط الدعوة</button>
                <button style={btn(false, true)} onClick={() => setConfirmDel({ type: 'room', id: r.code, name: r.name })}>حذف</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {r.members.length === 0 && <span style={{ fontSize: 13, opacity: 0.7 }}>لا أعضاء بعد</span>}
                {r.members.map((m) => (
                  <span key={m.username} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '4px 10px', fontSize: 13 }}>
                    {m.hasWish ? '✅' : '⏳'} {m.username}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'users' && data && data.users.map((u) => (
        <div key={u.username} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{u.reset_requested ? '🔔 ' : ''}{u.username}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{u.rooms} غرف{u.reset_requested ? ' · طلب إعادة كلمة السر' : ''}</div>
            </div>
            <button style={btn(!!u.reset_requested)} onClick={() => { setResetFor(resetFor === u.username ? null : u.username); setNewPass('') }}>كلمة سر</button>
            <button style={btn(false, true)} onClick={() => setConfirmDel({ type: 'user', id: u.username, name: u.username })}>حذف</button>
          </div>
          {resetFor === u.username && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="كلمة السر الجديدة" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              <button style={btn(true)} onClick={() => doReset(u.username)}>حفظ</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}