import { useEffect, useRef, useState } from 'react'
import { api, API_BASE } from './api.js'
import { lockBytes, unlockBytes, UNLOCK_AT } from './lock.js'

const MAX_BYTES = 500 * 1024 * 1024 // 500 ميغابايت خام كحد أقصى
const MAX_SECONDS = 3 * 60 // 3 دقائق كحد أقصى
const CHUNK = 8 * 1024 * 1024 // حجم كل قطعة أثناء الرفع

const card = { background: 'rgba(255,235,215,0.1)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }
const btn = (primary, danger) => ({
  padding: '9px 16px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 20, cursor: 'pointer',
  background: danger ? '#c23a3a' : primary ? '#e8b23d' : 'rgba(255,235,215,0.15)', color: primary && !danger ? '#000' : '#fff',
})

function fmtMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' م.ب'
}
function videoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src)
      resolve(v.duration)
    }
    v.onerror = () => resolve(null)
    v.src = URL.createObjectURL(file)
  })
}
export default function VideoBox({ user }) {
  const [isOpen] = useState(() => Date.now() >= UNLOCK_AT)
  const [status, setStatus] = useState(null) // {size, updatedAt} أو null
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(null) // 0..100 أثناء الرفع
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [playUrl, setPlayUrl] = useState(null)
  const [opening, setOpening] = useState(false)
  const fileInput = useRef(null)
  const abortInfo = useRef(null)

  useEffect(() => {
    let alive = true
    api('/api/video/status', null, user.token).then((r) => {
      if (alive) {
        if (r.ok) setStatus(r.data.has ? r.data : null)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [user.token])

  async function pick(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setErr('')
    if (file.size > MAX_BYTES) {
      setErr('الملف أكبر من 500 ميغابايت، اختر مقطعاً أصغر أو بجودة أقل')
      return
    }
    const dur = await videoDuration(file)
    if (dur && dur > MAX_SECONDS) {
      setErr('المقطع أطول من 3 دقائق، اختصره ثم أعد المحاولة')
      return
    }
    upload(file)
  }

  async function upload(file) {
    setBusy(true)
    setProgress(0)
    setErr('')
    try {
      const raw = new Uint8Array(await file.arrayBuffer())
      setProgress(5)
      const cipher = await lockBytes(raw)
      setProgress(15)

      const start = await api('/api/video/start', { size: cipher.length }, user.token)
      if (!start.ok) throw new Error(start.data.error || 'تعذّر بدء الرفع')
      const { uploadId, key } = start.data
      abortInfo.current = { uploadId, key }

      const total = Math.ceil(cipher.length / CHUNK)
      const parts = []
      for (let i = 0; i < total; i++) {
        const chunk = cipher.slice(i * CHUNK, (i + 1) * CHUNK)
        const r = await api(
          '/api/video/part?key=' + encodeURIComponent(key) + '&uploadId=' + encodeURIComponent(uploadId) + '&part=' + (i + 1),
          null,
          user.token,
          chunk,
          'POST'
        )
        if (!r.ok) throw new Error(r.data.error || 'فشل رفع جزء من الفيديو')
        parts.push({ partNumber: i + 1, etag: r.data.etag })
        setProgress(15 + Math.round(((i + 1) / total) * 80))
      }

      const done = await api('/api/video/complete', { key, uploadId, size: cipher.length, parts }, user.token)
      if (!done.ok) throw new Error(done.data.error || 'تعذّر إنهاء الرفع')
      abortInfo.current = null
      setStatus({ has: true, size: cipher.length, updatedAt: Date.now() })
      setProgress(100)
      setTimeout(() => setProgress(null), 1200)
    } catch (e) {
      setErr(e.message || 'تعذّر رفع الفيديو، تأكد من الإنترنت وحاول مجدداً')
      setProgress(null)
      if (abortInfo.current) {
        api('/api/video/abort', abortInfo.current, user.token).catch(() => {})
        abortInfo.current = null
      }
    }
    setBusy(false)
  }

  async function remove() {
    setBusy(true)
    const r = await api('/api/video', null, user.token, null, 'DELETE')
    if (r.ok) {
      setStatus(null)
      setPlayUrl(null)
    } else setErr(r.data.error)
    setBusy(false)
  }

  async function openVideo() {
    setOpening(true)
    setErr('')
    try {
      const res = await fetch(API_BASE + '/api/video', { headers: { Authorization: 'Bearer ' + user.token } })
      if (!res.ok) throw new Error('تعذّر تحميل الفيديو')
      const cipherBytes = new Uint8Array(await res.arrayBuffer())
      const raw = await unlockBytes(cipherBytes)
      const blob = new Blob([raw], { type: 'video/mp4' })
      setPlayUrl(URL.createObjectURL(blob))
    } catch {
      setErr('تعذّر فتح الفيديو الآن، أعد المحاولة بعد قليل')
    }
    setOpening(false)
  }

  if (loading) return <div style={card}>جارٍ التحميل...</div>

  if (isOpen) {
    return (
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>🎬 فيديوك من الماضي</div>
        {!status && <div style={{ opacity: 0.75 }}>لم ترفع فيديو هذه السنة.</div>}
        {status && !playUrl && (
          <button style={btn(true)} disabled={opening} onClick={openVideo}>{opening ? 'جارٍ الفتح...' : '▶️ شغّل الفيديو'}</button>
        )}
        {playUrl && <video src={playUrl} controls style={{ width: '100%', borderRadius: 12 }} />}
        {err && <div style={{ color: '#f2c25e', fontSize: 13 }}>{err}</div>}
      </div>
    )
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>🎬 فيديو من الماضي</div>
      <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.8 }}>
        اختياري وخاص بك وحدك. حتى 3 دقائق وحتى 500 ميغابايت، يُقفل الآن وينفتح لك في رأس السنة.
      </div>

      {status && progress === null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
          <span>🔒 محفوظ ({fmtMB(status.size)})</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={btn(false)} disabled={busy} onClick={() => fileInput.current.click()}>استبدال</button>
            <button style={btn(false, true)} disabled={busy} onClick={remove}>حذف</button>
          </div>
        </div>
      )}

      {!status && progress === null && (
        <button style={btn(true)} disabled={busy} onClick={() => fileInput.current.click()}>اختر فيديو</button>
      )}

      {progress !== null && (
        <div>
          <div style={{ height: 10, borderRadius: 6, background: 'rgba(255,235,215,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: progress + '%', background: '#e8b23d', transition: 'width .2s' }} />
          </div>
          <div style={{ fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            {progress < 15 ? 'جارٍ القفل...' : progress < 100 ? 'جارٍ الرفع... ' + progress + '%' : '✅ تم الحفظ'}
          </div>
        </div>
      )}

      {err && <div style={{ color: '#f2c25e', fontSize: 13 }}>⚠️ {err}</div>}

      <input ref={fileInput} type="file" accept="video/*" onChange={pick} style={{ display: 'none' }} />
    </div>
  )
}