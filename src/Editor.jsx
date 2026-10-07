import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { lockText } from './lock.js'

const SHAPES = [['torn', 'قصاصة ممزقة'], ['sticky', 'ملاحظة لاصقة'], ['notebook', 'ورقة دفتر'], ['polaroid', 'بولارويد'], ['old', 'ورقة قديمة']]
const DECOS = [['none', 'بدون'], ['tape', 'شريط لاصق'], ['stitch', 'خياطة'], ['stars', 'نجوم'], ['wave', 'موجات']]
const FONTS = [['Cairo', 'القاهرة'], ['Tajawal', 'تجوّل'], ['Amiri', 'أميري'], ['Lalezar', 'لالزار'], ['Reem Kufi', 'ريم كوفي'], ['Aref Ruqaa', 'عارف رقعة'], ['Pacifico', 'Pacifico'], ['Caveat', 'Caveat'], ['Lobster', 'Lobster'], ['Indie Flower', 'Indie Flower']]
const PAPER_COLORS = ['#ffffff', '#fff3a0', '#ffc8dd', '#bde0fe', '#c7f9cc', '#ffd6a5', '#e0bbff', '#f1e3c8', '#ffb3b3', '#d9d9d9']
const DECO_COLORS = ['#ffb830', '#ff4d6d', '#4cc9f0', '#80ed99', '#b388ff', '#ffffff', '#ff9f1c', '#2ec4b6', '#f72585', '#222222']
const FONT_COLORS = ['#222222', '#ffffff', '#b00020', '#0b3d91', '#0a6e31', '#6a1b9a', '#e65100', '#000000', '#795548', '#c2185b']
const STICKERS = ['⭐️', '❤️', '🎉', '🎆', '🍳', '🌙', '🎁', '✨', '🥳', '🕊', '🌹', '☕️']
const INSETS = { torn: '20px 24px', sticky: '20px 20px 44px', notebook: '12px 20px 12px 44px', polaroid: '30px 30px 74px', old: '28px 32px' }

function loadDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {}
  } catch {
    return {}
  }
}

const rnd = (i) => Math.abs((Math.sin(i * 91.7) * 1000) % 1)

function makeTorn() {
  const p = []
  const n = 16
  let k = 0
  for (let i = 0; i <= n; i++) p.push(`${(i / n) * 100}% ${rnd(k++) * 3}%`)
  for (let i = 1; i <= n; i++) p.push(`${100 - rnd(k++) * 3}% ${(i / n) * 100}%`)
  for (let i = n - 1; i >= 0; i--) p.push(`${(i / n) * 100}% ${100 - rnd(k++) * 3}%`)
  for (let i = n - 1; i > 0; i--) p.push(`${rnd(k++) * 3}% ${(i / n) * 100}%`)
  return `polygon(${p.join(',')})`
}
const TORN = makeTorn()

function lum(hex) {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contrast(a, b) {
  const l1 = lum(a)
  const l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
function wave(c) {
  const stroke = encodeURIComponent(c)
  return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8'%3E%3Cpath d='M0 4 Q6 0 12 4 T24 4' fill='none' stroke='" + stroke + "' stroke-width='2.5'/%3E%3C/svg%3E\")"
}

function chip(active) {
  return {
    padding: '8px 14px', margin: 4, borderRadius: 20, cursor: 'pointer',
    border: active ? '2px solid #ffb830' : '2px solid transparent',
    background: active ? 'rgba(255,184,48,0.25)' : 'rgba(255,255,255,0.12)',
    color: '#fff', fontSize: 15, fontFamily: 'inherit',
  }
}

const TABS = [
  ['shape', '📄', 'الشكل'],
  ['paper', '🎨', 'لون الورقة'],
  ['deco', '✨', 'الزخرفة'],
  ['decoColor', '🖌', 'لون الزخرفة'],
  ['font', '🔤', 'الخط'],
  ['fontColor', '🅰️', 'لون الخط'],
  ['stickers', '😀', 'ستيكرات'],
]

export default function Editor({ user, room, onBack }) {
  const draftKey = 'draft:' + user.username + ':' + room.code
  const [d] = useState(() => loadDraft(draftKey))
  const [shape, setShape] = useState(d.shape || 'torn')
  const [paperColor, setPaperColor] = useState(d.paperColor || '#fff3a0')
  const [deco, setDeco] = useState(d.deco || 'tape')
  const [decoColor, setDecoColor] = useState(d.decoColor || '#ff4d6d')
  const [font, setFont] = useState(d.font || 'Cairo')
  const [fontColor, setFontColor] = useState(d.fontColor || '#222222')
  const [text, setText] = useState(d.text || '')
  const [stickers, setStickers] = useState(d.stickers || [])
  const [sel, setSel] = useState(null)
  const [tab, setTab] = useState('shape')
  const boxRef = useRef(null)
  const dragging = useRef(false)
  const manual = useRef(false)
  const [savedSnap, setSavedSnap] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [retry, setRetry] = useState(0)

  const snapshot = JSON.stringify({ shape, paperColor, deco, decoColor, font, fontColor, text, stickers })
  const empty = !text.trim() && stickers.length === 0

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, snapshot)
    } catch {
      /* ignore */
    }
    if (empty || snapshot === savedSnap) return undefined
    const delay = manual.current ? 0 : 2000
    manual.current = false
    const t = setTimeout(async () => {
      setBusy(true)
      setErr('')
      try {
        const cipher = await lockText(snapshot)
        const r = await api('/api/wish', { room: room.code, data: cipher }, user.token)
        if (r.ok) setSavedSnap(snapshot)
        else setErr(r.data.error || 'تعذّر الحفظ')
      } catch {
        setErr('تعذّر القفل، تأكد من الإنترنت')
      }
      setBusy(false)
    }, delay)
    return () => clearTimeout(t)
  }, [snapshot, savedSnap, empty, retry, draftKey, room.code, user.token])

  function saveNow() {
    manual.current = true
    setRetry((n) => n + 1)
  }

  let statusText = '🔓 اكتب أمنيتك وسنحفظها تلقائياً'
  if (!empty) {
    if (err) statusText = '⚠️ ' + err
    else if (savedSnap === snapshot) statusText = '🔒 محفوظ ومقفل حتى رأس السنة'
    else if (busy) statusText = '⏳ جارٍ القفل والحفظ...'
    else statusText = '✏️ سيُحفظ بعد ثوانٍ...'
  }

  function addSticker(emoji) {
    if (stickers.length >= 12) return
    const id = stickers.reduce((m, st) => Math.max(m, st.id), 0) + 1
    setStickers([...stickers, { id, e: emoji, x: 50, y: 50, size: 44 }])
    setSel(id)
  }
  function update(id, patch) {
    setStickers(stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }
  const selected = stickers.find((s) => s.id === sel)

  function onDown(ev, s) {
    ev.stopPropagation()
    setSel(s.id)
    ev.currentTarget.setPointerCapture(ev.pointerId)
    dragging.current = true
  }
  function onMove(ev, s) {
    if (!dragging.current) return
    const rect = boxRef.current.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((ev.clientY - rect.top) / rect.height) * 100))
    update(s.id, { x, y })
  }
  function onUp() {
    dragging.current = false
  }

  const shapeStyles = {
    torn: { clipPath: TORN },
    sticky: { clipPath: 'polygon(0 0,100% 0,100% calc(100% - 36px),calc(100% - 36px) 100%,0 100%)' },
    notebook: {
      borderRadius: 6,
      backgroundPosition: '0 12px',
      backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(70,110,200,.5) 27px, rgba(70,110,200,.5) 28px)',
    },
    polaroid: { borderRadius: 4 },
    old: { borderRadius: '4% 7% 5% 8% / 6% 4% 7% 5%', boxShadow: 'inset 0 0 50px rgba(110,60,10,.55)' },
  }

  const strip = {
    position: 'absolute', left: 8, right: 8, height: 14, pointerEvents: 'none',
    overflow: 'hidden', whiteSpace: 'nowrap', color: decoColor, fontSize: 13,
    lineHeight: '14px', direction: 'ltr',
  }
  const waveStrip = {
    position: 'absolute', left: 8, right: 8, height: 8, pointerEvents: 'none',
    backgroundImage: wave(decoColor), backgroundRepeat: 'repeat-x',
  }
  const weak = contrast(fontColor, paperColor) < 3

  function swatches(list, value, onChange) {
    return list.map((c) => (
      <button
        key={c}
        onClick={() => onChange(c)}
        style={{
          width: 44, height: 44, margin: 5, borderRadius: '50%', background: c, cursor: 'pointer',
          border: value === c ? '4px solid #ffb830' : '2px solid rgba(255,255,255,0.6)',
        }}
      />
    ))
  }
  function chips(list, value, onChange, fontMode) {
    return list.map(([k, l]) => (
      <button
        key={k}
        onClick={() => onChange(k)}
        style={{ ...chip(value === k), fontFamily: fontMode ? "'" + k + "', sans-serif" : 'inherit' }}
      >
        {l}
      </button>
    ))
  }

  let panel = null
  if (tab === 'shape') panel = chips(SHAPES, shape, setShape)
  if (tab === 'paper') panel = swatches(PAPER_COLORS, paperColor, setPaperColor)
  if (tab === 'deco') panel = chips(DECOS, deco, setDeco)
  if (tab === 'decoColor') panel = swatches(DECO_COLORS, decoColor, setDecoColor)
  if (tab === 'font') panel = chips(FONTS, font, setFont, true)
  if (tab === 'fontColor') panel = swatches(FONT_COLORS, fontColor, setFontColor)
  if (tab === 'stickers') {
    panel = (
      <>
        {STICKERS.map((emoji) => (
          <button key={emoji} style={{ ...chip(false), fontSize: 28, padding: '6px 12px' }} onClick={() => addSticker(emoji)}>{emoji}</button>
        ))}
        <div style={{ width: '100%', fontSize: 13, opacity: 0.8, margin: '6px 4px' }}>
          اضغط ستيكراً لإضافته ثم اسحبه فوق الورقة
        </div>
        {selected && (
          <div style={{ width: '100%', display: 'flex', gap: 6 }}>
            <button style={chip(false)} onClick={() => update(selected.id, { size: Math.min(120, selected.size + 8) })}>تكبير ＋</button>
            <button style={chip(false)} onClick={() => update(selected.id, { size: Math.max(20, selected.size - 8) })}>تصغير －</button>
            <button
              style={chip(false)}
              onClick={() => {
                setStickers(stickers.filter((s) => s.id !== selected.id))
                setSel(null)
              }}
            >
              حذف 🗑
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', padding: '10px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button onClick={onBack} style={{ padding: '6px 14px', fontSize: 14, fontFamily: 'inherit', border: 'none', borderRadius: 16, cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#fff' }}>
            → الغرف
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{room.name}</span>
        </div>
        <div
          ref={boxRef}
          onPointerDown={() => setSel(null)}
          style={{ position: 'relative', height: 'min(260px, 34dvh)', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.45))' }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundColor: paperColor, ...shapeStyles[shape] }} />

          {shape === 'sticky' && (
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, background: 'linear-gradient(135deg, rgba(0,0,0,.2) 50%, transparent 50%)' }} />
          )}
          {shape === 'polaroid' && (
            <div style={{ position: 'absolute', inset: '14px 14px 56px 14px', background: 'rgba(255,255,255,.5)', boxShadow: 'inset 0 0 8px rgba(0,0,0,.25)' }} />
          )}
          {shape === 'notebook' && (
            <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center' }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: '#2a1656' }} />
              ))}
            </div>
          )}

          {deco === 'tape' && (
            <>
              <div style={{ position: 'absolute', top: -8, left: '12%', width: 90, height: 26, background: decoColor, opacity: 0.75, transform: 'rotate(-6deg)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: -8, right: '12%', width: 90, height: 26, background: decoColor, opacity: 0.75, transform: 'rotate(5deg)', pointerEvents: 'none' }} />
            </>
          )}
          {deco === 'stitch' && (
            <div style={{ position: 'absolute', inset: 8, border: '2.5px dashed ' + decoColor, borderRadius: 4, pointerEvents: 'none' }} />
          )}
          {deco === 'stars' && (
            <>
              <div style={{ ...strip, top: 6 }}>{'★ '.repeat(40)}</div>
              <div style={{ ...strip, bottom: 6 }}>{'★ '.repeat(40)}</div>
            </>
          )}
          {deco === 'wave' && (
            <>
              <div style={{ ...waveStrip, top: 6 }} />
              <div style={{ ...waveStrip, bottom: 6 }} />
            </>
          )}

          <textarea
            dir="auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب أمنيتك هنا..."
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              textAlign: 'center', fontSize: 20, lineHeight: '28px',
              color: fontColor, fontFamily: "'" + font + "', sans-serif",
              padding: INSETS[shape],
            }}
          />

          {stickers.map((s) => (
            <div
              key={s.id}
              onPointerDown={(ev) => onDown(ev, s)}
              onPointerMove={(ev) => onMove(ev, s)}
              onPointerUp={onUp}
              style={{
                position: 'absolute', left: s.x + '%', top: s.y + '%',
                transform: 'translate(-50%,-50%)', fontSize: s.size, lineHeight: 1,
                touchAction: 'none', userSelect: 'none', cursor: 'grab', zIndex: 3,
                outline: sel === s.id ? '2px dashed #fff' : 'none', borderRadius: 8,
              }}
            >
              {s.e}
            </div>
          ))}
        </div>
        {weak && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#ffd166', textAlign: 'center' }}>
            ⚠️ لون الخط قريب من لون الورقة، قد يصعب قراءته
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 13 }}>{statusText}</span>
          <button
            onClick={saveNow}
            disabled={empty || busy}
            style={{
              padding: '8px 16px', fontSize: 14, fontFamily: 'inherit', fontWeight: 700, border: 'none',
              borderRadius: 20, cursor: 'pointer', background: '#ffb830', color: '#000', opacity: empty || busy ? 0.5 : 1,
            }}
          >
            حفظ الآن
          </button>
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', overflowX: 'auto', gap: 6, padding: '6px 12px', background: 'rgba(0,0,0,0.25)', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(([k, icon, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: '0 0 auto', minHeight: 48, padding: '4px 12px', borderRadius: 14, cursor: 'pointer',
              border: 'none', fontFamily: 'inherit', fontSize: 13, color: '#fff',
              background: tab === k ? 'rgba(255,184,48,0.35)' : 'transparent',
              borderBottom: tab === k ? '3px solid #ffb830' : '3px solid transparent',
            }}
          >
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div>{label}</div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>{panel}</div>
      </div>
    </div>
  )
}