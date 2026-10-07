import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { lockText, unlockText, UNLOCK_AT } from './lock.js'

export default function Vault({ user, onBack }) {
  const draftKey = 'vault:' + user.username
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(draftKey) || ''
    } catch {
      return ''
    }
  })
  const [isOpen] = useState(() => Date.now() >= UNLOCK_AT)
  const [savedText, setSavedText] = useState(null)
  const [onServer, setOnServer] = useState(false)
  const [opened, setOpened] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [retry, setRetry] = useState(0)
  const manual = useRef(false)

  useEffect(() => {
    let alive = true
    async function load() {
      const r = await api('/api/vault', null, user.token)
      if (!alive) return
      if (r.ok && r.data.data) {
        setOnServer(true)
        if (isOpen) {
          try {
            setOpened(await unlockText(r.data.data))
          } catch {
            setErr('تعذّر فتح الرسالة، حاول بعد قليل')
          }
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [user.token, isOpen])

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, text)
    } catch {
      /* ignore */
    }
    if (isOpen || !text.trim() || text === savedText) return undefined
    const delay = manual.current ? 0 : 2000
    manual.current = false
    const t = setTimeout(async () => {
      setBusy(true)
      setErr('')
      try {
        const cipher = await lockText(text)
        const r = await api('/api/vault', { data: cipher }, user.token)
        if (r.ok) {
          setSavedText(text)
          setOnServer(true)
        } else setErr(r.data.error || 'تعذّر الحفظ')
      } catch {
        setErr('تعذّر القفل، تأكد من الإنترنت')
      }
      setBusy(false)
    }, delay)
    return () => clearTimeout(t)
  }, [text, savedText, isOpen, retry, draftKey, user.token])

  function saveNow() {
    manual.current = true
    setRetry((n) => n + 1)
  }

  let status = '✏️ اكتب رسالتك وسنحفظها تلقائياً'
  if (text.trim()) {
    if (err) status = '⚠️ ' + err
    else if (savedText === text) status = '🔒 محفوظة ومقفلة حتى رأس السنة'
    else if (busy) status = '⏳ جارٍ القفل والحفظ...'
    else status = '✏️ ستُحفظ بعد ثوانٍ...'
  }

  const box = { maxWidth: 440, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100dvh' }
  const back = (
    <button onClick={onBack} style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: 14, fontFamily: 'inherit', border: 'none', borderRadius: 16, cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
      → رجوع
    </button>
  )

  if (isOpen) {
    return (
      <div style={box}>
        {back}
        <h2>📮 رسالتك من الماضي</h2>
        {loading && <div>جارٍ الفتح...</div>}
        {!loading && opened && (
          <div style={{ background: '#fff8e1', color: '#3b2a10', borderRadius: 16, padding: 20, lineHeight: 2, fontSize: 18, whiteSpace: 'pre-wrap' }} dir="auto">{opened}</div>
        )}
        {!loading && !opened && !err && <div style={{ opacity: 0.85 }}>لم تكتب رسالة هذه السنة.</div>}
        {err && <div style={{ color: '#ffd166' }}>{err}</div>}
      </div>
    )
  }

  return (
    <div style={box}>
      {back}
      <h2>📮 رسالة إلى نفسك في المستقبل</h2>
      <div style={{ opacity: 0.85, lineHeight: 1.9, fontSize: 15 }}>
        اختيارية وخاصة بك وحدك. تُقفل الآن ولا يستطيع أحد قراءتها، وتنفتح لك في رأس السنة.
      </div>
      {onServer && !text.trim() && !loading && (
        <div style={{ color: '#ffd166', fontSize: 14, lineHeight: 1.8 }}>
          لديك رسالة محفوظة سابقاً (قد تكون من جهاز آخر)، ولا يمكن عرضها قبل الموعد. وإن كتبت هنا فستستبدلها.
        </div>
      )}
      <textarea
        dir="auto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="عزيزي أنا في العام القادم..."
        style={{
          flex: 1, minHeight: 260, resize: 'none', padding: 18, fontSize: 18, lineHeight: 2, fontFamily: 'inherit',
          borderRadius: 16, border: 'none', outline: 'none', background: '#fff8e1', color: '#3b2a10',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13 }}>{status}</span>
        <button
          onClick={saveNow}
          disabled={!text.trim() || busy}
          style={{ padding: '8px 16px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 20, cursor: 'pointer', background: '#ffb830', color: '#000', opacity: !text.trim() || busy ? 0.5 : 1 }}
        >
          حفظ الآن
        </button>
      </div>
    </div>
  )
}