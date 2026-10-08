import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { UNLOCK_AT } from './lock.js'

const TINTS = [['--bg-accent', '--text-accent'], ['--bg-success', '--text-success'], ['--bg-warning', '--text-warning'], ['--bg-pro', '--text-pro'], ['--bg-danger', '--text-danger']]
const CSS = `
@keyframes flyOut{0%{transform:translate(0,0) scale(.4) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1.3) rotate(12deg);opacity:0}}
@keyframes flyIn{0%{transform:translate(var(--dx),var(--dy)) scale(1.3) rotate(-8deg);opacity:1}85%{opacity:1}100%{transform:translate(0,0) scale(.35) rotate(10deg);opacity:0}}
@keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}`

function layout(N, W, H) {
  const size = N <= 6 ? 58 : N <= 10 ? 50 : N <= 16 ? 42 : N <= 24 ? 36 : 32
  const cx = W / 2
  const cy = H / 2
  const room = size / 2 + 10
  const rxMax = W / 2 - room - 4
  const ryMax = H / 2 - room - 14
  let rings = [[N, rxMax, ryMax]]
  if (N > 10) {
    const n1 = Math.round(N * 0.4)
    rings = [[n1, W * 0.27, H * 0.27], [N - n1, rxMax, ryMax]]
  }
  const pts = []
  rings.forEach(([n, rx, ry], ri) => {
    const off = ri === 1 ? Math.PI / n : 0
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + off + (i * 2 * Math.PI) / n
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) })
    }
  })
  return { pts, size, cx, cy }
}

function sortMembers(list, me) {
  return [...list.filter((m) => m.username === me), ...list.filter((m) => m.username !== me)]
}

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const p = (n) => String(n).padStart(2, '0')
  return d + ' يوم ' + p(Math.floor((s % 86400) / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60)
}

const smallBtn = { padding: '10px 22px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 22, cursor: 'pointer' }

export default function Hall({ user, room, justDone, onBack, onEdit }) {
  const [data, setData] = useState(null)
  const [imgs, setImgs] = useState({})
  const [fx, setFx] = useState([])
  const [bump, setBump] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [dims] = useState(() => {
    const W = Math.min(window.innerWidth, 440) - 32
    return { W, H: Math.max(320, Math.min(480, window.innerHeight - 250)) }
  })
  const prev = useRef(null)
  const imgKey = useRef('')
  const justRef = useRef(justDone)
  const fxId = useRef(0)

  useEffect(() => {
    let alive = true
    function addFx(kind, members, username) {
      const ordered = sortMembers(members, user.username)
      const L = layout(ordered.length, dims.W, dims.H)
      const i = ordered.findIndex((m) => m.username === username)
      if (i < 0) return
      const id = ++fxId.current
      setFx((f) => [...f, { id, kind, dx: L.pts[i].x - L.cx, dy: L.pts[i].y - L.cy, cx: L.cx, cy: L.cy }])
    }
    async function tick() {
      const r = await api('/api/room-state?code=' + room.code, null, user.token)
      if (!alive) return
      if (!r.ok) {
        if (r.data.error === 'أنت لست عضواً في هذه الغرفة') setKicked(true)
        return
      }
      const d = r.data
      const me = d.members.find((m) => m.username === user.username)
      if (prev.current) {
        d.members.forEach((m) => {
          const p = prev.current[m.username]
          if (!p || m.username === user.username) return
          if (p === 'idle' && m.state === 'writing') addFx('flyOut', d.members, m.username)
          if (p !== 'done' && m.state === 'done') addFx('flyIn', d.members, m.username)
        })
      }
      if (justRef.current && me && me.state === 'done') {
        justRef.current = false
        addFx('flyIn', d.members, user.username)
      }
      prev.current = Object.fromEntries(d.members.map((m) => [m.username, m.state]))
      setData(d)

      const key = d.members.filter((m) => m.hasImg).map((m) => m.username).join('|')
      if (key !== imgKey.current) {
        imgKey.current = key
        const a = await api('/api/room-avatars?code=' + room.code, null, user.token)
        if (alive && a.ok) setImgs(a.data.avatars)
      }

    }
    const first = setTimeout(tick, 0)
    const poll = setInterval(tick, 2000)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      alive = false
      clearTimeout(first)
      clearInterval(poll)
      clearInterval(clock)
    }
  }, [room.code, user.token, user.username, dims])

  async function startWriting() {
    if (busy || !data) return
    setBusy(true)
    setMsg('')
    const ordered = sortMembers(data.members, user.username)
    const L0 = layout(ordered.length, dims.W, dims.H)
    const i = ordered.findIndex((m) => m.username === user.username)
    if (i >= 0) {
      const id = ++fxId.current
      setFx((f) => [...f, { id, kind: 'flyOut', dx: L0.pts[i].x - L0.cx, dy: L0.pts[i].y - L0.cy, cx: L0.cx, cy: L0.cy }])
    }
    await new Promise((res) => setTimeout(res, 1100))
    const w = await api('/api/card-state', { room: room.code, state: 'writing' }, user.token)
    if (w.ok) onEdit()
    else {
      setMsg(w.data.error)
      setBusy(false)
    }
  }

  async function takeBack() {
    const w = await api('/api/card-state', { room: room.code, state: 'writing' }, user.token)
    if (w.ok) onEdit()
    else setMsg(w.data.error)
  }

  const members = data ? sortMembers(data.members, user.username) : []
  const L = layout(members.length, dims.W, dims.H)
  const me = members.find((m) => m.username === user.username)
  const left = UNLOCK_AT - now

  if (kicked) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 56 }}>🚪</div>
        <div style={{ fontSize: 18, lineHeight: 1.8 }}>تم إخراجك من هذه الغرفة</div>
        <button style={{ ...smallBtn, background: '#ffb830', color: '#000' }} onClick={onBack}>العودة إلى غرفي</button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '12px 16px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ ...smallBtn, padding: '6px 14px', fontSize: 14, background: 'rgba(255,255,255,0.18)', color: '#fff' }}>→ غرفي</button>
        <span style={{ fontWeight: 700, fontSize: 17 }}>{room.name}</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: 14, opacity: 0.85 }}>
        {left > 0 ? '🔒 تنفتح الأمنيات بعد ' + fmt(left) : '🎉 انفتح الصندوق'}
      </div>

      <div style={{ position: 'relative', width: dims.W, height: dims.H, margin: '0 auto', background: 'rgba(255,255,255,0.06)', borderRadius: 18, overflow: 'hidden' }}>
        {members.map((m, i) => {
          const t = TINTS[i % TINTS.length]
          const isMe = m.username === user.username
          const p = L.pts[i]
          const img = imgs[m.username]
          return (
            <div key={m.username} style={{
              position: 'absolute', left: p.x - L.size / 2, top: p.y - L.size / 2, width: L.size,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              transition: 'left .6s, top .6s', opacity: m.online || isMe ? 1 : 0.4,
            }}>
              <div style={{
                width: L.size, height: L.size, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: Math.round(L.size * 0.55), background: 'var(' + t[0] + ')', color: 'var(' + t[1] + ')',
                border: isMe ? '2px solid #ffb830' : '1px solid rgba(255,255,255,0.2)',
              }}>
                {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji || '👤'}
              </div>
              <div style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: L.size + 16 }}>{m.username}</div>
            </div>
          )
        })}

        <div key={bump} style={{ position: 'absolute', left: L.cx - 46, top: L.cy - 46, width: 92, height: 92, animation: bump ? 'bump .5s' : 'none' }}>
          <div style={{ position: 'absolute', left: 18, top: 0, width: 56, height: 62, background: '#fff3a0', borderRadius: 3, transform: 'rotate(-6deg)', boxShadow: '0 2px 6px rgba(0,0,0,.3)' }} />
          <div style={{ position: 'absolute', left: 4, bottom: 0, width: 84, height: 50, borderRadius: 10, background: '#7b4ab8', border: '2px solid #b388ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontSize: 12, fontWeight: 700 }}>
            <span style={{ fontSize: 28 }}>🔒</span>
          </div>
        </div>

        {fx.map((f) => (
          <div
            key={f.id}
            onAnimationEnd={() => {
              setFx((list) => list.filter((x) => x.id !== f.id))
              if (f.kind === 'flyIn') setBump((b) => b + 1)
            }}
            style={{
              position: 'absolute', left: f.cx - 14, top: f.cy - 17, width: 28, height: 34, background: '#fff3a0', borderRadius: 3,
              boxShadow: '0 2px 6px rgba(0,0,0,.35)', pointerEvents: 'none', zIndex: 5,
              '--dx': f.dx + 'px', '--dy': f.dy + 'px', animation: f.kind + ' 1.1s ease-in-out forwards',
            }}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', minHeight: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {!data && <div style={{ opacity: 0.8 }}>جارٍ الدخول إلى الغرفة...</div>}
        {data && left <= 0 && <div>صالة اللعب قادمة قريباً</div>}
        {data && left > 0 && me && me.state === 'idle' && (
          <button style={{ ...smallBtn, background: '#ffb830', color: '#000', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={startWriting}>✍️ اكتب أمنيتك</button>
        )}
        {data && left > 0 && me && me.state === 'writing' && (
          <button style={{ ...smallBtn, background: '#ffb830', color: '#000' }} onClick={onEdit}>✏️ فتح بطاقتي</button>
        )}
        {data && left > 0 && me && me.state === 'done' && (
          <>
            <div style={{ fontSize: 15 }}>✅ بطاقتك داخل الصندوق</div>
            <button style={{ ...smallBtn, padding: '8px 18px', fontSize: 14, background: 'rgba(255,255,255,0.18)', color: '#fff' }} onClick={takeBack}>تعديل بطاقتي</button>
          </>
        )}
        {msg && <div style={{ color: '#ffd166', fontSize: 14 }}>{msg}</div>}
      </div>
    </div>
  )
}