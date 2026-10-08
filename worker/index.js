const enc = new TextEncoder()
// رأس السنة 2027 بتوقيت بغداد (UTC+3)، بعده يُغلق الحفظ والانضمام
const UNLOCK_AT = Date.UTC(2026, 11, 31, 21, 0, 0)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
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
async function makeToken(username, secret) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 60
  const body = encodeURIComponent(username) + '|' + exp
  return body + '|' + (await sign('token:' + body, secret))
}
async function readToken(request, secret) {
  const parts = (request.headers.get('Authorization') || '').replace('Bearer ', '').split('|')
  if (parts.length !== 3) return null
  const body = parts[0] + '|' + parts[1]
  if ((await sign('token:' + body, secret)) !== parts[2]) return null
  if (Number(parts[1]) < Date.now()) return null
  return decodeURIComponent(parts[0])
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
function newCode() {
  const a = crypto.getRandomValues(new Uint8Array(6))
  return [...a].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}
async function findUser(env, username) {
  return env.DB.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').bind(username).first()
}
async function authUser(request, env) {
  const name = await readToken(request, env.APP_SECRET)
  return name ? findUser(env, name) : null
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
}

async function adminRoutes(path, request, env) {
  const DB = env.DB
  if (path === '/api/admin/login') {
    const b = await body(request)
    if (!env.ADMIN_PASSWORD) return json({ error: 'لم تُضبط كلمة سر المطوّر بعد' }, 500)
    const ok = (await sign('pw', String(b.password || ''))) === (await sign('pw', env.ADMIN_PASSWORD))
    if (!ok) return json({ error: 'كلمة السر خطأ' }, 401)
    const exp = Date.now() + 1000 * 60 * 60 * 12
    return json({ token: 'admin|' + exp + '|' + (await sign('admin:' + exp, env.APP_SECRET)) })
  }
  if (!(await isAdmin(request, env))) return json({ error: 'غير مصرّح' }, 401)
    if (path === '/api/admin/overview') {
    const users = (
      await DB.prepare(
        'SELECT u.username, u.avatar IS NOT NULL AS has_avatar, u.reset_requested, u.created_at, (SELECT COUNT(*) FROM members m WHERE m.username = u.username) AS rooms FROM users u ORDER BY u.created_at DESC'
      ).all()
    ).results
    const rooms = (await DB.prepare('SELECT code, name, created_at FROM rooms ORDER BY created_at DESC').all()).results
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
    await DB.prepare('INSERT INTO rooms (code, name, created_at) VALUES (?, ?, ?)').bind(code, name, Date.now()).run()
    return json({ code, name })
  }

  if (path === '/api/admin/reset') {
    const b = await body(request)
    const user = await findUser(env, String(b.username || ''))
    const password = String(b.password || '')
    if (!user) return json({ error: 'المستخدم غير موجود' }, 404)
    if (password.length < 4) return json({ error: 'كلمة السر قصيرة (4 أحرف على الأقل)' }, 400)
    await setPassword(env, user.username, password)
    return json({ ok: true })
  }

  if (path === '/api/admin/kick') {
    const b = await body(request)
    const code = String(b.room || '').toUpperCase()
    const user = await findUser(env, String(b.username || ''))
    if (!user) return json({ error: 'المستخدم غير موجود' }, 404)
    await DB.prepare('DELETE FROM wishes WHERE id = ?').bind(await wishId(env, code, user.username)).run()
    await DB.prepare('DELETE FROM members WHERE room = ? AND username = ?').bind(code, user.username).run()
    await DB.prepare('INSERT OR IGNORE INTO bans (room, username) VALUES (?, ?)').bind(code, user.username).run()
    return json({ ok: true })
  }

  if (path === '/api/admin/unban') {
    const b = await body(request)
    await DB.prepare('DELETE FROM bans WHERE room = ? AND username = ?').bind(String(b.room  '').toUpperCase(), String(b.username  '')).run()
    return json({ ok: true })
  }

  if (path === '/api/admin/delete-room') {
    const b = await body(request)
    const code = String(b.code || '')
    await DB.prepare('DELETE FROM wishes WHERE room = ?').bind(code).run()
    await DB.prepare('DELETE FROM members WHERE room = ?').bind(code).run()
    await DB.prepare('DELETE FROM bans WHERE room = ?').bind(code).run()
    await DB.prepare('DELETE FROM rooms WHERE code = ?').bind(code).run()
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
    await DB.prepare('DELETE FROM users WHERE username = ?').bind(user.username).run()
    return json({ ok: true })
  }
  return json({ error: 'غير موجود' }, 404)
}
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
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
        if (password.length < 4) return json({ error: 'كلمة السر قصيرة (4 أحرف على الأقل)' }, 400)
        if (avatar && avatar.length > 60000) return json({ error: 'الصورة كبيرة' }, 400)
        if (await findUser(env, username)) return json({ error: 'هذا الاسم مستخدم، اختر اسماً آخر' }, 409)
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
        const passHash = await hashPassword(password, salt)
        await env.DB.prepare('INSERT INTO users (username, pass_hash, salt, avatar, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(username, passHash, salt, avatar, Date.now())
          .run()
        return json({ token: await makeToken(username, env.APP_SECRET), username, avatar })
      }

      if (path === '/api/login' && request.method === 'POST') {
        const b = await body(request)
        const user = await findUser(env, String(b.username || '').trim())
        if (!user) return json({ error: 'الاسم أو كلمة السر خطأ' }, 401)
        const h = await hashPassword(String(b.password || ''), user.salt)
        if (h !== user.pass_hash) return json({ error: 'الاسم أو كلمة السر خطأ' }, 401)
        return json({ token: await makeToken(user.username, env.APP_SECRET), username: user.username, avatar: user.avatar })
      }

      if (path === '/api/forgot' && request.method === 'POST') {
        const b = await body(request)
        const user = await findUser(env, String(b.username || '').trim())
        if (user) await env.DB.prepare('UPDATE users SET reset_requested = 1 WHERE username = ?').bind(user.username).run()
        return json({ ok: true })
      }

      const user = await authUser(request, env)
      if (!user) return json({ error: 'سجّل الدخول من جديد' }, 401)

      if (path === '/api/me') return json({ username: user.username, avatar: user.avatar })

      if (path === '/api/rooms') {
        const rows = (
          await env.DB.prepare(
            'SELECT r.code, r.name, (SELECT COUNT(*) FROM members WHERE room = r.code) AS members FROM members m JOIN rooms r ON r.code = m.room WHERE m.username = ? ORDER BY m.joined_at'
          )
            .bind(user.username)
            .all()
        ).results
        for (const r of rows) {
          const w = await env.DB.prepare('SELECT 1 AS x FROM wishes WHERE id = ?').bind(await wishId(env, r.code, user.username)).first()
          r.hasWish = !!w
        }
        return json({ rooms: rows })
      }

      if (path === '/api/vault') {
        if (request.method === 'POST') {
          if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد الحفظ ممكناً' }, 403)
          const b = await body(request)
          const data = String(b.data || '')
          if (!data.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')) return json({ error: 'البيانات غير مقفلة' }, 400)
          if (data.length > 200000) return json({ error: 'الرسالة كبيرة جداً' }, 400)
          await env.DB.prepare(
            'INSERT INTO vaults (username, message, updated_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET message = excluded.message, updated_at = excluded.updated_at')
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
        const room = await env.DB.prepare('SELECT code, name FROM rooms WHERE code = ?').bind(code).first()
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
  },
}