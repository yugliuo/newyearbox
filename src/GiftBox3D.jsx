import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const D = Math.PI / 180

const PRESETS = [
  { name: 'أحمر وذهبي', box: 0xb3101f, ribbon: 0xd4af37 },
  { name: 'أخضر وأحمر', box: 0x1f6b40, ribbon: 0xc8102e },
  { name: 'أبيض وذهبي', box: 0xf2ece1, ribbon: 0xd4af37 },
  { name: 'عنّابي وأخضر', box: 0x5a0f1c, ribbon: 0x2f8f5b },
]

function paperTexture(hex) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')
  const col = '#' + hex.toString(16).padStart(6, '0')
  x.fillStyle = col
  x.fillRect(0, 0, 256, 256)
  x.globalAlpha = 0.06
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
    x.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function GiftBox3D() {
  const mount = useRef(null)
  const api = useRef({})
  const [preset, setPreset] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const el = mount.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.45
    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x0a0a14, 0.25))
    const key = new THREE.DirectionalLight(0xfff3e0, 2.3)
    key.position.set(-3, 4, 3.5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6fa8ff, 1.1)
    rim.position.set(3, 1.5, -3)
    scene.add(rim)

    const W = 1.3
    const H = 0.95
    const RIB = 0.13 // عرض الشريط

    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })
    const ribbonMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 })

    const root = new THREE.Group()
    scene.add(root)

    // قاعدة الصندوق
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.62, W), boxMat)
    base.position.y = (H * 0.62) / 2
    root.add(base)

    // الشريط حول القاعدة (أربع لوحات)
    const baseRibbonY = base.position.y
    const ribFB = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, RIB, W + 0.01), ribbonMat)
    ribFB.position.y = baseRibbonY
    root.add(ribFB)

    // الغطاء، مجموعة منفصلة حتى يُرفع عند الفتح
    const lid = new THREE.Group()
    const lidTop = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, H * 0.28, W + 0.08), boxMat)
    lidTop.position.y = (H * 0.28) / 2
    lid.add(lidTop)
    const lidRibX = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H * 0.28 + 0.01, RIB), ribbonMat)
    lidRibX.position.y = (H * 0.28) / 2
    lid.add(lidRibX)
    const lidRibZ = new THREE.Mesh(new THREE.BoxGeometry(RIB, H * 0.28 + 0.01, W + 0.1), ribbonMat)
    lidRibZ.position.y = (H * 0.28) / 2
    lid.add(lidRibZ)
    lid.position.y = base.position.y + (H * 0.62) / 2
    root.add(lid)

    // الفيونكة أعلى الغطاء
    const bow = new THREE.Group()
    ;[-1, 1].forEach((side) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 10, 20), ribbonMat)
      loop.rotation.y = Math.PI / 2
      loop.rotation.z = side * 0.55
      loop.position.set(side * 0.08, 0.1, 0)
      bow.add(loop)
    })
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), ribbonMat)
    knot.position.y = 0.1
    bow.add(knot)
    ;[-1, 1].forEach((side) => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), ribbonMat)
      tail.position.set(side * 0.05, 0.02, 0.02)
      tail.rotation.z = side * 0.3
      bow.add(tail)
    })
    bow.position.y = H * 0.28
    lid.add(bow)

    // تجويف داخلي داكن يظهر عند الرفع
    const cavity = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.06, H * 0.58, W - 0.06),
      new THREE.MeshStandardMaterial({ color: 0x120306, roughness: 0.9, side: THREE.BackSide })
    )
    cavity.position.y = base.position.y
    root.add(cavity)

    root.position.y = -0.52

    function applyColors(p) {
      boxMat.map = paperTexture(p.box)
      boxMat.map.needsUpdate = true
      boxMat.color.set(0xffffff)
      boxMat.needsUpdate = true
      ribbonMat.color.set(p.ribbon)
    }
    applyColors(PRESETS[0])

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.05, 0)
    controls.enablePan = false
    controls.enableDamping = true

    let fitted = false
    function resize() {
      const w = el.clientWidth || 360
      const h = el.clientHeight || 520
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (!fitted) {
        fitted = true
        const half = Math.tan((camera.fov * D) / 2)
        const dist = Math.max(1.05 / half, 1.25 / (half * camera.aspect))
        camera.position.set(0.95, 0.55, dist)
        controls.minDistance = dist * 0.55
        controls.maxDistance = dist * 2.3
        controls.update()
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const t0 = performance.now()
    let raf = 0
    let lidY = lid.position.y
    let lidTargetY = lidY
    function loop() {
      const t = (performance.now() - t0) / 1000
      root.rotation.y = Math.sin(t * 0.35) * 0.1
      lidY += (lidTargetY - lidY) * 0.08
      lid.position.y = lidY
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()
    window.__giftReady = true

    api.current = {
      setOpen: (v) => {
        lidTargetY = v ? lid.position.y + 0.55 : base.position.y + (H * 0.62) / 2
      },
      applyColors,
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
      pmrem.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    if (api.current.applyColors) api.current.applyColors(PRESETS[preset])
  }, [preset])

  useEffect(() => {
    if (api.current.setOpen) api.current.setOpen(open)
  }, [open])

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', padding: '12px 16px 0', fontSize: 14, opacity: 0.85 }}>اسحب بإصبعك لتدوير الصندوق</div>
      <div ref={mount} style={{ flex: 1, minHeight: 0, touchAction: 'none' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, padding: '6px 16px' }}>
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setPreset(i)}
            style={{
              padding: '8px 16px', fontSize: 14, fontFamily: 'inherit', border: 'none', borderRadius: 20, cursor: 'pointer',
              background: preset === i ? '#d4af37' : 'rgba(255,235,215,0.15)', color: preset === i ? '#6e0710' : '#fff',
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px 20px' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ padding: '10px 28px', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, border: 'none', borderRadius: 24, cursor: 'pointer', background: '#c8102e', color: '#fff' }}
        >
          {open ? 'أغلق الصندوق' : 'افتح الصندوق'}
        </button>
      </div>
    </div>
  )
}