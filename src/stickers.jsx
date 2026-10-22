// مجموعة ستيكرات كريسماس مرسومة بالكود (SVG مسطح ثنائي الأبعاد)، بدل إيموجي لوحة المفاتيح.
// كل عنصر: name (يُحفظ في بيانات الأمنية) + label (للقائمة) + render(size) يرجع SVG.

function Ornament({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <rect x={21} y={2} width={6} height={6} rx={1.5} fill="#d4af37" />
      <circle cx={24} cy={28} r={16} fill="#c8102e" stroke="#ffe29a" strokeWidth={1.5} />
      <path d="M8 28a16 16 0 0 1 32 0" fill="none" stroke="#ffe29a" strokeWidth={2.5} opacity={0.85} />
      <ellipse cx={18} cy={21} rx={4} ry={2.4} fill="#fff" opacity={0.35} />
    </svg>
  )
}
function CandyCane({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M30 8a9 9 0 0 0-9 9v22" fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
      <path d="M30 8a9 9 0 0 0-9 9v22" fill="none" stroke="#c8102e" strokeWidth={8} strokeLinecap="round" strokeDasharray="6 6" />
    </svg>
  )
}
function Holly({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M24 6C14 10 10 20 18 24c-8 4-10 14-2 18 4-6 8-9 8-9s4 3 8 9c8-4 6-14-2-18 8-4 4-14-6-18z" fill="#2f8f5b" />
      <circle cx={20} cy={38} r={4} fill="#c8102e" />
      <circle cx={28} cy={38} r={4} fill="#c8102e" />
      <circle cx={24} cy={41} r={4} fill="#a50e24" />
    </svg>
  )
}
function Bell({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M24 6v4" stroke="#d4af37" strokeWidth={3} strokeLinecap="round" />
      <path d="M14 32c-1-10 2-18 10-18s11 8 10 18c3 1 4 3 4 4H10c0-1 1-3 4-4z" fill="#d4af37" />
      <circle cx={24} cy={40} r={3.2} fill="#8a6d1d" />
      <path d="M14 32c6 2 14 2 20 0" fill="none" stroke="#fff6da" strokeWidth={1.6} opacity={0.6} />
    </svg>
  )
}
function Star({ s }) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 20 : 8
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(24 + r * Math.cos(a) + ',' + (24 + r * Math.sin(a)))
  }
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <polygon points={pts.join(' ')} fill="#ffd94a" stroke="#c9960f" strokeWidth={1.2} />
    </svg>
  )
}
function Gift({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <rect x={8} y={20} width={32} height={20} rx={2} fill="#2f8f5b" />
      <rect x={8} y={20} width={32} height={7} fill="#1f6b40" />
      <rect x={21} y={20} width={6} height={20} fill="#ffd94a" />
      <rect x={8} y={20} width={32} height={6} fill="#ffd94a" opacity={0.0} />
      <path d="M24 20c-5-10-16-8-13-1 1 2 7 2 13 1zm0 0c5-10 16-8 13-1-1 2-7 2-13 1z" fill="#c8102e" />
    </svg>
  )
}
function Stocking({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M16 6h12v16l9 8c4 4 2 12-6 12H20c-6 0-9-4-9-9V6z" fill="#c8102e" />
      <rect x={14} y={4} width={16} height={7} rx={3} fill="#fff" />
      <path d="M11 29c4 2 9 2 13-1" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}
function Snowman({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <circle cx={24} cy={30} r={13} fill="#fff" />
      <circle cx={24} cy={14} r={9} fill="#fff" />
      <rect x={16} y={6} width={16} height={5} fill="#1a1a1a" />
      <rect x={13} y={10} width={22} height={3.5} fill="#1a1a1a" />
      <circle cx={20} cy={13} r={1.4} fill="#1a1a1a" />
      <circle cx={28} cy={13} r={1.4} fill="#1a1a1a" />
      <path d="M24 15l5 2-5 2z" fill="#e8822a" />
      <circle cx={24} cy={27} r={1.4} fill="#1a1a1a" />
      <circle cx={24} cy={33} r={1.4} fill="#1a1a1a" />
    </svg>
  )
}
function Mistletoe({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M24 44V20" stroke="#6b4a2b" strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={14} cy={18} rx={9} ry={5} fill="#2f8f5b" transform="rotate(-25 14 18)" />
      <ellipse cx={34} cy={18} rx={9} ry={5} fill="#2f8f5b" transform="rotate(25 34 18)" />
      <ellipse cx={24} cy={10} rx={9} ry={5} fill="#3aa76a" />
      <circle cx={21} cy={16} r={2.6} fill="#fff" />
      <circle cx={27} cy={16} r={2.6} fill="#fff" />
      <circle cx={24} cy={20} r={2.6} fill="#fff" />
    </svg>
  )
}
function Bow({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M24 24C18 10 4 10 4 18c0 7 12 8 20 6z" fill="#c8102e" />
      <path d="M24 24c6-14 20-14 20-6 0 7-12 8-20 6z" fill="#e8384a" />
      <circle cx={24} cy={24} r={5} fill="#a50e24" />
    </svg>
  )
}
function Sparkle({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M24 4c1 9 5 13 14 14-9 1-13 5-14 14-1-9-5-13-14-14 9-1 13-5 14-14z" fill="#eaf6ff" />
      <path d="M38 32c.5 4 2 5.5 6 6-4 .5-5.5 2-6 6-.5-4-2-5.5-6-6 4-.5 5.5-2 6-6z" fill="#bfe6fb" />
    </svg>
  )
}
function PineBranch({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M24 44V12" stroke="#5a3d22" strokeWidth={2.5} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <path d={'M24 ' + (16 + i * 8) + 'L8 ' + (10 + i * 8)} stroke="#2f8f5b" strokeWidth={5} strokeLinecap="round" />
          <path d={'M24 ' + (16 + i * 8) + 'L40 ' + (10 + i * 8)} stroke="#2f8f5b" strokeWidth={5} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}
function Moon({ s }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48">
      <path d="M30 6a18 18 0 1 0 12 30c-14 2-24-8-22-22 1-4 5-7 10-8z" fill="#ffd94a" />
    </svg>
  )
}

export const STICKER_DEFS = [
  { name: 'ornament', label: 'كرة زينة', render: Ornament },
  { name: 'candy', label: 'عصا سكاكر', render: CandyCane },
  { name: 'holly', label: 'ورق هولي', render: Holly },
  { name: 'bell', label: 'جرس', render: Bell },
  { name: 'star', label: 'نجمة', render: Star },
  { name: 'gift', label: 'هدية', render: Gift },
  { name: 'stocking', label: 'جورب', render: Stocking },
  { name: 'snowman', label: 'رجل ثلج', render: Snowman },
  { name: 'mistletoe', label: 'هدال', render: Mistletoe },
  { name: 'bow', label: 'شريطة', render: Bow },
  { name: 'sparkle', label: 'بريق', render: Sparkle },
  { name: 'pine', label: 'غصن صنوبر', render: PineBranch },
  { name: 'moon', label: 'هلال', render: Moon },
]

const BY_NAME = Object.fromEntries(STICKER_DEFS.map((d) => [d.name, d]))

// يرسم الستيكر من اسمه؛ وإن كان من بيانات قديمة محفوظة بإيموجي خام، يعرضه كنص كما كان (توافق رجعي آمن)
export function StickerGlyph({ value, size }) {
  const def = BY_NAME[value]
  if (def) {
    const R = def.render
    return <R s={size} />
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{value}</span>
}