import { useEffect, useState } from 'react'
import { api } from './api.js'

const card = { background: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }
const btn = (primary) => ({
  padding: '9px 16px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, border: 'none',
  borderRadius: 20, cursor: 'pointer', background: primary ? '#ffb830' : 'rgba(255,255,255,0.15)', color: primary ? '#000' : '#fff',
})

function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  })
}

// اسم الحي من إحداثيات الهاتف (OpenStreetMap). إن فشل نكتفي بالإحداثيات
async function placeName(lat, lng) {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=ar&lat=' + lat + '&lon=' + lng)
    const j = await r.json()
    const a = j.address || {}
    const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district || a.residential || ''
    const city = a.city || a.town || a.village || a.county || ''
    return [hood, city, a.state].filter((x, i, arr) => x && arr.indexOf(x) === i).join('، ')
  } catch {
    return ''
  }
}

export default function Locate({ user }) {
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    api('/api/location', null, user.token).then((r) => {
      if (alive && r.ok) setInfo(r.data)
    })
    return () => {
      alive = false
    }
  }, [user.token])

  async function share() {
    if (!navigator.geolocation) {
      setMsg('متصفحك لا يدعم تحديد الموقع')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const pos = await getPosition()
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      const place = await placeName(lat, lng)
      const r = await api('/api/location', { lat, lng, acc: accuracy, place }, user.token)
      if (r.ok) {
        setInfo({ has: true, place: r.data.place })
        setMsg('✅ تم حفظ موقعك')
      } else setMsg(r.data.error || 'تعذّر الحفظ')
    } catch (e) {
      if (e && e.code === 1) setMsg('لم تسمح بالموقع. فعّل الإذن للموقع من إعدادات المتصفح ثم حاول مجدداً.')
      else if (e && e.code === 3) setMsg('استغرق تحديد الموقع وقتاً طويلاً، حاول مرة أخرى.')
      else setMsg('تعذّر تحديد موقعك الآن.')
    }
    setBusy(false)
  }

  async function remove() {
    setBusy(true)
    const r = await api('/api/location', { clear: true }, user.token)
    if (r.ok) {
      setInfo({ has: false, place: '' })
      setMsg('🗑️ حُذف موقعك')
    }
    setBusy(false)
  }

  const shared = info && info.has
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>📍 موقعي التقريبي</div>
      {shared ? (
        <div style={{ fontSize: 14, lineHeight: 1.8 }}>{info.place ? info.place : 'تم تحديد موقعك'}</div>
      ) : (
        <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.8 }}>
          اختياري. يراه المنظّم فقط، بدقة تقريبية (حوالي 100 متر وليس بيتك بالضبط)، وتستطيع حذفه متى شئت.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...btn(!shared), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={share}>
          {busy ? '...' : shared ? 'تحديث موقعي' : 'حدّد موقعي'}
        </button>
        {shared && (
          <button style={{ ...btn(false), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={remove}>حذف موقعي</button>
        )}
      </div>
      {msg && <div style={{ fontSize: 13, color: '#ffd166', lineHeight: 1.7 }}>{msg}</div>}
    </div>
  )
}