import { useMemo } from 'react'

const COUNT = 26

function rnd(seed) {
  const x = Math.sin(seed * 999.7) * 43758.5453
  return x - Math.floor(x)
}

export default function Snow() {
  const flakes = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        left: rnd(i + 1) * 100,
        size: 6 + rnd(i + 11) * 10,
        duration: 10 + rnd(i + 21) * 12,
        delay: -rnd(i + 31) * 22,
        drift: 18 + rnd(i + 41) * 30,
        opacity: 0.35 + rnd(i + 51) * 0.5,
      })),
    []
  )

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <style>{`
        @keyframes snowFall { to { transform: translateY(110dvh) translateX(var(--drift)); } }
        @keyframes snowSway { 0%, 100% { margin-left: 0; } 50% { margin-left: var(--drift); } }
        .snowflake {
          position: absolute; top: -8%; clip-path: polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%);
          background: #ffffff; animation: snowFall linear infinite;
        }
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
            boxShadow: '0 0 ' + f.size / 2 + 'px rgba(255,255,255,0.6)',
          }}
        />
      ))}
    </div>
  )
}