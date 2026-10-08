const enc = new TextEncoder()
const dec = new TextDecoder()

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex) {
  return new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)))
}
function toB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function fromB64(b64) {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

// مفتاح مشتق من كلمة سرك، لا يعرفه السيرفر. يفتح نسختك القابلة للتعديل على أي جهاز.
export async function deriveKeyHex(password, username) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('draft:' + username.toLowerCase()), iterations: 100000 },
    base,
    256
  )
  return toHex(new Uint8Array(bits))
}

async function aesKey(hex) {
  return crypto.subtle.importKey('raw', fromHex(hex), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptDraft(keyHex, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyHex), enc.encode(text)))
  const all = new Uint8Array(iv.length + ct.length)
  all.set(iv)
  all.set(ct, iv.length)
  return toB64(all)
}

export async function decryptDraft(keyHex, b64) {
  const all = fromB64(b64)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await aesKey(keyHex), all.slice(12))
  return dec.decode(pt)
}