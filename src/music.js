// محرك موسيقى خلفية مُولَّد بالكامل بالكود (لا ملفات صوتية، فلا مشاكل حقوق نشر).
// لحن أجراس أصلي قصير يتكرر، فوقه وسادة هارمونية دافئة. مصمم ليُتحكم به لاحقاً
// (كتم/تشغيل، وخفض الصوت وقت مشاهد المقلاة القصصية عبر duck/restore).

let ctx = null
let master = null
let bellGain = null
let padGain = null
let timer = null
let running = false
let duckDepth = 0

const STORAGE_KEY = 'music_muted'

// لحن أصلي بسيط (لا يقتبس أي أغنية معروفة): ثماني نغمات بسلم مفرح
const MOTIF = [
  { n: 659.25, d: 0.26 }, // E5
  { n: 659.25, d: 0.26 }, // E5
  { n: 783.99, d: 0.26 }, // G5
  { n: 659.25, d: 0.26 }, // E5
  { n: 587.33, d: 0.26 }, // D5
  { n: 523.25, d: 0.26 }, // C5
  { n: 587.33, d: 0.26 }, // D5
  { n: 659.25, d: 0.52 }, // E5 (أطول لإغلاق العبارة)
]
const LOOP_GAP = 1.1 // صمت قصير بين تكرار العبارة
const PAD_NOTES = [196.0, 246.94, 293.66] // G3, B3, D4: وسادة هادئة

function loadMuted() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === '1' // غير مكتومة افتراضياً؛ ستبدأ فعلياً عند أول لمسة بسبب سياسات المتصفح
  } catch {
    return true
  }
}
function saveMuted(v) {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function ensureCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(ctx.destination)
  bellGain = ctx.createGain()
  bellGain.gain.value = 0.55
  bellGain.connect(master)
  padGain = ctx.createGain()
  padGain.gain.value = 0.16
  padGain.connect(master)
  return ctx
}

function playBell(freq, t) {
  const o1 = ctx.createOscillator()
  const o2 = ctx.createOscillator()
  const g = ctx.createGain()
  o1.type = 'sine'
  o2.type = 'triangle'
  o1.frequency.value = freq
  o2.frequency.value = freq * 2.01 // تنافر خفيف يعطي طابع الجرس المعدني
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.9, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.9)
  o1.connect(g)
  o2.connect(g)
  g.connect(bellGain)
  o1.start(t)
  o2.start(t)
  o1.stop(t + 1)
  o2.stop(t + 1)
}

function playPadChord(t, dur) {
  PAD_NOTES.forEach((f, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.5, t + 1.2 + i * 0.15)
    g.gain.linearRampToValueAtTime(0, t + dur)
    o.connect(g)
    g.connect(padGain)
    o.start(t)
    o.stop(t + dur + 0.1)
  })
}

function scheduleLoop() {
  if (!running || !ctx) return
  const start = ctx.currentTime + 0.05
  let cursor = start
  MOTIF.forEach(({ n, d }) => {
    playBell(n, cursor)
    cursor += d
  })
  const total = cursor - start + LOOP_GAP
  playPadChord(start, total)
  timer = setTimeout(scheduleLoop, total * 1000)
}

export function isMuted() {
  return loadMuted()
}

export function startMusic() {
  const c = ensureCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume()
  if (running) return
  running = true
  scheduleLoop()
}

export function stopMusic() {
  running = false
  if (timer) clearTimeout(timer)
  timer = null
}

export function toggleMute() {
  const next = !loadMuted()
  saveMuted(next)
  if (next) stopMusic()
  else startMusic()
  return next
}

// يستخدمها لاحقاً مشهد المقلاة القصصي ليخفّض الموسيقى دون إيقافها بالكامل
export function duckMusic(depth = 0.06) {
  if (!ctx || !master) return
  duckDepth = depth
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.linearRampToValueAtTime(depth, ctx.currentTime + 0.6)
}
export function restoreMusic() {
  if (!ctx || !master) return
  duckDepth = 0
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.6)
}
export function isDucked() {
  return duckDepth > 0
}

// تبدأ الموسيقى تلقائياً عند أول لمسة/ضغطة من المستخدم في أي مكان بالموقع (متطلبات المتصفحات)
let armed = false
export function armAutoStart() {
  if (armed) return
  armed = true
  const go = () => {
    if (!loadMuted()) startMusic()
    window.removeEventListener('pointerdown', go)
    window.removeEventListener('keydown', go)
  }
  window.addEventListener('pointerdown', go, { once: true })
  window.addEventListener('keydown', go, { once: true })
}