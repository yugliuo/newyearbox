import { useState } from 'react'
import { lockText, unlockText, UNLOCK_AT, roundFor } from './lock.js'

const btn = {
  width: '100%', padding: 14, fontSize: 17, fontFamily: 'inherit', fontWeight: 700,
  border: 'none', borderRadius: 14, cursor: 'pointer', background: '#ffb830', color: '#000',
}

export default function Test() {
  const [cipher, setCipher] = useState('')
  const [openAt, setOpenAt] = useState(0)
  const [log, setLog] = useState([])

  const add = (t) => setLog((l) => [...l, t])
  const fmt = (ms) => new Date(ms).toLocaleTimeString('ar-IQ', { timeZone: 'Asia/Baghdad' })

  async function lockMinute() {
    try {
      const at = Date.now() + 60000
      add('⏳ جارٍ القفل...')
      const c = await lockText('مرحبا من الماضي 🍳', at)
      setCipher(c)
      setOpenAt(at)
      add('🔒 تم القفل. يفتح عند ' + fmt(at) + ' (طول النص المشفّر ' + c.length + ' حرفاً)')
    } catch (e) {
      add('❌ فشل القفل: ' + e.message)
    }
  }

  async function tryOpen() {
    if (!cipher) return add('اضغط "اقفل لمدة دقيقة" أولاً')
    try {
      const t = await unlockText(cipher)
      add('🔓 انفتح: ' + t)
    } catch (e) {
      add('🔐 لم ينفتح (' + (Date.now() < openAt ? 'لم يحن الوقت بعد، وهذا صحيح' : 'خطأ') + '): ' + e.message)
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>اختبار القفل الزمني</h2>
      <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.8 }}>
        موعد فتح الصندوق الحقيقي: {new Date(UNLOCK_AT).toLocaleString('ar-IQ', { timeZone: 'Asia/Baghdad' })} بتوقيت بغداد
        <br />
        رقم الجولة: {roundFor(UNLOCK_AT)}
      </div>
      <button style={btn} onClick={lockMinute}>1) اقفل رسالة لمدة دقيقة</button>
      <button style={btn} onClick={tryOpen}>2) حاول الفتح</button>
      <div style={{ fontSize: 15, lineHeight: 1.9 }}>
        {log.map((t, i) => <div key={i}>{t}</div>)}
      </div>
    </div>
  )
}