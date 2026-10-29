import { useState } from 'react'
import GiftBox2D from './GiftBox2D.jsx'
import { BOX_PRESETS } from './giftColors.js'

export default function GiftBoxPreview() {
  const [preset, setPreset] = useState(0)
  const [open, setOpen] = useState(false)
  const p = BOX_PRESETS[preset]
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', padding: '12px 16px 0', fontSize: 14, opacity: 0.85 }}>معاينة صندوق الهدية (رسم مسطّح)</div>
      <div style={{ flex: 1, minHeight: 0, padding: 20 }}>
        <GiftBox2D box={p.box} ribbon={p.ribbon} open={open} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: '6px 16px' }}>
        {BOX_PRESETS.map((pr, i) => (
          <button
            key={pr.name}
            onClick={() => setPreset(i)}
            style={{
              padding: '8px 16px', fontSize: 14, fontFamily: 'inherit', border: 'none', borderRadius: 20, cursor: 'pointer',
              background: preset === i ? '#d4af37' : 'rgba(255,235,215,0.15)', color: preset === i ? '#6e0710' : '#fff',
            }}
          >
            {pr.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px 20px' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ padding: '10px 28px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 24, cursor: 'pointer', background: '#c8102e', color: '#fff' }}
        >
          {open ? 'أغلق الصندوق' : 'افتح الصندوق'}
        </button>
      </div>
    </div>
  )
}