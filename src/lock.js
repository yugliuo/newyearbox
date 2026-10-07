import { timelockEncrypt, timelockDecrypt, mainnetClient, roundAt, defaultChainInfo, Buffer } from 'tlock-js'

// رأس السنة 2027 بتوقيت بغداد (UTC+3) = 31 ديسمبر 2026 الساعة 21:00 بتوقيت UTC
export const UNLOCK_AT = Date.UTC(2026, 11, 31, 21, 0, 0)

// +1 حتى يكون المفتاح بعد الموعد وليس قبله بثوانٍ
export function roundFor(unlockAt) {
  return roundAt(unlockAt, defaultChainInfo) + 1
}

export async function lockText(text, unlockAt = UNLOCK_AT) {
  return timelockEncrypt(roundFor(unlockAt), Buffer.from(text, 'utf8'), mainnetClient())
}

export async function unlockText(cipher) {
  const buf = await timelockDecrypt(cipher, mainnetClient())
  return buf.toString('utf8')
}