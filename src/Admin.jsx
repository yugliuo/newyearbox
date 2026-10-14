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

const EVENT = { login: 'دخول', register: 'تسجيل جديد', admin: 'دخول المطوّر', forgot: 'نسيت كلمة المرور', locked: 'مقفول مؤقتاً' }
function ago(ts) {
  if (!ts) return 'لم يدخل'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'الآن'
  if (s < 3600) return 'قبل ' + Math.floor(s / 60) + ' دقيقة'
  if (s < 86400) return 'قبل ' + Math.floor(s / 3600) + ' ساعة'
  return 'قبل ' + Math.floor(s / 86400) + ' يوم'
}
function when(ts) {
  return new Date(ts).toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad', hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  const [sec, setSec] = useState(null)

  const refresh = useCallback(async () => {
    if (!token) return
    const r = await api('/api/admin/overview', null, token)
    if (r.ok) setData(r.data)
    else if (r.data.error === 'غير مصرّح') {
      saveTok(null)
      setToken(null)
      return
    }
    if (tab === 'security') {
      const x = await api('/api/admin/security', null, token)
      if (x.ok) setSec(x.data)
    }
  }, [token, tab])

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
    if (d.type === 'kick') await act('/api/admin/kick', { room: d.room, username: d.id }, '🚫 طُرد ' + d.name + ' من الغرفة')
    else if (d.type === 'disable') await act('/api/admin/disable', { username: d.id, disabled: true }, '⛔ أُوقف حساب ' + d.name)
    else if (d.type === 'room') await act('/api/admin/delete-room', { code: d.id }, '🗑️ حُذفت الغرفة')
    else await act('/api/admin/delete-user', { username: d.id }, '🗑️ حُذف المستخدم')
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
        <button style={{ ...btn(tab === 'security'), flex: 1 }} onClick={() => setTab('security')}>الأمان {sec && sec.failed > 0 ? '⚠️' + sec.failed : ''}</button>
      </div>

      {msg && <div style={{ color: '#ffd166', fontSize: 14, lineHeight: 1.7, wordBreak: 'break-all' }}>{msg}</div>}

      {confirmDel && (
        <div style={{ ...card, border: '2px solid #e5484d' }}>
          <div style={{ marginBottom: 10 }}>
            {confirmDel.type === 'kick'
              ? 'هل تريد طرد «' + confirmDel.name + '» من الغرفة؟ لن يستطيع الدخول إليها مجدداً.'
              : confirmDel.type === 'disable'
                ? 'هل تريد إيقاف حساب «' + confirmDel.name + '»؟ سيخرج من كل أجهزته ولن يدخل حتى تعيد تفعيله.'
                : 'هل أنت متأكد من حذف «' + confirmDel.name + '»؟ لا يمكن التراجع.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn(true, true)} onClick={doDelete}>نعم، نفّذ</button>
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
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{r.created_by === '[المطوّر]' ? '👑 أنشأتها أنت' : '👤 أنشأها: ' + r.created_by}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button style={btn(true)} onClick={() => copyLink(r.code)}>📋 نسخ رابط الدعوة</button>
                <button style={btn(false, true)} onClick={() => setConfirmDel({ type: 'room', id: r.code, name: r.name })}>حذف</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {r.members.length === 0 && <span style={{ fontSize: 13, opacity: 0.7 }}>لا أعضاء بعد</span>}
                {r.members.map((m) => (
                  <span key={m.username} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '4px 4px 4px 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span>{m.hasWish ? '✅' : '⏳'} {m.username}</span>
                    <button
                      aria-label={'طرد ' + m.username}
                      onClick={() => setConfirmDel({ type: 'kick', id: m.username, name: m.username, room: r.code })}
                      style={{ border: 'none', borderRadius: 10, background: '#e5484d', color: '#fff', fontSize: 12, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      طرد
                    </button>
                  </span>
                ))}
              </div>
              {r.banned && r.banned.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>🚫 المطرودون:</span>
                  {r.banned.map((u) => (
                    <span key={u} style={{ background: 'rgba(229,72,77,0.25)', borderRadius: 14, padding: '4px 4px 4px 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {u}
                      <button
                        onClick={() => act('/api/admin/unban', { room: r.code, username: u }, '✅ أُلغي طرد ' + u)}
                        style={{ border: 'none', borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        إلغاء
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ fontSize: 12, opacity: 0.8, alignSelf: 'center' }}>🎮 اللعبة:</span>
                <button style={btn(true)} onClick={() => act('/api/admin/game', { room: r.code, action: 'start' }, '▶️ بدأت اللعبة في ' + r.name)}>ابدأ</button>
                <button style={btn(false)} onClick={() => act('/api/admin/game', { room: r.code, action: 'skip' }, '⏭️ تخطّينا الجولة')}>تخطّي</button>
                <button style={btn(false, true)} onClick={() => act('/api/admin/game', { room: r.code, action: 'reset' }, '🔄 أُعيدت اللعبة من البداية')}>إعادة</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'users' && data && data.users.map((u) => (
        <div key={u.username} style={{ ...card, opacity: u.disabled ? 0.65 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{u.disabled ? '⛔ ' : ''}{u.reset_requested ? '🔔 ' : ''}{u.username}</div>
              <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.7 }}>
                {u.rooms} غرف · {u.devices} جهاز · آخر دخول: {ago(u.last_login)}
                {u.reset_requested ? ' · طلب إعادة كلمة السر' : ''}
              </div>
            </div>
            <button style={btn(!!u.reset_requested)} onClick={() => { setResetFor(resetFor === u.username ? null : u.username); setNewPass('') }}>كلمة سر</button>
          </div>
          {resetFor === u.username && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="كلمة السر الجديدة (6 أحرف على الأقل)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
              <button style={btn(true)} onClick={() => doReset(u.username)}>حفظ</button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <button style={btn(false)} onClick={() => act('/api/admin/revoke', { username: u.username }, '🔒 أُخرج ' + u.username + ' من كل أجهزته')}>إخراج من الأجهزة</button>
            {u.disabled ? (
              <button style={btn(true)} onClick={() => act('/api/admin/disable', { username: u.username, disabled: false }, '✅ فُعّل حساب ' + u.username)}>تفعيل الحساب</button>
            ) : (
              <button style={btn(false, true)} onClick={() => setConfirmDel({ type: 'disable', id: u.username, name: u.username })}>إيقاف الحساب</button>
            )}
            <button style={btn(false, true)} onClick={() => setConfirmDel({ type: 'user', id: u.username, name: u.username })}>حذف</button>
          </div>
        </div>
      ))}

      {tab === 'security' && !sec && <div style={{ opacity: 0.8 }}>جارٍ التحميل...</div>}
      {tab === 'security' && sec && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ ...card, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: sec.failed ? '#ff8a8a' : undefined }}>{sec.failed}</div>
              <div style={{ fontSize: 12 }}>محاولات خاطئة (24 ساعة)</div>
            </div>
            <div style={{ ...card, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: sec.locked ? '#ff8a8a' : undefined }}>{sec.locked}</div>
              <div style={{ fontSize: 12 }}>حالات قفل</div>
            </div>
            <div style={{ ...card, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{sec.sessions.length}</div>
              <div style={{ fontSize: 12 }}>أجهزة مسجّلة</div>
            </div>
          </div>

          <div style={{ fontWeight: 700 }}>🔑 الأجهزة المسجّلة الآن</div>
          {sec.sessions.length === 0 && <div style={{ opacity: 0.7, fontSize: 14 }}>لا أجهزة</div>}
          {sec.sessions.map((x) => (
            <div key={x.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.8 }}>
                <b>{x.username}</b> · {x.device}
                <br />
                <span style={{ opacity: 0.75 }}>{x.country || '؟'} · <span dir="ltr">{x.ip}</span> · آخر نشاط {ago(x.last_seen)}</span>
              </div>
              <button style={btn(false, true)} onClick={() => act('/api/admin/revoke', { sid: x.id }, '🔒 أُخرج الجهاز')}>إخراج</button>
            </div>
          ))}

          <div style={{ fontWeight: 700, marginTop: 4 }}>📜 آخر الأحداث</div>
          {sec.events.map((e, i) => (
            <div
              key={i}
              style={{ ...card, padding: 10, fontSize: 13, lineHeight: 1.8, borderRight: '4px solid ' + (e.event === 'locked' ? '#e5484d' : e.ok ? '#30a46c' : '#f5a524') }}
            >
              <b>{EVENT[e.event] || e.event}</b> · {e.username || '؟'} · {e.ok ? '✓ نجح' : '✗ فشل'}
              <br />
              <span style={{ opacity: 0.75 }}>{when(e.ts)} · {e.device} · {e.country || '؟'} · <span dir="ltr">{e.ip}</span></span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}