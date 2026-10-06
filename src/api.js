const API = 'https://newyear-box-api.taoh.workers.dev'

export async function api(path, body, token) {
  try {
    const res = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
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