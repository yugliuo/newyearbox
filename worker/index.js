const enc = new TextEncoder()
// رأس السنة 2027 بتوقيت بغداد (UTC+3)، بعده يُغلق الحفظ والانضمام
const UNLOCK_AT = Date.UTC(2026, 11, 31, 21, 0, 0)
const GUESS_MS = 10000 // مدة التخمين لكل أمنية
const REVEAL_MS = 6000 // مدة عرض الاسم الحقيقي قبل الانتقال للتالي
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
// المواقع المسموح لها باستعمال السيرفر
const ORIGINS = ['https://yugliuo.github.io', 'http://localhost:5173', 'http://localhost:4173']
const FAIL_LIMIT = 5 // محاولات خاطئة لكل اسم قبل القفل المؤقت
const IP_FAIL_LIMIT = 20 // محاولات خاطئة لكل عنوان قبل القفل المؤقت
const REGISTER_LIMIT = 30 // حسابات جديدة لكل عنوان في الساعة
const WINDOW_MS = 15 * 60 * 1000
const LOG_KEEP_MS = 60 * 24 * 60 * 60 * 1000

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 10000 },
    key,
    256
  )
  return hex(bits)
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(value)))
}
async function makeToken(username, sid, secret) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 60
  const body = encodeURIComponent(username) + '|' + sid + '|' + exp
  return body + '|' + (await sign('token:' + body, secret))
}
async function readToken(request, secret) {
  const parts = (request.headers.get('Authorization') || '').replace('Bearer ', '').split('|')
  if (parts.length !== 4) return null
  const body = parts[0] + '|' + parts[1] + '|' + parts[2]
  if ((await sign('token:' + body, secret)) !== parts[3]) return null
  if (Number(parts[2]) < Date.now()) return null
  return { username: decodeURIComponent(parts[0]), sid: parts[1] }
}
async function isAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) return false
  const parts = (request.headers.get('Authorization') || '').replace('Bearer ', '').split('|')
  if (parts.length !== 3 || parts[0] !== 'admin') return false
  if (Number(parts[1]) < Date.now()) return false
  return (await sign('admin:' + parts[1], env.APP_SECRET)) === parts[2]
}
// معرّف الأمنية مشتق من الغرفة والاسم بدالة لا رجعة فيها، فلا يظهر اسم في جدول الأمنيات
async function wishId(env, room, username) {
  return 'w_' + (await sign('wish:' + room + ':' + username.toLowerCase(), env.APP_SECRET)).slice(0, 32)
}

// يبني قائمة الأعضاء الذين كتبوا أمنية فعلاً (نكشف أصحابها، لا من لم يكتب)
async function wishedMembers(env, room) {
  const members = (await env.DB.prepare('SELECT username FROM members WHERE room = ? ORDER BY joined_at').bind(room).all()).results.map((x) => x.username)
  const out = []
  for (const u of members) {
    const w = await env.DB.prepare('SELECT 1 AS x FROM wishes WHERE id = ?').bind(await wishId(env, room, u)).first()
    if (w) out.push(u)
  }
  return out
}
function shuffle(arr, seedStr) {
  let seed = 0
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// آلة الحالة: تُقدّم اللعبة تلقائياً كلما حان وقتها، بصرف النظر عمّن يسأل
async function tickGame(env, room) {
  const g = await env.DB.prepare('SELECT * FROM games WHERE room = ?').bind(room).first()
  if (!g || g.phase === 'idle' || g.phase === 'final') return g
  const now = Date.now()
  if (g.phase === 'show' && now >= g.deadline) {
    const order = JSON.parse(g.order_json)
    const owner = order[g.idx]
    const rows = (await env.DB.prepare('SELECT guesser, guess FROM guesses WHERE room = ? AND round = ?').bind(room, g.idx).all()).results
    for (const row of rows) {
      if (row.guess === owner) {
        await env.DB.prepare(
          'INSERT INTO scores (room, username, points) VALUES (?, ?, 1) ON CONFLICT(room, username) DO UPDATE SET points = points + 1'
        )
          .bind(room, row.guesser)
          .run()
      }
    }
    await env.DB.prepare("UPDATE games SET phase = 'revealed', deadline = ? WHERE room = ?").bind(now + REVEAL_MS, room).run()
    return tickGame(env, room)
  }
  if (g.phase === 'revealed' && now >= g.deadline) {
    const order = JSON.parse(g.order_json)
    const nextIdx = g.idx + 1
    if (nextIdx >= order.length) {
      await env.DB.prepare("UPDATE games SET phase = 'final' WHERE room = ?").bind(room).run()
    } else {
      await env.DB.prepare("UPDATE games SET phase = 'show', idx = ?, deadline = ? WHERE room = ?").bind(nextIdx, now + GUESS_MS, room).run()
    }
    return tickGame(env, room)
  }
  return g
}
async function gameStateFor(env, room, username) {
  const g = await tickGame(env, room)
  if (!g || g.phase === 'idle') return { phase: 'idle' }
  const order = JSON.parse(g.order_json)
  if (g.phase === 'final') {
    const scores = (await env.DB.prepare('SELECT username, points FROM scores WHERE room = ? ORDER BY points DESC, username ASC').bind(room).all()).results
    return { phase: 'final', total: order.length, scores }
  }
  const owner = order[g.idx]
  const row = await env.DB.prepare('SELECT data FROM wishes WHERE id = ?').bind(await wishId(env, room, owner)).first()
  const mine = await env.DB.prepare('SELECT guess FROM guesses WHERE room = ? AND round = ? AND guesser = ?').bind(room, g.idx, username).first()
  const guessCount = (await env.DB.prepare('SELECT COUNT(*) AS n FROM guesses WHERE room = ? AND round = ?').bind(room, g.idx).first()).n
  return {
    phase: g.phase,
    round: g.idx + 1,
    total: order.length,
    deadline: g.deadline,
    cipher: row ? row.data : null,
    myGuess: mine ? mine.guess : null,
    guessCount,
    owner: g.phase === 'revealed' ? owner : null,
  }
}

function newCode() {
  const a = crypto.getRandomValues(new Uint8Array(6))
  return [...a].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}
async function roomOwner(env, code) {
  const r = await env.DB.prepare('SELECT created_by FROM rooms WHERE code = ?').bind(code).first()
  return r ? r.created_by : null
}
async function kickFromRoom(env, code, username) {
  await env.DB.prepare('DELETE FROM wishes WHERE id = ?').bind(await wishId(env, code, username)).run()
  await env.DB.prepare('DELETE FROM members WHERE room = ? AND username = ?').bind(code, username).run()
  await env.DB.prepare('INSERT OR IGNORE INTO bans (room, username) VALUES (?, ?)').bind(code, username).run()
}
async function deleteRoomFully(DB, code) {
  await DB.prepare('DELETE FROM wishes WHERE room = ?').bind(code).run()
  await DB.prepare('DELETE FROM members WHERE room = ?').bind(code).run()
  await DB.prepare('DELETE FROM bans WHERE room = ?').bind(code).run()
  await DB.prepare('DELETE FROM games WHERE room = ?').bind(code).run()
  await DB.prepare('DELETE FROM guesses WHERE room = ?').bind(code).run()
  await DB.prepare('DELETE FROM scores WHERE room = ?').bind(code).run()
  await DB.prepare('DELETE FROM rooms WHERE code = ?').bind(code).run()
}

async function findUser(env, username) {
  return env.DB.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').bind(username).first()
}
function deviceOf(ua) {
  const u = ua || ''
  let os = 'غير معروف'
  if (/iPhone|iPad|iPod/.test(u)) os = 'iOS'
  else if (/Android/.test(u)) os = 'Android'
  else if (/Windows/.test(u)) os = 'Windows'
  else if (/Mac OS X|Macintosh/.test(u)) os = 'Mac'
  else if (/Linux/.test(u)) os = 'Linux'
  let br = 'متصفح'
  if (/SamsungBrowser/.test(u)) br = 'Samsung'
  else if (/Edg\//.test(u)) br = 'Edge'
  else if (/OPR\/|Opera/.test(u)) br = 'Opera'
  else if (/Firefox|FxiOS/.test(u)) br = 'Firefox'
  else if (/Chrome|CriOS/.test(u)) br = 'Chrome'
  else if (/Safari/.test(u)) br = 'Safari'
  return os + ' · ' + br
}
function clientInfo(request) {
  return {
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    country: (request.cf && request.cf.country) || '',
    device: deviceOf(request.headers.get('User-Agent')),
  }
}
async function logEvent(env, request, username, event, ok) {
  const c = clientInfo(request)
  const now = Date.now()
  await env.DB.prepare('INSERT INTO logins (ts, username, event, ok, ip, country, device) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(now, String(username || '').slice(0, 40), event, ok ? 1 : 0, c.ip, c.country, c.device)
    .run()
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM logins WHERE ts < ?').bind(now - LOG_KEEP_MS).run()
}
// قفل مؤقت بعد محاولات خاطئة كثيرة (للاسم، وللعنوان)
async function tooManyFailures(env, request, username) {
  const since = Date.now() - WINDOW_MS
  const key = String(username || '').toLowerCase().slice(0, 40)
  const last = await env.DB.prepare("SELECT COALESCE(MAX(ts), 0) AS t FROM logins WHERE lower(username) = ? AND ok = 1 AND event IN ('login', 'admin')").bind(key).first()
  const from = Math.max(since, last ? last.t : 0)
  const u = await env.DB.prepare("SELECT COUNT(*) AS n FROM logins WHERE lower(username) = ? AND ok = 0 AND event IN ('login', 'admin') AND ts > ?").bind(key, from).first()
  if (u.n >= FAIL_LIMIT) return true
  const ip = clientInfo(request).ip
  if (ip !== 'unknown') {
    const i = await env.DB.prepare("SELECT COUNT(*) AS n FROM logins WHERE ip = ? AND ok = 0 AND event IN ('login', 'admin') AND ts > ?").bind(ip, since).first()
    if (i.n >= IP_FAIL_LIMIT) return true
  }
  return false
}
async function createSession(env, request, username) {
  const sid = hex(crypto.getRandomValues(new Uint8Array(12)))
  const c = clientInfo(request)
  const now = Date.now()
  await env.DB.prepare('INSERT INTO sessions (id, username, device, ip, country, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(sid, username, c.device, c.ip, c.country, now, now)
    .run()
  return sid
}
async function authUser(request, env) {
  const t = await readToken(request, env.APP_SECRET)
  if (!t) return null
  const s = await env.DB.prepare('SELECT revoked, last_seen FROM sessions WHERE id = ? AND username = ?').bind(t.sid, t.username).first()
  if (!s || s.revoked) return null
  const user = await findUser(env, t.username)
  if (!user || user.disabled) return null
  const now = Date.now()
  if (now - (s.last_seen || 0) > 60000) await env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(now, t.sid).run()
  return user
}
async function body(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}
async function setPassword(env, username, password) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const passHash = await hashPassword(password, salt)
  await env.DB.prepare('UPDATE users SET pass_hash = ?, salt = ?, reset_requested = 0 WHERE username = ?')
    .bind(passHash, salt, username)
    .run()
  await env.DB.prepare('UPDATE sessions SET revoked = 1 WHERE username = ?').bind(username).run()
}

async function adminRoutes(path, request, env) {
  const DB = env.DB
  if (path === '/api/admin/login') {
    const b = await body(request)
    if (!env.ADMIN_PASSWORD) return json({ error: 'لم تُضبط كلمة سر المطوّر بعد' }, 500)
    if (await tooManyFailures(env, request, '[admin]')) {
      await logEvent(env, request, '[admin]', 'locked', false)
      return json({ error: 'محاولات خاطئة كثيرة، حاول بعد 15 دقيقة' }, 429)
    }
    const ok = (await sign('pw', String(b.password || ''))) === (await sign('pw', env.ADMIN_PASSWORD))
    await logEvent(env, request, '[admin]', 'admin', ok)
    if (!ok) return json({ error: 'كلمة السر خطأ' }, 401)
    const exp = Date.now() + 1000 * 60 * 60 * 12
    return json({ token: 'admin|' + exp + '|' + (await sign('admin:' + exp, env.APP_SECRET)) })
  }
  if (!(await isAdmin(request, env))) return json({ error: 'غير مصرّح' }, 401)

  if (path === '/api/admin/overview') {
    const users = (
      await DB.prepare(
        "SELECT u.username, u.avatar IS NOT NULL AS has_avatar, u.reset_requested, u.disabled, u.created_at, (SELECT COUNT(*) FROM members m WHERE m.username = u.username) AS rooms, (SELECT MAX(l.ts) FROM logins l WHERE lower(l.username) = lower(u.username) AND l.ok = 1 AND l.event IN ('login', 'register')) AS last_login, (SELECT COUNT(*) FROM sessions s WHERE s.username = u.username AND s.revoked = 0) AS devices FROM users u ORDER BY u.created_at DESC"
      ).all()
    ).results
    const rooms = (await DB.prepare('SELECT code, name, created_by, created_at FROM rooms ORDER BY created_at DESC').all()).results
    for (const r of rooms) {
      const members = (await DB.prepare('SELECT username FROM members WHERE room = ? ORDER BY joined_at').bind(r.code).all()).results
      const ids = new Set((await DB.prepare('SELECT id FROM wishes WHERE room = ?').bind(r.code).all()).results.map((x) => x.id))
      r.members = []
      for (const m of members) r.members.push({ username: m.username, hasWish: ids.has(await wishId(env, r.code, m.username)) })
      r.wishes = ids.size
      r.banned = (await DB.prepare('SELECT username FROM bans WHERE room = ?').bind(r.code).all()).results.map((x) => x.username)
    }
    return json({ users, rooms })
  }

  if (path === '/api/admin/room') {
    const b = await body(request)
    const name = String(b.name || '').trim()
    if (name.length < 1 || name.length > 40) return json({ error: 'اسم الغرفة بين 1 و40 حرفاً' }, 400)
    const code = newCode()
    await DB.prepare('INSERT INTO rooms (code, name, created_by, created_at) VALUES (?, ?, ?, ?)').bind(code, name, '[المطوّر]', Date.now()).run()
    return json({ code, name })
  }

  if (path === '/api/admin/security') {
    const now = Date.now()
    const events = (await DB.prepare('SELECT ts, username, event, ok, ip, country, device FROM logins ORDER BY ts DESC, id DESC LIMIT 150').all()).results
    const sessions = (
      await DB.prepare('SELECT id, username, device, ip, country, created_at, last_seen FROM sessions WHERE revoked = 0 ORDER BY last_seen DESC LIMIT 100').all()
    ).results
    const day = now - 24 * 60 * 60 * 1000
    const failed = (await DB.prepare("SELECT COUNT(*) AS n FROM logins WHERE ok = 0 AND event IN ('login', 'admin') AND ts > ?").bind(day).first()).n
    const locked = (await DB.prepare("SELECT COUNT(*) AS n FROM logins WHERE event = 'locked' AND ts > ?").bind(day).first()).n
    return json({ events, sessions, failed, locked })
  }

  if (path === '/api/admin/revoke') {
    const b = await body(request)
    if (b.sid) await DB.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').bind(String(b.sid)).run()
    else if (b.username) await DB.prepare('UPDATE sessions SET revoked = 1 WHERE username = ?').bind(String(b.username)).run()
    return json({ ok: true })
  }

  if (path === '/api/admin/disable') {
    const b = await body(request)
    const user = await findUser(env, String(b.username || ''))
    if (!user) return json({ error: 'المستخدم غير موجود' }, 404)
    await DB.prepare('UPDATE users SET disabled = ? WHERE username = ?').bind(b.disabled ? 1 : 0, user.username).run()
    if (b.disabled) await DB.prepare('UPDATE sessions SET revoked = 1 WHERE username = ?').bind(user.username).run()
    return json({ ok: true })
  }

  if (path === '/api/admin/reset') {
    const b = await body(request)
    const user = await findUser(env, String(b.username || ''))
    const password = String(b.password || '')
    if (!user) return json({ error: 'المستخدم غير موجود' }, 404)
    if (password.length < 6) return json({ error: 'كلمة السر قصيرة (6 أحرف على الأقل)' }, 400)
    await setPassword(env, user.username, password)
    return json({ ok: true })
  }

  if (path === '/api/admin/kick') {
    const b = await body(request)
    const code = String(b.room || '').toUpperCase()
    const user = await findUser(env, String(b.username || ''))
    if (!user) return json({ error: 'المستخدم غير موجود' }, 404)
    await kickFromRoom(env, code, user.username)
    return json({ ok: true })
  }

  if (path === '/api/admin/unban') {
    const b = await body(request)
    await DB.prepare('DELETE FROM bans WHERE room = ? AND username = ?').bind(String(b.room || '').toUpperCase(), String(b.username || '')).run()
    return json({ ok: true })
  }

  if (path === '/api/admin/game') {
    const b = await body(request)
    const code = String(b.room || '').toUpperCase()
    const action = String(b.action || '')
    if (action === 'start') {
      const existing = await DB.prepare('SELECT phase FROM games WHERE room = ?').bind(code).first()
      if (existing && existing.phase !== 'idle') return json({ error: 'اللعبة بدأت بالفعل' }, 400)
      const members = await wishedMembers(env, code)
      if (members.length === 0) return json({ error: 'لا توجد أمنيات في هذه الغرفة بعد' }, 400)
      const order = shuffle(members, code)
      const now = Date.now()
      await DB.prepare(
        "INSERT INTO games (room, order_json, idx, phase, deadline, started_at) VALUES (?, ?, 0, 'show', ?, ?) ON CONFLICT(room) DO UPDATE SET order_json = excluded.order_json, idx = 0, phase = 'show', deadline = excluded.deadline, started_at = excluded.started_at"
      )
        .bind(code, JSON.stringify(order), now + GUESS_MS, now)
        .run()
      return json({ ok: true })
    }
    if (action === 'skip') {
      await DB.prepare('UPDATE games SET deadline = ? WHERE room = ?').bind(Date.now(), code).run()
      return json({ ok: true })
    }
    if (action === 'reset') {
      await DB.prepare("UPDATE games SET phase = 'idle', idx = -1 WHERE room = ?").bind(code).run()
      await DB.prepare('DELETE FROM guesses WHERE room = ?').bind(code).run()
      await DB.prepare('DELETE FROM scores WHERE room = ?').bind(code).run()
      return json({ ok: true })
    }
    return json({ error: 'إجراء غير معروف' }, 400)
  }

  if (path === '/api/admin/delete-room') {
    const b = await body(request)
    await deleteRoomFully(DB, String(b.code || ''))
    return json({ ok: true })
  }

  if (path === '/api/admin/delete-user') {
    const b = await body(request)
    const user = await findUser(env, String(b.username || ''))
    if (!user) return json({ error: 'المستخدم غير موجود' }, 404)
    const rows = (await DB.prepare('SELECT room FROM members WHERE username = ?').bind(user.username).all()).results
    for (const r of rows) await DB.prepare('DELETE FROM wishes WHERE id = ?').bind(await wishId(env, r.room, user.username)).run()
    await DB.prepare('DELETE FROM members WHERE username = ?').bind(user.username).run()
    await DB.prepare('DELETE FROM vaults WHERE username = ?').bind(user.username).run()
    if (env.VIDEOS) {
      try {
        await env.VIDEOS.delete('video:' + user.username)
      } catch {
        /* لا بأس إن لم يوجد فيديو أصلاً */
      }
    }
    await DB.prepare('DELETE FROM sessions WHERE username = ?').bind(user.username).run()
    await DB.prepare('DELETE FROM users WHERE username = ?').bind(user.username).run()
    return json({ ok: true })
  }
  return json({ error: 'غير موجود' }, 404)
}

async function handle(request, env) {
    const path = new URL(request.url).pathname

    try {
      if (!env.APP_SECRET) return json({ error: 'السيرفر غير مكتمل الإعداد' }, 500)
      if (path === '/api/ping') return json({ ok: true })
      if (path.startsWith('/api/admin/')) return await adminRoutes(path, request, env)

      if (path === '/api/register' && request.method === 'POST') {
        const b = await body(request)
        const username = String(b.username || '').trim()
        const password = String(b.password || '')
        const avatar = b.avatar ? String(b.avatar) : null
        if (username.length < 2 || username.length > 20) return json({ error: 'الاسم يجب أن يكون بين 2 و20 حرفاً' }, 400)
        if (password.length < 6) return json({ error: 'كلمة السر قصيرة (6 أحرف على الأقل)' }, 400)
        if (avatar && avatar.length > 60000) return json({ error: 'الصورة كبيرة' }, 400)
        const ipNow = clientInfo(request).ip
        if (ipNow !== 'unknown') {
          const reg = await env.DB.prepare("SELECT COUNT(*) AS n FROM logins WHERE event = 'register' AND ip = ? AND ts > ?").bind(ipNow, Date.now() - 3600000).first()
          if (reg.n >= REGISTER_LIMIT) return json({ error: 'عدد كبير من الحسابات الجديدة، حاول لاحقاً' }, 429)
        }
        if (await findUser(env, username)) return json({ error: 'هذا الاسم مستخدم، اختر اسماً آخر' }, 409)
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
        const passHash = await hashPassword(password, salt)
        await env.DB.prepare('INSERT INTO users (username, pass_hash, salt, avatar, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(username, passHash, salt, avatar, Date.now())
          .run()
        const sid = await createSession(env, request, username)
        await logEvent(env, request, username, 'register', true)
        return json({ token: await makeToken(username, sid, env.APP_SECRET), username, avatar })
      }

      if (path === '/api/login' && request.method === 'POST') {
        const b = await body(request)
        const name = String(b.username || '').trim()
        if (await tooManyFailures(env, request, name)) {
          await logEvent(env, request, name, 'locked', false)
          return json({ error: 'محاولات خاطئة كثيرة، حاول بعد 15 دقيقة' }, 429)
        }
        const user = await findUser(env, name)
        const h = await hashPassword(String(b.password || ''), user ? user.salt : 'no-such-user')
        if (!user || h !== user.pass_hash) {
          await logEvent(env, request, name, 'login', false)
          return json({ error: 'الاسم أو كلمة السر خطأ' }, 401)
        }
        if (user.disabled) {
          await logEvent(env, request, user.username, 'login', false)
          return json({ error: 'الحساب موقوف، تواصل مع المنظّم' }, 403)
        }
        const sid = await createSession(env, request, user.username)
        await logEvent(env, request, user.username, 'login', true)
        return json({ token: await makeToken(user.username, sid, env.APP_SECRET), username: user.username, avatar: user.avatar })
      }

      if (path === '/api/forgot' && request.method === 'POST') {
        const b = await body(request)
        const user = await findUser(env, String(b.username || '').trim())
        if (user) await env.DB.prepare('UPDATE users SET reset_requested = 1 WHERE username = ?').bind(user.username).run()
        await logEvent(env, request, user ? user.username : String(b.username || '').trim(), 'forgot', !!user)
        return json({ ok: true })
      }

      const user = await authUser(request, env)
      if (!user) return json({ error: 'سجّل الدخول من جديد' }, 401)

      if (path === '/api/me') return json({ username: user.username, avatar: user.avatar })

      if (path === '/api/rooms') {
        const rows = (
          await env.DB.prepare(
            'SELECT r.code, r.name, r.created_by, (SELECT COUNT(*) FROM members WHERE room = r.code) AS members FROM members m JOIN rooms r ON r.code = m.room WHERE m.username = ? ORDER BY m.joined_at'
          )
            .bind(user.username)
            .all()
        ).results
        for (const r of rows) {
          const w = await env.DB.prepare('SELECT 1 AS x FROM wishes WHERE id = ?').bind(await wishId(env, r.code, user.username)).first()
          r.hasWish = !!w
          r.isOwner = r.created_by === user.username
        }
        return json({ rooms: rows })
      }

      if (path === '/api/video/start' && request.method === 'POST') {
        if (!env.VIDEOS) return json({ error: 'تخزين الفيديو غير مفعّل على السيرفر' }, 500)
        if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد الرفع ممكناً' }, 403)
        const b = await body(request)
        const size = Number(b.size) || 0
        if (size <= 0 || size > 524288000) return json({ error: 'حجم الفيديو يجب ألا يتجاوز 500 ميغابايت' }, 400)
        const key = 'video:' + user.username
        const mpu = await env.VIDEOS.createMultipartUpload(key)
        return json({ uploadId: mpu.uploadId, key })
      }

      if (path === '/api/video/part' && request.method === 'POST') {
        if (!env.VIDEOS) return json({ error: 'تخزين الفيديو غير مفعّل على السيرفر' }, 500)
        const url = new URL(request.url)
        const key = url.searchParams.get('key') || ''
        const uploadId = url.searchParams.get('uploadId') || ''
        const partNumber = Number(url.searchParams.get('part'))
        if (key !== 'video:' + user.username) return json({ error: 'غير مصرّح' }, 403)
        if (!uploadId || !partNumber) return json({ error: 'طلب غير صحيح' }, 400)
        const mpu = env.VIDEOS.resumeMultipartUpload(key, uploadId)
        const part = await mpu.uploadPart(partNumber, request.body)
        return json({ etag: part.etag })
      }

      if (path === '/api/video/complete' && request.method === 'POST') {
        if (!env.VIDEOS) return json({ error: 'تخزين الفيديو غير مفعّل على السيرفر' }, 500)
        const b = await body(request)
        const key = String(b.key || '')
        if (key !== 'video:' + user.username) return json({ error: 'غير مصرّح' }, 403)
        const mpu = env.VIDEOS.resumeMultipartUpload(key, String(b.uploadId || ''))
        await mpu.complete(b.parts || [])
        await env.DB.prepare('INSERT INTO vaults (username, video_size, video_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET video_size = excluded.video_size, video_at = excluded.video_at')
          .bind(user.username, Number(b.size) || 0, Date.now())
          .run()
        return json({ ok: true })
      }

      if (path === '/api/video/abort' && request.method === 'POST') {
        if (!env.VIDEOS) return json({ error: 'تخزين الفيديو غير مفعّل على السيرفر' }, 500)
        const b = await body(request)
        const key = String(b.key || '')
        if (key !== 'video:' + user.username) return json({ error: 'غير مصرّح' }, 403)
        try {
          const mpu = env.VIDEOS.resumeMultipartUpload(key, String(b.uploadId || ''))
          await mpu.abort()
        } catch {
          /* قد تكون انتهت أو أُكملت بالفعل، لا بأس */
        }
        return json({ ok: true })
      }

      if (path === '/api/video/status') {
        const row = await env.DB.prepare('SELECT video_size, video_at FROM vaults WHERE username = ?').bind(user.username).first()
        const has = !!(row && row.video_size)
        return json({ has, size: has ? row.video_size : 0, updatedAt: has ? row.video_at : 0 })
      }

      if (path === '/api/video' && request.method === 'GET') {
        if (!env.VIDEOS) return json({ error: 'تخزين الفيديو غير مفعّل على السيرفر' }, 500)
        const key = 'video:' + user.username
        const obj = await env.VIDEOS.get(key)
        if (!obj) return json({ error: 'لا يوجد فيديو محفوظ' }, 404)
        return new Response(obj.body, { headers: { 'Content-Type': 'application/octet-stream' } })
      }

      if (path === '/api/video' && request.method === 'DELETE') {
        if (!env.VIDEOS) return json({ error: 'تخزين الفيديو غير مفعّل على السيرفر' }, 500)
        await env.VIDEOS.delete('video:' + user.username)
        await env.DB.prepare('UPDATE vaults SET video_size = 0, video_at = 0 WHERE username = ?').bind(user.username).run()
        return json({ ok: true })
      }

      if (path === '/api/vault') {
        if (request.method === 'POST') {
          if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد الحفظ ممكناً' }, 403)
          const b = await body(request)
          const data = String(b.data || '')
          if (!data.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')) return json({ error: 'البيانات غير مقفلة' }, 400)
          if (data.length > 200000) return json({ error: 'الرسالة كبيرة جداً' }, 400)
          await env.DB.prepare(
            'INSERT INTO vaults (username, message, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET message = excluded.message, updated_at = excluded.updated_at'
          )
            .bind(user.username, data, Date.now())
            .run()
          const draft = b.draft ? String(b.draft) : null
          if (draft && draft.length <= 400000) {
            await env.DB.prepare('UPDATE vaults SET draft = ?, draft_at = ? WHERE username = ?')
              .bind(draft, Number(b.draftAt) || Date.now(), user.username)
              .run()
          }
          return json({ ok: true })
        }
        const v = await env.DB.prepare('SELECT message, updated_at, draft, draft_at FROM vaults WHERE username = ?').bind(user.username).first()
        return json({ data: v ? v.message : null, updated_at: v ? v.updated_at : null, draft: v ? v.draft : null, draftAt: v ? v.draft_at : 0 })
      }

      if (path === '/api/room-state') {
        const code = (new URL(request.url).searchParams.get('code') || '').toUpperCase()
        const mem = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(code, user.username).first()
        if (!mem) return json({ error: 'أنت لست عضواً في هذه الغرفة' }, 403)
        const now = Date.now()
        await env.DB.prepare('UPDATE members SET last_seen = ? WHERE room = ? AND username = ?').bind(now, code, user.username).run()
        const room = await env.DB.prepare('SELECT code, name, created_by FROM rooms WHERE code = ?').bind(code).first()
        if (room) room.isOwner = room.created_by === user.username
        const rows = (
          await env.DB.prepare(
            "SELECT m.username, m.state, m.last_seen, CASE WHEN u.avatar LIKE 'data:%' THEN NULL ELSE u.avatar END AS emoji, (u.avatar LIKE 'data:%') AS has_img FROM members m JOIN users u ON u.username = m.username WHERE m.room = ? ORDER BY m.joined_at"
          )
            .bind(code)
            .all()
        ).results
        const members = rows.map((r) => ({
          username: r.username,
          state: r.state || 'idle',
          online: now - (r.last_seen || 0) < 12000,
          emoji: r.emoji || null,
          hasImg: !!r.has_img,
        }))
        return json({ room, now, unlockAt: UNLOCK_AT, me: user.username, members })
      }

      if (path === '/api/room-avatars') {
        const code = (new URL(request.url).searchParams.get('code') || '').toUpperCase()
        const mem = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(code, user.username).first()
        if (!mem) return json({ error: 'أنت لست عضواً في هذه الغرفة' }, 403)
        const rows = (
          await env.DB.prepare("SELECT u.username, u.avatar FROM members m JOIN users u ON u.username = m.username WHERE m.room = ? AND u.avatar LIKE 'data:%'")
            .bind(code)
            .all()
        ).results
        const avatars = {}
        for (const r of rows) avatars[r.username] = r.avatar
        return json({ avatars })
      }

      if (path === '/api/card-state' && request.method === 'POST') {
        if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق' }, 403)
        const b = await body(request)
        const room = String(b.room || '').toUpperCase()
        const state = String(b.state || '')
        if (state !== 'writing' && state !== 'done') return json({ error: 'حالة غير صحيحة' }, 400)
        const mem = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(room, user.username).first()
        if (!mem) return json({ error: 'أنت لست عضواً في هذه الغرفة' }, 403)
        if (state === 'done') {
          const w = await env.DB.prepare('SELECT 1 AS x FROM wishes WHERE id = ?').bind(await wishId(env, room, user.username)).first()
          if (!w) return json({ error: 'لم تُحفظ أمنيتك بعد' }, 400)
        }
        await env.DB.prepare('UPDATE members SET state = ? WHERE room = ? AND username = ?').bind(state, room, user.username).run()
        return json({ ok: true })
      }

      if (path === '/api/draft') {
        const code = (new URL(request.url).searchParams.get('room') || '').toUpperCase()
        const row = await env.DB.prepare('SELECT draft, draft_at FROM members WHERE room = ? AND username = ?').bind(code, user.username).first()
        return json({ draft: row ? row.draft : null, draftAt: row ? row.draft_at : 0 })
      }

      if (path === '/api/create-room' && request.method === 'POST') {
        const b = await body(request)
        const name = String(b.name || '').trim()
        if (name.length < 1 || name.length > 40) return json({ error: 'اسم الغرفة بين 1 و40 حرفاً' }, 400)
        if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد إنشاء الغرف ممكناً' }, 403)
        const code = newCode()
        await env.DB.prepare('INSERT INTO rooms (code, name, created_by, created_at) VALUES (?, ?, ?, ?)')
          .bind(code, name, user.username, Date.now())
          .run()
        await env.DB.prepare('INSERT INTO members (room, username, joined_at) VALUES (?, ?, ?)').bind(code, user.username, Date.now()).run()
        return json({ code, name })
      }

      if (path === '/api/room/members') {
        const code = (new URL(request.url).searchParams.get('room') || '').toUpperCase()
        if ((await roomOwner(env, code)) !== user.username) return json({ error: 'أنت لست منشئ هذه الغرفة' }, 403)
        const members = (await env.DB.prepare('SELECT username FROM members WHERE room = ? ORDER BY joined_at').bind(code).all()).results.map((x) => x.username)
        const banned = (await env.DB.prepare('SELECT username FROM bans WHERE room = ?').bind(code).all()).results.map((x) => x.username)
        return json({ members, banned })
      }

      if (path === '/api/room/kick' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.room || '').toUpperCase()
        if ((await roomOwner(env, code)) !== user.username) return json({ error: 'أنت لست منشئ هذه الغرفة' }, 403)
        const target = String(b.username || '')
        if (target === user.username) return json({ error: 'لا يمكنك طرد نفسك، احذف الغرفة بدلاً من ذلك' }, 400)
        await kickFromRoom(env, code, target)
        return json({ ok: true })
      }

      if (path === '/api/room/unban' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.room || '').toUpperCase()
        if ((await roomOwner(env, code)) !== user.username) return json({ error: 'أنت لست منشئ هذه الغرفة' }, 403)
        await env.DB.prepare('DELETE FROM bans WHERE room = ? AND username = ?').bind(code, String(b.username || '')).run()
        return json({ ok: true })
      }

      if (path === '/api/room/delete' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.room || '').toUpperCase()
        if ((await roomOwner(env, code)) !== user.username) return json({ error: 'أنت لست منشئ هذه الغرفة' }, 403)
        await deleteRoomFully(env.DB, code)
        return json({ ok: true })
      }

      if (path === '/api/game/state') {
        const code = (new URL(request.url).searchParams.get('room') || '').toUpperCase()
        const mem = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(code, user.username).first()
        if (!mem) return json({ error: 'أنت لست عضواً في هذه الغرفة' }, 403)
        return json(await gameStateFor(env, code, user.username))
      }

      if (path === '/api/game/guess' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.room || '').toUpperCase()
        const mem = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(code, user.username).first()
        if (!mem) return json({ error: 'أنت لست عضواً في هذه الغرفة' }, 403)
        const g = await tickGame(env, code)
        if (!g || g.phase !== 'show') return json({ error: 'لا يوجد تصويت الآن' }, 400)
        if (Date.now() >= g.deadline) return json({ error: 'انتهى وقت التخمين' }, 400)
        const guess = String(b.guess || '')
        const isMember = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(code, guess).first()
        if (!isMember) return json({ error: 'اختر اسماً من أعضاء الغرفة' }, 400)
        await env.DB.prepare(
          'INSERT INTO guesses (room, round, guesser, guess, ts) VALUES (?, ?, ?, ?, ?) ON CONFLICT(room, round, guesser) DO UPDATE SET guess = excluded.guess, ts = excluded.ts'
        )
          .bind(code, g.idx, user.username, guess, Date.now())
          .run()
        return json({ ok: true })
      }

      if (path === '/api/game/start' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.room || '').toUpperCase()
        const owner = await roomOwner(env, code)
        if (owner !== user.username) return json({ error: 'أنت لست منشئ هذه الغرفة' }, 403)
        if (Date.now() < UNLOCK_AT) return json({ error: 'لم يحن موعد فتح الصندوق بعد' }, 403)
        const existing = await env.DB.prepare('SELECT phase FROM games WHERE room = ?').bind(code).first()
        if (existing && existing.phase !== 'idle') return json({ error: 'اللعبة بدأت بالفعل' }, 400)
        const members = await wishedMembers(env, code)
        if (members.length === 0) return json({ error: 'لا توجد أمنيات في هذه الغرفة بعد' }, 400)
        const order = shuffle(members, code)
        const now = Date.now()
        await env.DB.prepare(
          "INSERT INTO games (room, order_json, idx, phase, deadline, started_at) VALUES (?, ?, 0, 'show', ?, ?) ON CONFLICT(room) DO UPDATE SET order_json = excluded.order_json, idx = 0, phase = 'show', deadline = excluded.deadline, started_at = excluded.started_at"
        )
          .bind(code, JSON.stringify(order), now + GUESS_MS, now)
          .run()
        return json({ ok: true })
      }

      if (path === '/api/game/skip' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.room || '').toUpperCase()
        const owner = await roomOwner(env, code)
        if (owner !== user.username) return json({ error: 'أنت لست منشئ هذه الغرفة' }, 403)
        const g = await env.DB.prepare('SELECT phase FROM games WHERE room = ?').bind(code).first()
        if (!g || g.phase === 'idle' || g.phase === 'final') return json({ error: 'لا توجد جولة جارية' }, 400)
        await env.DB.prepare('UPDATE games SET deadline = ? WHERE room = ?').bind(Date.now(), code).run()
        return json(await gameStateFor(env, code, user.username))
      }

      if (path === '/api/join' && request.method === 'POST') {
        const b = await body(request)
        const code = String(b.code || '').trim().toUpperCase()
        const room = await env.DB.prepare('SELECT code, name FROM rooms WHERE code = ?').bind(code).first()
        if (!room) return json({ error: 'كود الغرفة غير صحيح' }, 404)
        if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد الانضمام ممكناً' }, 403)
        const banned = await env.DB.prepare('SELECT 1 AS x FROM bans WHERE room = ? AND lower(username) = lower(?)').bind(code, user.username).first()
        if (banned) return json({ error: 'لا يمكنك الانضمام إلى هذه الغرفة' }, 403)
        await env.DB.prepare('INSERT OR IGNORE INTO members (room, username, joined_at) VALUES (?, ?, ?)')
          .bind(code, user.username, Date.now())
          .run()
        return json({ room })
      }

      if (path === '/api/wish' && request.method === 'POST') {
        if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد الحفظ ممكناً' }, 403)
        const b = await body(request)
        const room = String(b.room || '').toUpperCase()
        const member = await env.DB.prepare('SELECT 1 AS x FROM members WHERE room = ? AND username = ?').bind(room, user.username).first()
        if (!member) return json({ error: 'أنت لست عضواً في هذه الغرفة' }, 403)
        const data = String(b.data || '')
        if (!data.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')) return json({ error: 'البيانات غير مقفلة' }, 400)
        if (data.length > 200000) return json({ error: 'الأمنية كبيرة جداً' }, 400)
        await env.DB.prepare(
          'INSERT INTO wishes (id, room, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
        )
          .bind(await wishId(env, room, user.username), room, data, Date.now())
          .run()
        const draft = b.draft ? String(b.draft) : null
        if (draft && draft.length <= 400000) {
          await env.DB.prepare('UPDATE members SET draft = ?, draft_at = ? WHERE room = ? AND username = ?')
            .bind(draft, Number(b.draftAt) || Date.now(), room, user.username)
            .run()
        }
        return json({ ok: true })
      }

      return json({ error: 'غير موجود' }, 404)
    } catch {
      return json({ error: 'خطأ في السيرفر' }, 500)
    }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    if (origin && !ORIGINS.includes(origin)) return json({ error: 'غير مسموح' }, 403)
    const cors = {
      'Access-Control-Allow-Origin': origin || ORIGINS[0],
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const res = await handle(request, env)
    const out = new Response(res.body, res)
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
    out.headers.set('X-Content-Type-Options', 'nosniff')
    out.headers.set('Cache-Control', 'no-store')
    return out
  },
}