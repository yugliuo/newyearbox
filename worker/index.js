const enc = new TextEncoder()
// رأس السنة 2027 بتوقيت بغداد (UTC+3)، بعده يُغلق الحفظ
const UNLOCK_AT = Date.UTC(2026, 11, 31, 21, 0, 0)
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
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  const parts = token.split('|')
  if (parts.length !== 3) return null
  const body = parts[0] + '|' + parts[1]
  if ((await sign('token:' + body, secret)) !== parts[2]) return null
  if (Number(parts[1]) < Date.now()) return null
  return decodeURIComponent(parts[0])
}

async function findUser(env, username) {
  return env.DB.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').bind(username).first()
}

async function body(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const path = new URL(request.url).pathname

    try {
      if (!env.APP_SECRET) return json({ error: 'السيرفر غير مكتمل الإعداد' }, 500)

      if (path === '/api/ping') return json({ ok: true })

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

      if (path === '/api/me') {
        const name = await readToken(request, env.APP_SECRET)
        if (!name) return json({ error: 'سجّل الدخول من جديد' }, 401)
        const user = await findUser(env, name)
        if (!user) return json({ error: 'سجّل الدخول من جديد' }, 401)
        return json({ username: user.username, avatar: user.avatar })
      }

      if (path === '/api/wish' && request.method === 'POST') {
        const name = await readToken(request, env.APP_SECRET)
        if (!name) return json({ error: 'سجّل الدخول من جديد' }, 401)
        const user = await findUser(env, name)
        if (!user) return json({ error: 'سجّل الدخول من جديد' }, 401)
        if (Date.now() >= UNLOCK_AT) return json({ error: 'أُغلق الصندوق ولم يعد الحفظ ممكناً' }, 403)
        const b = await body(request)
        const data = String(b.data || '')
        if (!data.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')) return json({ error: 'البيانات غير مقفلة' }, 400)
        if (data.length > 200000) return json({ error: 'الأمنية كبيرة جداً' }, 400)
        // معرّف الأمنية مشتق من الاسم بدالة لا رجعة فيها، فلا يظهر اسم في جدول الأمنيات
        const id = 'w_' + (await sign('wish:' + user.username.toLowerCase(), env.APP_SECRET)).slice(0, 32)
        await env.DB.prepare(
          'INSERT INTO wishes (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
        )
          .bind(id, data, Date.now())
          .run()
        return json({ ok: true })
      }

      return json({ error: 'غير موجود' }, 404)
    } catch (err) {
      return json({ error: 'خطأ في السيرفر' }, 500)
    }
  },
}