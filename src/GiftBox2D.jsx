import { shade } from './giftColors.js'

// صندوق هدية مسطّح (2D) مرسوم بالكود، بحالتين: مغلق ومفتوح، بإحساس عمق عبر التظليل لا عبر 3D حقيقية.

function RibbonGradients({ id, color }) {
  const light = shade(color, 0.35)
  const dark = shade(color, -0.25)
  return (
    <defs>
      <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={light} />
        <stop offset="45%" stopColor={color} />
        <stop offset="60%" stopColor={dark} />
        <stop offset="100%" stopColor={color} />
      </linearGradient>
    </defs>
  )
}

function ClosedBox({ box, ribbon }) {
  const top = shade(box, 0.16)
  const side = shade(box, -0.22)
  const front = box
  return (
    <svg viewBox="0 0 360 320" width="100%" height="100%">
      <RibbonGradients id="rib-closed" color={ribbon} />
      <ellipse cx={180} cy={288} rx={130} ry={16} fill="#000" opacity="0.25" />
      {/* السطح العلوي */}
      <polygon points="70,70 230,40 320,95 160,130" fill={top} />
      {/* الوجه الأيمن */}
      <polygon points="320,95 320,220 160,255 160,130" fill={side} />
      {/* الوجه الأمامي */}
      <polygon points="70,70 160,130 160,255 70,195" fill={front} />
      {/* الشريط: عمودي عبر الأوجه الثلاثة */}
      <polygon points="150,55 185,48 185,243 150,250" fill={'url(#rib-closed)'} />
      {/* الشريط: أفقي حول الصندوق */}
      <polygon points="70,150 320,130 320,165 70,185" fill={'url(#rib-closed)'} opacity="0.96" />
      {/* الفيونكة */}
      <g transform="translate(167,48)">
        <ellipse cx={-22} cy={2} rx={26} ry={16} fill={shade(ribbon, -0.1)} transform="rotate(-18 -22 2)" />
        <ellipse cx={22} cy={2} rx={26} ry={16} fill={ribbon} transform="rotate(18 22 2)" />
        <ellipse cx={-22} cy={2} rx={15} ry={9} fill={shade(ribbon, 0.3)} transform="rotate(-18 -22 2)" />
        <ellipse cx={22} cy={2} rx={15} ry={9} fill={shade(ribbon, 0.3)} transform="rotate(18 22 2)" />
        <circle r={10} fill={shade(ribbon, -0.2)} />
      </g>
    </svg>
  )
}

function OpenBox({ box, ribbon }) {
  const wallL = shade(box, -0.3)
  const wallR = shade(box, -0.12)
  const rim = box
  const inside = '#fbf3e2'
  const insideShadow = '#e8dcc0'
  const lidTop = shade(box, 0.1)
  const lidSide = shade(box, -0.2)
  return (
    <svg viewBox="0 0 360 320" width="100%" height="100%">
      <RibbonGradients id="rib-open" color={ribbon} />
      <ellipse cx={170} cy={296} rx={150} ry={14} fill="#000" opacity="0.22" />

      {/* قاعدة الصندوق المفتوحة */}
      <g>
        {/* الجدار الخلفي/الأيمن الخارجي */}
        <polygon points="40,110 190,78 190,230 40,255" fill={wallR} />
        {/* الجدار الأمامي الخارجي */}
        <polygon points="40,110 40,255 10,235 10,95" fill={wallL} />
        {/* الإطار العلوي (حافة الصندوق) */}
        <polygon points="10,95 40,110 190,78 160,64" fill={rim} />
        {/* الداخل الفارغ */}
        <polygon points="30,108 170,80 170,210 30,235" fill={inside} />
        <polygon points="30,108 170,80 160,88 36,114" fill={insideShadow} />
        <polygon points="30,108 36,114 36,228 30,235" fill={insideShadow} />
      </g>

      {/* الغطاء، منفصل ومائل بجانب الصندوق كما في المرجع */}
      <g transform="translate(205,16) rotate(18)">
        <polygon points="0,30 150,0 190,34 40,66" fill={lidTop} />
        <polygon points="40,66 190,34 190,46 40,78" fill={lidSide} />
        {/* الشريط عمودي */}
        <polygon points="78,8 112,1 134,38 100,46" fill={'url(#rib-open)'} />
        {/* الشريط أفقي */}
        <polygon points="8,34 182,2 186,16 12,48" fill={'url(#rib-open)'} opacity="0.96" />
        {/* الفيونكة الكبيرة */}
        <g transform="translate(96,20)">
          <path d="M0 0 C-40 -22 -62 10 -34 22 C-50 30 -30 46 -4 28 Z" fill={shade(ribbon, -0.08)} />
          <path d="M0 0 C40 -22 62 10 34 22 C50 30 30 46 4 28 Z" fill={ribbon} />
          <path d="M-4 24 C-10 44 -2 58 6 50 C10 60 18 54 14 40 Z" fill={shade(ribbon, -0.15)} />
          <path d="M0 0 C-16 -10 -26 2 -14 10 C-22 14 -12 24 0 14 Z" fill={shade(ribbon, 0.3)} opacity="0.85" />
          <path d="M0 0 C16 -10 26 2 14 10 C22 14 12 24 0 14 Z" fill={shade(ribbon, 0.3)} opacity="0.85" />
          <circle r={9} fill={shade(ribbon, -0.2)} />
        </g>
      </g>
    </svg>
  )
}

export default function GiftBox2D({ box = '#c8102e', ribbon = '#e3b23c', open = false }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', inset: 0, transition: 'opacity .45s ease, transform .45s ease', opacity: open ? 0 : 1, transform: open ? 'scale(0.94)' : 'scale(1)', pointerEvents: open ? 'none' : 'auto' }}>
        <ClosedBox box={box} ribbon={ribbon} />
      </div>
      <div style={{ position: 'absolute', inset: 0, transition: 'opacity .45s ease .1s, transform .45s ease .1s', opacity: open ? 1 : 0, transform: open ? 'scale(1)' : 'scale(1.05)', pointerEvents: open ? 'auto' : 'none' }}>
        <OpenBox box={box} ribbon={ribbon} />
      </div>
    </div>
  )
}