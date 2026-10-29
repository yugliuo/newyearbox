// توليد تدرجات فاتحة/غامقة من لون أساسي، لإعطاء إحساس عمق وإضاءة للرسم المسطح
function clamp(v) { return Math.max(0, Math.min(255, v)) }
export function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16)
  const r = clamp(((n >> 16) & 255) + Math.round(255 * percent))
  const g = clamp(((n >> 8) & 255) + Math.round(255 * percent))
  const b = clamp((n & 255) + Math.round(255 * percent))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

export const BOX_PRESETS = [
  { name: 'أحمر وذهبي', box: '#c8102e', ribbon: '#e3b23c' },
  { name: 'أخضر وأحمر', box: '#1f6b40', ribbon: '#d4172f' },
  { name: 'أبيض وذهبي', box: '#f2ece1', ribbon: '#c9a23c' },
  { name: 'عنّابي وأخضر', box: '#5a0f1c', ribbon: '#2f8f5b' },
]