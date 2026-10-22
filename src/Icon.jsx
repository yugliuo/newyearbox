// أيقونات واجهة مرسومة بالكود (SVG)، بديل عن إيموجي لوحة المفاتيح للعناصر الوظيفية
// مثل الترس والقفل والقلم، لا للزخارف التعبيرية.

const PATHS = {
  gear: (
    <path
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm8.4-3.2c0 .5 0 1-.1 1.5l2 1.5-2 3.4-2.3-.9c-.8.6-1.7 1.1-2.6 1.4L15 22H9l-.4-2.1a8 8 0 0 1-2.6-1.4l-2.3.9-2-3.4 2-1.5a7 7 0 0 1 0-3l-2-1.5 2-3.4 2.3.9c.8-.6 1.7-1.1 2.6-1.4L9 2h6l.4 2.1c.9.3 1.8.8 2.6 1.4l2.3-.9 2 3.4-2 1.5c.1.5.1 1 .1 1.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="16" r="1.6" fill="currentColor" />
    </>
  ),
  pencil: (
    <path
      d="M4 20l1-4.2L15.3 5.5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20Zm10.5-13 2.5 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  door: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="14.5" cy="12" r="1" fill="currentColor" />
      <path d="M18 21h3M3 21h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3v1.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 16c-.6-5 1-9 6-9s6.6 4 6 9c1.4.5 2 1.3 2 2H4c0-.7.6-1.5 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 14v3M9 21h6M9.5 21c0-2 1-3 2.5-3s2.5 1 2.5 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 6.5l11 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
}

export default function Icon({ name, size = 18, color = 'currentColor', style }) {
  const p = PATHS[name]
  if (!p) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ color, display: 'inline-block', verticalAlign: 'middle', ...style }}>
      {p}
    </svg>
  )
}