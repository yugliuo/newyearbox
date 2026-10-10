import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const TEAL = '#5ff5da'
const D = Math.PI / 180

/* ---------- الوجه: يُرسم على لوحة ويمكن تغييره لاحقاً بسهولة ---------- */
const FACES = {
  happy: (c) => {
    c.beginPath(); c.moveTo(150, 250); c.lineTo(190, 205); c.lineTo(230, 250); c.stroke()
    c.beginPath(); c.moveTo(282, 250); c.lineTo(322, 205); c.lineTo(362, 250); c.stroke()
    c.beginPath(); c.arc(256, 292, 30, 25 * D, 155 * D); c.stroke()
  },
  smug: (c) => {
    c.beginPath(); c.moveTo(140, 215); c.lineTo(235, 215); c.stroke()
    c.beginPath(); c.moveTo(277, 205); c.lineTo(372, 215); c.stroke()
    c.beginPath(); c.arc(188, 232, 20, 0, Math.PI); c.fill()
    c.beginPath(); c.arc(324, 232, 20, 0, Math.PI); c.fill()
    c.beginPath(); c.moveTo(236, 300); c.lineTo(276, 300); c.stroke()
  },
  calm: (c) => {
    for (const x of [190, 322]) {
      c.beginPath(); c.roundRect(x - 17, 195, 34, 62, 17); c.fill()
    }
  },
}

function drawFace(canvas, name) {
  const c = canvas.getContext('2d')
  c.clearRect(0, 0, 512, 512)
  c.strokeStyle = TEAL
  c.fillStyle = TEAL
  c.lineWidth = 17
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.shadowColor = TEAL
  c.shadowBlur = 26
  FACES[name](c)
  c.shadowBlur = 8
  FACES[name](c)
}

/* ---------- جسم المقلاة: مقطع دوراني سميك الحافة ---------- */
function arc(cx, cy, r, a0, a1, n) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)))
  }
  return pts
}
function panProfile() {
  const p = [new THREE.Vector2(0, 0), new THREE.Vector2(0.8, 0)]
  p.push(...arc(0.8, 0.16, 0.16, -90 * D, 0, 10))
  p.push(new THREE.Vector2(0.96, 0.4))
  p.push(...arc(0.88, 0.4, 0.08, 0, 180 * D, 14))
  p.push(new THREE.Vector2(0.745, 0.15))
  p.push(...arc(0.665, 0.15, 0.08, 0, -90 * D, 8))
  p.push(new THREE.Vector2(0, 0.07))
  return p
}

/* ---------- أنبوب بنصف قطر متغير (للذراع) ---------- */
function tubeGeometry(curve, radiusAt, seg, rad) {
  const frames = curve.computeFrenetFrames(seg, false)
  const pos = []
  const idx = []
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg)
    const r = radiusAt(i / seg)
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2
      const d = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)))
      pos.push(c.x + d.x * r, c.y + d.y * r, c.z + d.z * r)
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j
      const b = a + rad + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* ---------- اليد بقفاز أسود ---------- */
function makeHand(glove) {
  const hand = new THREE.Group()
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), glove)
  palm.scale.set(0.17, 0.19, 0.12)
  palm.position.y = 0.18
  hand.add(palm)
  const lens = [0.17, 0.23, 0.21, 0.15]
  ;[-1.5, -0.5, 0.5, 1.5].forEach((k, i) => {
    const pivot = new THREE.Group()
    pivot.position.set(k * 0.07, 0.3, 0)
    pivot.rotation.z = -k * 0.14
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, lens[i], 8, 16), glove)
    f.position.y = lens[i] / 2 + 0.02
    pivot.add(f)
    hand.add(pivot)
  })
  const thumbPivot = new THREE.Group()
  thumbPivot.position.set(-0.15, 0.13, 0.02)
  thumbPivot.rotation.z = 58 * D
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.12, 8, 16), glove)
  thumb.position.y = 0.1
  thumbPivot.add(thumb)
  hand.add(thumbPivot)
  return hand
}

export default function Pan3D() {
  const mount = useRef(null)
  const api = useRef({})
  const [face, setFace] = useState('happy')

  useEffect(() => {
    const el = mount.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50)
    camera.position.set(0.3, 0.15, 5.6)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.2
    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x0a0a14, 0.22))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(-2.5, 3, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x5b8cff, 1.4)
    rim.position.set(3.5, 1.2, -3)
    scene.add(rim)

    const body = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide })
    const glove = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.3, metalness: 0.15, side: THREE.DoubleSide })
    const tealMat = new THREE.MeshBasicMaterial({ color: TEAL, toneMapped: false, side: THREE.DoubleSide })

    const character = new THREE.Group()
    scene.add(character)

    const pan = new THREE.Mesh(new THREE.LatheGeometry(panProfile(), 128), body)
    pan.rotation.x = Math.PI / 2
    pan.position.z = -0.24
    character.add(pan)

    const edge = new THREE.Mesh(new THREE.TorusGeometry(0.962, 0.011, 12, 160), new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.35, metalness: 1 }))
    edge.position.z = 0.16
    character.add(edge)

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    drawFace(canvas, 'happy')
    const faceTex = new THREE.CanvasTexture(canvas)
    faceTex.colorSpace = THREE.SRGBColorSpace
    const faceMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.66, 64),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, toneMapped: false, depthWrite: false })
    )
    faceMesh.position.z = -0.164
    character.add(faceMesh)

    // الذراع: المقبض نفسه يخرج من جانب المقلاة
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.68, -0.56, -0.06),
      new THREE.Vector3(1.05, -0.84, -0.06),
      new THREE.Vector3(1.42, -0.62, -0.02),
      new THREE.Vector3(1.55, -0.1, 0),
      new THREE.Vector3(1.5, 0.38, 0.02),
    ])
    const radiusAt = (t) => 0.155 - 0.03 * t
    character.add(new THREE.Mesh(tubeGeometry(curve, radiusAt, 80, 24), glove))

    // الخط المضيء على الذراع
    const Z = new THREE.Vector3(0, 0, 1)
    const sp = []
    for (let i = 0; i <= 80; i++) {
      const c = curve.getPointAt(i / 80)
      const T = curve.getTangentAt(i / 80).normalize()
      const front = Z.clone().sub(T.clone().multiplyScalar(Z.dot(T))).normalize()
      const side = new THREE.Vector3().crossVectors(T, front)
      if (side.dot(new THREE.Vector3(c.x, c.y, 0)) < 0) side.negate()
      const dir = front.multiplyScalar(0.95).add(side.multiplyScalar(0.31))
      sp.push(c.add(dir.multiplyScalar(radiusAt(i / 80) * 0.96)))
    }
    character.add(new THREE.Mesh(tubeGeometry(new THREE.CatmullRomCurve3(sp.slice(14, 78)), () => 0.02, 70, 10), tealMat))

    // المعصم واليد
    const end = curve.getPointAt(1)
    const tangent = curve.getTangentAt(1).normalize()
    const wrist = new THREE.Group()
    wrist.position.copy(end)
    wrist.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.052, 16, 40), new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.4, metalness: 0.3 }))
    cuff.rotation.x = Math.PI / 2
    cuff.position.y = 0.01
    wrist.add(cuff)
    const hand = makeHand(glove)
    hand.scale.setScalar(1.5)
    hand.position.y = 0.04
    wrist.add(hand)
    character.add(wrist)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0.5, 0.08, 0)
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
        const dist = Math.max(1.45 / half, 1.72 / (half * camera.aspect))
        camera.position.set(controls.target.x, controls.target.y + 0.15, dist)
        controls.minDistance = dist * 0.5
        controls.maxDistance = dist * 2
        controls.update()
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    api.current = { canvas, faceTex }
    const t0 = performance.now()
    let raf = 0
    function loop() {
      const t = (performance.now() - t0) / 1000
      character.position.y = Math.sin(t * 1.5) * 0.045
      character.rotation.z = Math.sin(t * 0.8) * 0.025
      hand.rotation.z = Math.sin(t * 3.2) * 0.14
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()
    window.__panReady = true

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
      faceTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [])

  function pick(name) {
    setFace(name)
    const { canvas, faceTex } = api.current
    if (canvas) {
      drawFace(canvas, name)
      faceTex.needsUpdate = true
    }
  }

  const names = [['happy', 'سعيدة'], ['smug', 'ساخرة'], ['calm', 'هادئة']]
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', padding: '12px 16px 0', fontSize: 14, opacity: 0.85 }}>اسحب بإصبعك لتدوير المقلاة</div>
      <div ref={mount} style={{ flex: 1, minHeight: 0, touchAction: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 16px 20px' }}>
        {names.map(([k, l]) => (
          <button
            key={k}
            onClick={() => pick(k)}
            style={{
              padding: '8px 18px', fontSize: 15, fontFamily: 'inherit', border: 'none', borderRadius: 20, cursor: 'pointer',
              background: face === k ? '#ffb830' : 'rgba(255,255,255,0.15)', color: face === k ? '#000' : '#fff',
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}