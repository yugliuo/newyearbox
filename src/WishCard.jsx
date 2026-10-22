import { StickerGlyph } from './stickers.jsx'

// عرض ورقة أمنية (بلا أي تعديل) من نفس بيانات المحرر، تُستخدم في غرفة اللعب فقط
const TORN = (() => {
  const rnd = (i) => Math.abs((Math.sin(i * 91.7) * 1000) % 1)
  const p = []
  const n = 16
  let k = 0
  for (let i = 0; i <= n; i++) p.push((i / n) * 100 + '% ' + rnd(k++) * 3 + '%')
  for (let i = 1; i <= n; i++) p.push(100 - rnd(k++) * 3 + '% ' + (i / n) * 100 + '%')
  for (let i = n - 1; i >= 0; i--) p.push((i / n) * 100 + '% ' + (100 - rnd(k++) * 3) + '%')
  for (let i = n - 1; i > 0; i--) p.push(rnd(k++) * 3 + '% ' + (i / n) * 100 + '%')
  return 'polygon(' + p.join(',') + ')'
})()
const INSETS = { torn: '20px 24px', sticky: '20px 20px 44px', notebook: '12px 20px 12px 44px', polaroid: '30px 30px 74px', old: '28px 32px' }
function wave(c) {
  return "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='8'%3E%3Cpath d='M0 4 Q6 0 12 4 T24 4' fill='none' stroke='" + encodeURIComponent(c) + "' stroke-width='2.5'/%3E%3C/svg%3E\")"
}
const shapeStyles = {
  torn: { clipPath: TORN },
  sticky: { clipPath: 'polygon(0 0,100% 0,100% calc(100% - 36px),calc(100% - 36px) 100%,0 100%)' },
  notebook: {
    borderRadius: 6, backgroundPosition: '0 12px',
    backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(70,110,200,.5) 27px, rgba(70,110,200,.5) 28px)',
  },
  polaroid: { borderRadius: 4 },
  old: { borderRadius: '4% 7% 5% 8% / 6% 4% 7% 5%', boxShadow: 'inset 0 0 50px rgba(110,60,10,.55)' },
}

export default function WishCard({ snap, height }) {
  const shape = snap.shape || 'torn'
  const deco = snap.deco || 'none'
  const decoColor = snap.decoColor || '#ff4d6d'
  const strip = { position: 'absolute', left: 8, right: 8, height: 14, pointerEvents: 'none', overflow: 'hidden', whiteSpace: 'nowrap', color: decoColor, fontSize: 13, lineHeight: '14px', direction: 'ltr' }
  const waveStrip = { position: 'absolute', left: 8, right: 8, height: 8, pointerEvents: 'none', backgroundImage: wave(decoColor), backgroundRepeat: 'repeat-x' }
  return (
    <div style={{ position: 'relative', height: height || 260, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.45))' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: snap.paperColor || '#fff3a0', ...shapeStyles[shape] }} />
      {shape === 'sticky' && (
        <div style={{ position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, background: 'linear-gradient(135deg, rgba(0,0,0,.2) 50%, transparent 50%)' }} />
      )}
      {shape === 'polaroid' && (
        <div style={{ position: 'absolute', inset: '14px 14px 56px 14px', background: 'rgba(255,255,255,.5)', boxShadow: 'inset 0 0 8px rgba(0,0,0,.25)' }} />
      )}
      {deco === 'tape' && (
        <>
          <div style={{ position: 'absolute', top: -8, left: '12%', width: 90, height: 26, background: decoColor, opacity: 0.75, transform: 'rotate(-6deg)' }} />
          <div style={{ position: 'absolute', top: -8, right: '12%', width: 90, height: 26, background: decoColor, opacity: 0.75, transform: 'rotate(5deg)' }} />
        </>
      )}
      {deco === 'stitch' && <div style={{ position: 'absolute', inset: 8, border: '2.5px dashed ' + decoColor, borderRadius: 4 }} />}
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
      <div
        dir="auto"
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontSize: 20, lineHeight: '27px', color: snap.fontColor || '#222',
          fontFamily: "'" + (snap.font || 'Cairo') + "', sans-serif", padding: INSETS[shape], overflow: 'hidden', wordBreak: 'break-word',
        }}
      >
        {snap.text}
      </div>
      {(snap.stickers || []).map((s) => (
        <div key={s.id} style={{ position: 'absolute', left: s.x + '%', top: s.y + '%', transform: 'translate(-50%,-50%)', lineHeight: 1 }}>
          <StickerGlyph value={s.e} size={s.size} />
        </div>
      ))}
    </div>
  )
}