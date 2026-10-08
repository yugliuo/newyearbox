import { useState } from 'react'
import { api } from './api.js'
import { deriveKeyHex } from './crypt.js'

const EMOJIS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦄', '🐯', '🐵']

function resize(file) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 96
      c.height = 96
      const s = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
}

const input = {
  width: '100%', padding: '14px 16px', fontSize: 16, fontFamily: 'inherit',
  borderRadius: 14, border: '2px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.1)', color: '#fff', outline: 'none',
}
const btn = (primary) => ({
  width: '100%', padding: '14px', fontSize: 18, fontFamily: 'inherit', fontWeight: 700,
  border: 'none', borderRadius: 30, cursor: 'pointer',
  background: primary ? '#ffb830' : 'rgba(255,255,255,0.15)',
  color: primary ? '#000' : '#fff',
})

function Avatar({ value, size }) {
  const base = {
    width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'rgba(255,255,255,0.15)', fontSize: size * 0.55, overflow: 'hidden',
  }
  if (value && value.startsWith('data:')) {
    return <img src={value} alt="" style={{ ...base, objectFit: 'cover' }} />
  }
  return <div style={base}>{value || '👤'}</div>
}

export default function Auth({ onDone, onBack }) {
  const [mode, setMode] = useState('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function pickFile(e) {
    const f = e.target.files[0]
    if (f) setAvatar(await resize(f))
  }

  async function submit() {
    setMsg('')
    setBusy(true)
    const path = mode === 'register' ? '/api/register' : '/api/login'
    const body = mode === 'register' ? { username, password, avatar } : { username, password }
    const r = await api(path, body)
    if (r.ok) {
      let dk = null
      try {
        dk = await deriveKeyHex(password, r.data.username)
      } catch {
        /* ignore */
      }
      setBusy(false)
      onDone({ ...r.data, dk })
    } else {
      setBusy(false)
      setMsg(r.data.error || 'حدث خطأ')
    }
  }

  async function forgot() {
    setMsg('')
    if (!username.trim()) {
      setMsg('اكتب اسمك المستعار أولاً ثم اضغط "نسيت كلمة المرور"')
      return
    }
    setBusy(true)
    const r = await api('/api/forgot', { username })
    setBusy(false)
    setMsg(r.ok ? '✅ وصل طلبك للمشرف، سيعيد لك كلمة السر قريباً' : r.data.error)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 20 }}>
        <button onClick={onBack} style={{ ...btn(false), width: 'auto', alignSelf: 'flex-start', padding: '6px 16px', fontSize: 14 }}>
          ← رجوع
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn(mode === 'register')} onClick={() => { setMode('register'); setMsg('') }}>حساب جديد</button>
          <button style={btn(mode === 'login')} onClick={() => { setMode('login'); setMsg('') }}>دخول</button>
        </div>

        <input dir="auto" style={input} placeholder="الاسم المستعار" value={username} maxLength={20} onChange={(e) => setUsername(e.target.value)} />
        <input style={input} type="password" placeholder="كلمة السر" value={password} onChange={(e) => setPassword(e.target.value)} />

        {mode === 'register' && (
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <Avatar value={avatar} size={56} />
              <div style={{ fontSize: 14, opacity: 0.9 }}>صورتك (اختيارية): اختر رمزاً أو ارفع صورة</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setAvatar(e)} style={{
                  width: 44, height: 44, fontSize: 24, borderRadius: '50%', cursor: 'pointer',
                  border: avatar === e ? '3px solid #ffb830' : '2px solid transparent',
                  background: 'rgba(255,255,255,0.12)',
                }}>{e}</button>
              ))}
            </div>
            <input type="file" accept="image/*" onChange={pickFile} style={{ fontSize: 14, color: '#fff', maxWidth: '100%' }} />
          </div>
        )}

        {msg && <div style={{ color: '#ffd166', fontSize: 15, textAlign: 'center', lineHeight: 1.7 }}>{msg}</div>}

        <button style={{ ...btn(true), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={submit}>
          {busy ? '...' : mode === 'register' ? 'إنشاء الحساب' : 'دخول'}
        </button>

        {mode === 'login' && (
          <button onClick={forgot} disabled={busy} style={{ background: 'none', border: 'none', color: '#ffb830', fontSize: 15, fontFamily: 'inherit', cursor: 'pointer' }}>
            نسيت كلمة المرور؟
          </button>
        )}
      </div>
    </div>
  )
}