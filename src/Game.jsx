import { useEffect, useState } from 'react'
import { api } from './api.js'
import { unlockText } from './lock.js'
import WishCard from './WishCard.jsx'

const btn = (primary, color) => ({
  padding: '10px 20px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, border: 'none',
  borderRadius: 22, cursor: 'pointer', background: color || (primary ? '#d4af37' : 'rgba(255,235,215,0.15)'), color: primary && !color ? '#6e0710' : '#fff',
})
const box = { maxWidth: 440, margin: '0 auto', padding: '14px 16px', minHeight: '100dvh', display: 'flex', flexDirection: 'column', gap: 12 }
const topBar = { display: 'flex', alignItems: 'center', gap: 10 }

function Back({ onBack }) {
  return (
    <button onClick={onBack} style={{ ...btn(false), padding: '6px 14px', fontSize: 14 }}>→ غرفي</button>
  )
}

// جلب ورقة الأمنية الحالية وفك قفلها الزمني (المفتاح صار عاماً بعد الموعد)
function useUnlockedCard(cipher) {
  const [result, setResult] = useState({ cipher: null, snap: null, err: '' })
  useEffect(() => {
    if (!cipher) return undefined
    let alive = true
    unlockText(cipher)
      .then((text) => {
        if (alive) setResult({ cipher, snap: JSON.parse(text), err: '' })
      })
      .catch(() => {
        if (alive) setResult({ cipher, snap: null, err: 'تعذّر فتح هذه البطاقة الآن، أعد المحاولة بعد قليل' })
      })
    return () => {
      alive = false
    }
  }, [cipher])
  if (cipher !== result.cipher) return { snap: null, err: '' }
  return { snap: result.snap, err: result.err }
}

function Countdown({ deadline }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000))
  return (
    <div style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', color: secs <= 3 ? '#ff6b6b' : '#fff' }}>{secs}</div>
  )
}

export default function Game({ user, room, isOwner, onBack }) {
  const [state, setState] = useState(null)
  const [members, setMembers] = useState([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    async function tick() {
      const r = await api('/api/game/state?room=' + room.code, null, user.token)
      if (!alive || !r.ok) return
      setState(r.data)
    }
    tick()
    const t = setInterval(tick, 1500)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [room.code, user.token])

  useEffect(() => {
    let alive = true
    api('/api/room-state?code=' + room.code, null, user.token).then((r) => {
      if (alive && r.ok) setMembers(r.data.members.map((m) => m.username))
    })
    return () => {
      alive = false
    }
  }, [room.code, user.token])

  const { snap, err: snapErr } = useUnlockedCard(state && (state.phase === 'show' || state.phase === 'revealed') ? state.cipher : null)

  async function start() {
    setBusy(true)
    setMsg('')
    const r = await api('/api/game/start', { room: room.code }, user.token)
    if (!r.ok) setMsg(r.data.error)
    setBusy(false)
  }
  async function skip() {
    const r = await api('/api/game/skip', { room: room.code }, user.token)
    if (r.ok) setState(r.data)
    else setMsg(r.data.error)
  }
  async function guess(name) {
    if (!state || state.phase !== 'show') return
    const r = await api('/api/game/guess', { room: room.code, guess: name }, user.token)
    if (r.ok) setState((s) => ({ ...s, myGuess: name }))
  }

  if (!state) {
    return (
      <div style={box}>
        <div style={topBar}>
          <Back onBack={onBack} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 40, opacity: 0.8 }}>جارٍ الدخول إلى غرفة اللعب...</div>
      </div>
    )
  }

  if (state.phase === 'idle') {
    return (
      <div style={box}>
        <div style={topBar}>
          <Back onBack={onBack} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: 56 }}>🔓</div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>انفتح الصندوق!</div>
          {isOwner ? (
            <>
              <div style={{ opacity: 0.85 }}>اضغط لتبدأ لعبة التخمين لهذه الغرفة</div>
              <button style={{ ...btn(true), padding: '14px 32px', fontSize: 18, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={start}>
                ▶️ ابدأ اللعبة
              </button>
            </>
          ) : (
            <div style={{ opacity: 0.85 }}>بانتظار أن يبدأ منظّم الغرفة اللعبة...</div>
          )}
          {msg && <div style={{ color: '#f2c25e' }}>{msg}</div>}
        </div>
      </div>
    )
  }

  if (state.phase === 'final') {
    return <FinalScreen scores={state.scores} onBack={onBack} />
  }

  // show / revealed
  const revealed = state.phase === 'revealed'
  return (
    <div style={box}>
      <div style={topBar}>
        <Back onBack={onBack} />
        <span style={{ fontWeight: 700 }}>الجولة {state.round} من {state.total}</span>
        {isOwner && (
          <button onClick={skip} style={{ ...btn(false), padding: '6px 14px', fontSize: 13, marginRight: 'auto' }}>⏭️ تخطي</button>
        )}
      </div>

      {!revealed && <Countdown deadline={state.deadline} />}
      {revealed && <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: '#8ef58e' }}>🎉 {state.owner}</div>}

      <div style={{ margin: '0 auto', width: '100%', maxWidth: 300 }}>
        {snapErr && <div style={{ textAlign: 'center', color: '#f2c25e', padding: 30 }}>{snapErr}</div>}
        {!snapErr && snap && <WishCard snap={snap} height={240} />}
        {!snapErr && !snap && <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>جارٍ فتح البطاقة...</div>}
      </div>

      {!revealed && (
        <>
          <div style={{ textAlign: 'center', fontSize: 14, opacity: 0.8 }}>
            من كتب هذه الأمنية برأيك؟ {state.guessCount > 0 ? '· صوّت ' + state.guessCount : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {members.map((m) => (
              <button
                key={m}
                onClick={() => guess(m)}
                style={{
                  ...btn(state.myGuess === m),
                  border: state.myGuess === m ? '2px solid #d4af37' : '2px solid transparent',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </>
      )}

      {msg && <div style={{ color: '#f2c25e', fontSize: 13, textAlign: 'center' }}>{msg}</div>}
    </div>
  )
}

function FinalScreen({ scores, onBack }) {
  const top = scores.filter((s) => s.points > 0)
  return (
    <div style={{ ...box, gap: 20 }}>
      <div style={topBar}>
        <Back onBack={onBack} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 900 }}>🏆 انتهت اللعبة!</div>

      <div style={{ background: 'rgba(255,235,215,0.08)', borderRadius: 16, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>ترتيب أفضل المخمّنين</div>
        {top.length === 0 && <div style={{ opacity: 0.75 }}>لم يُصب أحد هذه المرة!</div>}
        {top.map((s, i) => (
          <div key={s.username} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < top.length - 1 ? '1px solid rgba(255,235,215,0.1)' : 'none' }}>
            <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1 + '.'} {s.username}</span>
            <span style={{ fontWeight: 700 }}>{s.points} نقطة</span>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <div style={{ fontSize: 50 }}>🍳🎉</div>
        <div style={{ fontSize: 16, lineHeight: 1.8 }}>
          شكراً لمشاركتكم في صندوق هذا العام،
          <br />
          وكل عام وأنتم بخير، وسنة جديدة سعيدة! 🎆
        </div>
      </div>
    </div>
  )
}