export const API_BASE = 'https://newyear-box-api.taoh.workers.dev'
const API = API_BASE

// body: كائن JSON يُرسل كما كان دائماً. rawBody: بيانات ثنائية (Uint8Array) تُرسل كما هي (رفع الفيديو).
// method: يفرض طريقة صريحة (مثل DELETE) حتى بلا جسم.
export async function api(path, body, token, rawBody, method) {
  try {
    const res = await fetch(API + path, {
      method: method || (rawBody ? 'POST' : body ? 'POST' : 'GET'),
      headers: {
        ...(rawBody ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: rawBody ? rawBody : body ? JSON.stringify(body) : undefined,
    })
    let data = null
    try {
      data = await res.json()
    } catch {
      data = {}
    }
    if (res.status === 401 && token && data.error === 'سجّل الدخول من جديد') {
      clearSession()
      try {
        localStorage.removeItem('nav')
      } catch {
        /* ignore */
      }
      window.location.reload()
    }
    if (res.status === 404) data.error = (data.error || 'غير موجود') + ' [' + path.split('?')[0] + ']'
    return { ok: res.ok, data }
  } catch {
    return { ok: false, data: { error: 'تعذّر الاتصال، تأكد من الإنترنت' } }
  }
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem('session'))
  } catch {
    return null
  }
}
export function setSession(s) {
  try {
    localStorage.setItem('session', JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
export function clearSession() {
  try {
    localStorage.removeItem('session')
  } catch {
    /* ignore */
  }
}