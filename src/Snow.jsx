import { useMemo } from 'react'

const COUNT = 24
const TONES = ['#eaf6ff', '#bfe6fb', '#9fd8f5']

function rnd(seed) {
  const x = Math.sin(seed * 999.7) * 43758.5453
  return x - Math.floor(x)
}

// رقعة ثلج سداسية بذراعين متفرعتين، أقرب لشكل إيموجي ❄️ من مجرد شكل هندسي بسيط
function flakeSvg(color) {
  const arms = []
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180
    const x2 = 50 + 42 * Math.cos(a)
    const y2 = 50 + 42 * Math.sin(a)
    arms.push('<line x1="50" y1="50" x2="' + x2 + '" y2="' + y2 + '" />')
    ;[0.55, 0.78].forEach((t) => {
      const bx = 50 + 42 * t * Math.cos(a)
      const by = 50 + 42 * t * Math.sin(a)
      const perp = a + Math.PI / 2
      const len = 9
      arms.push(
        '<line x1="' + bx + '" y1="' + by + '" x2="' + (bx + len * Math.cos(perp)) + '" y2="' + (by + len * Math.sin(perp)) + '" />' +
          '<line x1="' + bx + '" y1="' + by + '" x2="' + (bx - len * Math.cos(perp)) + '" y2="' + (by - len * Math.sin(perp)) + '" />'
      )
    })
  }
  return (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E" +
    encodeURIComponent('<g stroke="' + color + '" stroke-width="5" stroke-linecap="round" fill="none">' + arms.join('') + '</g>') +
    "%3C/svg%3E"
  )
}

export default function Snow() {
  const flakes = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        left: rnd(i + 1) * 100,
        size: 16 + rnd(i + 11) * 20,
        duration: 11 + rnd(i + 21) * 13,
        delay: -rnd(i + 31) * 24,
        drift: 16 + rnd(i + 41) * 28,
        opacity: 0.4 + rnd(i + 51) * 0.45,
        spin: 6 + rnd(i + 61) * 10,
        tone: TONES[i % TONES.length],
      })),
    []
  )

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
      <style>{`
        @keyframes snowFall { to { transform: translateY(112dvh) translateX(var(--drift)); } }
        @keyframes snowSpin { to { rotate: 360deg; } }
        .snowflake { position: absolute; top: -10%; animation: snowFall linear infinite; }
        .snowflake-spin { width: 100%; height: 100%; animation: snowSpin linear infinite; }
      `}</style>
      {flakes.map((f) => (
        <div
          key={f.id}
          className="snowflake"
          style={{
            left: f.left + '%',
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: f.duration + 's',
            animationDelay: f.delay + 's',
            '--drift': f.drift + 'px',
            filter: 'drop-shadow(0 0 3px rgba(190,230,255,0.55))',
          }}
        >
          <div
            className="snowflake-spin"
            style={{ animationDuration: f.spin + 's', backgroundImage: "url(\"" + flakeSvg(f.tone) + "\")", backgroundSize: 'contain' }}
          />
        </div>
      ))}
    </div>
  )
}