import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { lockText, unlockText, UNLOCK_AT } from './lock.js'
import { encryptDraft, decryptDraft } from './crypt.js'

const nowMs = () => Date.now()
function readLocal(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export default function Vault({ user, onBack }) {
  const draftKey = 'vault:' + user.username
  const tsKey = 'vaultT:' + user.username
  const [text, setText] = useState(() => readLocal(draftKey) || '')
  const [isOpen] = useState(() => nowMs() >= UNLOCK_AT)
  const [savedText, setSavedText] = useState(null)
  const [onServer, setOnServer] = useState(false)
  const [opened, setOpened] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const latest = useRef({ text, savedText: null })
  const initial = useRef(null)
  const saving = useRef(false)

  useEffect(() => {
    latest.current = { text, savedText }
    if (initial.current === null) initial.current = text
    try {
      localStorage.setItem(draftKey, text)
      if (text !== initial.current) localStorage.setItem(tsKey, String(nowMs()))
    } catch {
      /* ignore */
    }
  })

  const persist = useCallback(async () => {
    const { text: t, savedText: saved } = latest.current
    if (isOpen || !t.trim() || t === saved || saving.current) return
    saving.current = true
    setErr('')
    try {
      const cipher = await lockText(t)
      const draft = user.dk ? await encryptDraft(user.dk, t) : null
      const r = await api('/api/vault', { data: cipher, draft, draftAt: nowMs() }, user.token)
      if (r.ok) {
        setSavedText(t)
        setOnServer(true)
      } else setErr(r.data.error || 'تعذّر الحفظ')
    } catch {
      setErr('تعذّر القفل، تأكد من الإنترنت')
    }
    saving.current = false
  }, [isOpen, user.token, user.dk])

  useEffect(() => {
    if (isOpen || !text.trim() || text === savedText) return undefined
    const t = setTimeout(persist, 1500)
    return () => clearTimeout(t)
  }, [text, savedText, isOpen, persist])

  useEffect(() => {
    function onHide() {
      if (document.visibilityState === 'hidden') persist()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', persist)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', persist)
    }
  }, [persist])

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
      if (r.ok && !isOpen && r.data.draft && user.dk && latest.current.text === initial.current) {
        const localT = Number(readLocal(tsKey)) || 0
        if (!latest.current.text.trim() || r.data.draftAt > localT) {
          try {
            const t = await decryptDraft(user.dk, r.data.draft)
            if (alive) setText(t)
          } catch {
            /* كلمة السر تغيّرت أو النسخة تالفة: نتجاهلها */
          }
        }
      }
      if (alive) setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [user.token, user.dk, isOpen, tsKey])

  async function done() {
    await persist()
    onBack()
  }

  const box = { maxWidth: 440, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100dvh' }
  const back = (
    <button onClick={done} style={{ alignSelf: 'flex-start', padding: '6px 14px', fontSize: 14, fontFamily: 'inherit', border: 'none', borderRadius: 16, cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
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
        اختيارية وخاصة بك وحدك. تنفتح لك في رأس السنة ولا يستطيع أحد قراءتها قبل ذلك.
      </div>
      {onServer && !text.trim() && !loading && (
        <div style={{ color: '#ffd166', fontSize: 14, lineHeight: 1.8 }}>
          لديك رسالة محفوظة سابقاً ولا يمكن عرضها قبل الموعد. وإن كتبت هنا فستستبدلها.
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
      {err && <div style={{ color: '#ffd166', fontSize: 13, textAlign: 'center' }}>⚠️ {err}</div>}
      <button
        onClick={done}
        style={{ padding: 12, fontSize: 16, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 24, cursor: 'pointer', background: '#ffb830', color: '#000' }}
      >
        تم ✓
      </button>
    </div>
  )
}