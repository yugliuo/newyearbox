import { useId } from 'react'

/* صندوق هدية مسطّح (2D) من الأعلى، مثل الصورة:
   - مجوّف من الداخل (جدران + قاع)
   - غطاء بفيونكة نجمية وشريط متصالب، يطير للأعلى جهة اليمين عند الفتح
   الخصائص: box = لون الصندوق، ribbon = لون الشريط والفيونكة، open = مفتوح أم مغلق
   يملأ الحاوية الأب بالكامل (width/height: 100%) */

const B = 125 // نصف عرض الصندوق
const RIM = 20 // سماكة الحافة
const O = B - RIM // نصف فتحة الصندوق
const F = 64 // نصف عرض القاع
const L = 137 // نصف عرض الغطاء
const T = 1.3 // سماكة كل طبقة من جانب الغطاء
const N = 13 // عدد الطبقات
const RW = 23 // نصف عرض الشريط

const CLOSED_POS = [300, 300] // مركز الرسمة وهو مغلق
const OPEN_POS = [181, 411] // مركز الصندوق وهو مفتوح (مُزاح ليبقى المشهد متوسطاً)
const LID_OPEN = { x: 198, y: -182, rot: 24, scale: 1.04 }

const PETAL = 'M0 0C-34-22-42-76 0-90C42-76 34-22 0 0Z'
const WALLS = [
  { rot: 0, a: 0.42 }, // الجدار البعيد
  { rot: 90, a: 0.12 },
  { rot: 180, a: 0.03 },
  { rot: 270, a: 0.26 },
]

function Rot({ deg, className, children }) {
  return (
    <g className={className} style={{ transform: `rotate(${deg}deg)` }}>
      {children}
    </g>
  )
}

export default function GiftBox2D({ box = '#f3f0ec', ribbon = '#d8212f', open = false, onClick }) {
  const id = useId().replace(/:/g, '')
  const u = (n) => `${id}-${n}`
  const ref = (n) => `url(#${u(n)})`
  const t = `${id}t`
  const lid = LID_OPEN
  const [px, py] = open ? OPEN_POS : CLOSED_POS
  const lidRot = open ? lid.rot : 0

  return (
    <svg
      viewBox="0 0 600 600"
      width="100%"
      height="100%"
      role="img"
      aria-label={open ? 'صندوق هدية مفتوح' : 'صندوق هدية مغلق'}
      style={{ display: 'block', overflow: 'visible', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <style>{`
        .${t}{transition:transform 800ms cubic-bezier(.3,1.3,.5,1)}
        @media (prefers-reduced-motion:reduce){.${t}{transition:none}}
      `}</style>

      <defs>
        {/* لمعان الشريط: عبر العرض (للشريط العمودي) وعبر الارتفاع (للأفقي) */}
        {[['sv', 1, 0], ['sh', 0, 1]].map(([n, x2, y2]) => (
          <linearGradient key={n} id={u(n)} x1="0" y1="0" x2={x2} y2={y2}>
            <stop offset="0" stopColor="#000" stopOpacity=".2" />
            <stop offset=".3" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".32" />
            <stop offset=".7" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".2" />
          </linearGradient>
        ))}
        {/* إضاءة سطح الغطاء */}
        <linearGradient id={u('top')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        {/* ظل داخل القاع */}
        <radialGradient id={u('floor')} cx=".5" cy=".5" r=".75">
          <stop offset="0" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity=".38" />
        </radialGradient>
        {/* ورقة الفيونكة */}
        <linearGradient id={u('pet')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-90">
          <stop offset="0" stopColor="#000" stopOpacity=".4" />
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity=".32" />
        </linearGradient>
        <radialGradient id={u('knot')} cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".5" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".4" />
        </radialGradient>
        <filter id={u('blur')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={u('drop')} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="5" stdDeviation="3.5" floodColor="#000" floodOpacity=".35" />
        </filter>

        <path id={u('petal')} d={PETAL} />

        {/* جانب الغطاء (سماكته) */}
        <g id={u('side')}>
          <rect x={-L} y={-L} width={L * 2} height={L * 2} rx="10" fill={box} />
          <rect x={-RW} y={-L} width={RW * 2} height={L * 2} fill={ribbon} />
          <rect x={-L} y={-RW} width={L * 2} height={RW * 2} fill={ribbon} />
          <rect x={-L} y={-L} width={L * 2} height={L * 2} rx="10" fill="#000" opacity=".3" />
        </g>
      </defs>

      <g className={t} style={{ transform: `translate(${px}px, ${py}px)` }}>
        {/* ───────── الصندوق (مجوّف) ───────── */}
        <g>
          <rect x={-B + 8} y={-B + 18} width={B * 2} height={B * 2} rx="10" fill="#000" opacity=".4" filter={ref('blur')} />
          {/* سماكة الجدار الخارجي */}
          <rect x={-B} y={-B + 7} width={B * 2} height={B * 2} rx="7" fill={box} />
          <rect x={-B} y={-B + 7} width={B * 2} height={B * 2} rx="7" fill="#000" opacity=".4" />
          {/* الحافة */}
          <rect x={-B} y={-B} width={B * 2} height={B * 2} rx="7" fill={box} />
          <rect x={-B} y={-B} width={B * 2} height={B * 2} rx="7" fill="#fff" opacity=".07" />
          <rect x={-B} y={-B} width={B * 2} height={B * 2} rx="7" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="1.5" />

          {/* القاع */}
          <rect x={-F} y={-F} width={F * 2} height={F * 2} fill={box} />
          <rect x={-RW * (F / O)} y={-F} width={RW * 2 * (F / O)} height={F * 2} fill={ribbon} />
          <rect x={-F} y={-RW * (F / O)} width={F * 2} height={RW * 2 * (F / O)} fill={ribbon} />
          <rect x={-F} y={-F} width={F * 2} height={F * 2} fill={ref('floor')} />

          {/* الجدران الداخلية الأربعة */}
          {WALLS.map(({ rot, a }) => (
            <g key={rot} transform={`rotate(${rot})`}>
              <polygon points={`${-O},${-O} ${O},${-O} ${F},${-F} ${-F},${-F}`} fill={box} />
              <polygon
                points={`${-RW},${-O} ${RW},${-O} ${RW * (F / O)},${-F} ${-RW * (F / O)},${-F}`}
                fill={ribbon}
              />
              <polygon points={`${-O},${-O} ${O},${-O} ${F},${-F} ${-F},${-F}`} fill="#000" opacity={a} />
              <polygon
                points={`${-O},${-O} ${O},${-O} ${F},${-F} ${-F},${-F}`}
                fill="none"
                stroke="#fff"
                strokeOpacity=".16"
                strokeWidth="1"
              />
            </g>
          ))}
          <rect x={-O} y={-O} width={O * 2} height={O * 2} fill="none" stroke="#000" strokeOpacity=".3" strokeWidth="1.5" />

          {/* أطراف الشريط على الحافة */}
          {[0, 90, 180, 270].map((r) => (
            <g key={r} transform={`rotate(${r})`}>
              <rect x={-RW} y={-B - 1} width={RW * 2} height={RIM + 2} rx="2" fill={ribbon} stroke="#000" strokeOpacity=".25" />
              <rect x={-RW} y={-B - 1} width={RW * 2} height={RIM + 2} rx="2" fill={ref('sv')} />
            </g>
          ))}
        </g>

        {/* ───────── الغطاء ───────── */}
        <g
          className={t}
          style={{
            transform: open
              ? `translate(${lid.x}px, ${lid.y}px) scale(${lid.scale})`
              : 'translate(0px, 0px) scale(1)',
          }}
        >
          {/* ظل الغطاء على الأرض */}
          <g className={t} style={{ transform: open ? 'translate(18px, 30px)' : 'translate(0px, 3px)' }}>
            <Rot deg={lidRot} className={t}>
              <rect x={-L} y={-L} width={L * 2} height={L * 2} rx="10" fill="#000" opacity=".4" filter={ref('blur')} />
            </Rot>
          </g>

          {/* سماكة الغطاء: طبقات متراصة نحو الأسفل */}
          {Array.from({ length: N }, (_, k) => N - k).map((i) => (
            <g key={i} style={{ transform: `translateY(${i * T}px)` }}>
              <Rot deg={lidRot} className={t}>
                <use href={`#${u('side')}`} />
              </Rot>
            </g>
          ))}

          {/* سطح الغطاء + الفيونكة */}
          <Rot deg={lidRot} className={t}>
            <rect x={-L} y={-L} width={L * 2} height={L * 2} rx="10" fill={box} />
            <rect x={-L} y={-L} width={L * 2} height={L * 2} rx="10" fill={ref('top')} />
            <rect x={-L + 9} y={-L + 9} width={(L - 9) * 2} height={(L - 9) * 2} rx="6" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="2" />
            <rect x={-L} y={-L} width={L * 2} height={L * 2} rx="10" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="1.5" />

            {/* الشريط المتصالب */}
            <rect x={-RW} y={-L} width={RW * 2} height={L * 2} fill={ribbon} />
            <rect x={-RW} y={-L} width={RW * 2} height={L * 2} fill={ref('sv')} />
            <rect x={-L} y={-RW} width={L * 2} height={RW * 2} fill={ribbon} />
            <rect x={-L} y={-RW} width={L * 2} height={RW * 2} fill={ref('sh')} />

            {/* الفيونكة */}
            <g filter={ref('drop')} transform="scale(.82)">
              {/* الذيلان */}
              {[-26, 26].map((r) => (
                <g key={r} transform={`rotate(${r + 180 * 0})`}>
                  <path d="M-12 0L12 0L17 112L0 94L-17 112Z" fill={ribbon} />
                  <path d="M-12 0L12 0L17 112L0 94L-17 112Z" fill={ref('sv')} />
                </g>
              ))}
              {/* الحلقة الخارجية */}
              {[0, 60, 120, 180, 240, 300].map((r) => (
                <g key={r} transform={`rotate(${r})`}>
                  <use href={`#${u('petal')}`} fill={ribbon} />
                  <use href={`#${u('petal')}`} fill={ref('pet')} />
                  <path d="M0 -6L0 -72" stroke="#000" strokeOpacity=".22" strokeWidth="2" fill="none" />
                </g>
              ))}
              {/* الحلقة الداخلية */}
              {[30, 90, 150, 210, 270, 330].map((r) => (
                <g key={r} transform={`rotate(${r}) scale(.72)`}>
                  <use href={`#${u('petal')}`} fill={ribbon} />
                  <use href={`#${u('petal')}`} fill={ref('pet')} />
                  <path d="M0 -6L0 -72" stroke="#000" strokeOpacity=".22" strokeWidth="2" fill="none" />
                </g>
              ))}
              {/* العقدة */}
              <circle r="16" fill={ribbon} />
              <circle r="16" fill={ref('knot')} stroke="#000" strokeOpacity=".2" />
            </g>
          </Rot>
        </g>
      </g>
    </svg>
  )
}