import { useEffect, useState } from 'react'
import { armAutoStart, isMuted, toggleMute } from './music.js'

export default function MusicToggle() {
  const [muted, setMuted] = useState(() => isMuted())

  useEffect(() => {
    armAutoStart()
  }, [])

  return (
    <button
      onClick={() => setMuted(toggleMute())}
      aria-label={muted ? 'تشغيل الموسيقى' : 'كتم الموسيقى'}
      style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 9999,
        width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,235,215,0.3)',
        background: 'rgba(20,4,8,0.6)', backdropFilter: 'blur(6px)', color: '#f2c25e',
        fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}
    >
      {muted ? '🔇' : '🎵'}
    </button>
  )
}