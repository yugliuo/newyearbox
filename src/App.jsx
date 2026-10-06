import { useState } from 'react'
import './App.css'
import Editor from './Editor.jsx'

export default function App() {
  const [page, setPage] = useState('welcome')

  if (page === 'editor') return <Editor />

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '24px', gap: '16px'
    }}>
      <div style={{ fontSize: '80px' }}>🍳</div>
      <h1 style={{ fontSize: '32px', fontWeight: 900 }}>صندوق رأس السنة</h1>
      <p style={{ maxWidth: '320px', lineHeight: 1.8, opacity: 0.9 }}>
        اكتب أمنيتك على ورقة، واقفلها في الصندوق،
        وسنفتحه معاً في رأس السنة القادمة!
      </p>
      <button
        onClick={() => setPage('editor')}
        style={{
          padding: '14px 36px', fontSize: '18px', fontFamily: 'inherit',
          fontWeight: 700, border: 'none', borderRadius: '30px',
          background: '#ffb830', cursor: 'pointer'
        }}>
        ابدأ
      </button>
    </div>
  )
}