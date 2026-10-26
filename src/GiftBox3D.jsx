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

// حلقة الفيونكة: شريط مطويّ على شكل عين مجوّفة (فيها ثقب في الوسط)
function loopGeometry(L, Hh, wr, depth) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(L * 0.04, Hh, L * 1.12, Hh, L, 0)
  s.bezierCurveTo(L * 1.12, -Hh, L * 0.04, -Hh, 0, 0)

  const a = wr * 1.6 // يبدأ الثقب بعد العقدة
  const b = L - wr * 1.1 // وينتهي قبل طرف الحلقة
  const Hh2 = Hh * 0.5
  const hole = new THREE.Path()
  hole.moveTo(a, 0)
  hole.bezierCurveTo(a + (b - a) * 0.04, Hh2, a + (b - a) * 1.12, Hh2, b, 0)
  hole.bezierCurveTo(a + (b - a) * 1.12, -Hh2, a + (b - a) * 0.04, -Hh2, a, 0)
  s.holes.push(hole)

  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 28,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

// ذيل الفيونكة: شريط مسطّح بنهاية على شكل V
function tailGeometry(len, hw, notch, depth) {
  const s = new THREE.Shape()
  s.moveTo(-hw, 0)
  s.lineTo(hw, 0)
  s.lineTo(hw * 1.15, -len)
  s.lineTo(0, -len + notch)
  s.lineTo(-hw * 1.15, -len)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
  })
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
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    // الإضاءة
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.45
    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x0a0a14, 0.25))
    const key = new THREE.DirectionalLight(0xfff3e0, 2.3)
    key.position.set(-3, 4, 3.5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left = -2.5
    key.shadow.camera.right = 2.5
    key.shadow.camera.top = 3
    key.shadow.camera.bottom = -2
    key.shadow.camera.near = 1
    key.shadow.camera.far = 14
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6fa8ff, 1.1)
    rim.position.set(3, 1.5, -3)
    scene.add(rim)

    // الأبعاد
    const W = 1.3 // عرض الصندوق
    const BH = 0.78 // ارتفاع القاعدة
    const LW = W + 0.1 // عرض الغطاء (أكبر قليلاً ليغطي القاعدة)
    const LH = 0.26 // ارتفاع الغطاء
    const T = 0.04 // سماكة الجدران (الصندوق مجوّف)
    const RIB = 0.15 // عرض الشريط
    const R = 0.016 // بروز الشريط عن السطح

    // الخامات
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 })
    const linerMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }) // بطانة الداخل
    const ribbonMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 })

    // وجوه BoxGeometry: 0:+x 1:-x 2:+y 3:-y 4:+z 5:-z
    // الوجه الداخلي يأخذ خامة البطانة، والباقي ورق الهدية
    const faces = (inner) => {
      const m = [boxMat, boxMat, boxMat, boxMat, boxMat, boxMat]
      if (inner != null) m[inner] = linerMat
      return m
    }
    const part = (parent, sx, sy, sz, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat)
      m.position.set(x, y, z)
      parent.add(m)
      return m
    }

    const root = new THREE.Group()
    scene.add(root)

    // ===== القاعدة (مجوّفة ومفتوحة من الأعلى) =====
    part(root, W, T, W, 0, T / 2, 0, faces(2)) // القاع
    const wallH = BH - T
    const wallY = T + wallH / 2
    part(root, W, wallH, T, 0, wallY, W / 2 - T / 2, faces(5)) // أمامي
    part(root, W, wallH, T, 0, wallY, -W / 2 + T / 2, faces(4)) // خلفي
    part(root, T, wallH, W - 2 * T, W / 2 - T / 2, wallY, 0, faces(1)) // يمين
    part(root, T, wallH, W - 2 * T, -W / 2 + T / 2, wallY, 0, faces(0)) // يسار

    // أشرطة القاعدة: شريط عمودي في منتصف كل جدار
    part(root, RIB, BH, R, 0, BH / 2, W / 2 + R / 2, ribbonMat)
    part(root, RIB, BH, R, 0, BH / 2, -W / 2 - R / 2, ribbonMat)
    part(root, R, BH, RIB, W / 2 + R / 2, BH / 2, 0, ribbonMat)
    part(root, R, BH, RIB, -W / 2 - R / 2, BH / 2, 0, ribbonMat)

    // ===== الغطاء (مجوّف أيضاً) على مفصّلة في الحافة الخلفية =====
    const hinge = new THREE.Group()
    hinge.position.set(0, BH, -LW / 2)
    root.add(hinge)
    const lid = new THREE.Group()
    lid.position.z = LW / 2
    hinge.add(lid)

    part(lid, LW, T, LW, 0, LH - T / 2, 0, faces(3)) // سطح الغطاء
    const skH = LH - T
    part(lid, LW, skH, T, 0, skH / 2, LW / 2 - T / 2, faces(5))
    part(lid, LW, skH, T, 0, skH / 2, -LW / 2 + T / 2, faces(4))
    part(lid, T, skH, LW - 2 * T, LW / 2 - T / 2, skH / 2, 0, faces(1))
    part(lid, T, skH, LW - 2 * T, -LW / 2 + T / 2, skH / 2, 0, faces(0))

    // أشرطة الغطاء: تعبر السطح وتنزل على الجوانب الأربعة
    part(lid, LW + 2 * R, R, RIB, 0, LH + R / 2, 0, ribbonMat)
    part(lid, RIB, R + 0.006, LW + 2 * R, 0, LH + (R + 0.006) / 2, 0, ribbonMat)
    part(lid, RIB, LH, R, 0, LH / 2, LW / 2 + R / 2, ribbonMat)
    part(lid, RIB, LH, R, 0, LH / 2, -LW / 2 - R / 2, ribbonMat)
    part(lid, R, LH, RIB, LW / 2 + R / 2, LH / 2, 0, ribbonMat)
    part(lid, R, LH, RIB, -LW / 2 - R / 2, LH / 2, 0, ribbonMat)

    // ===== الفيونكة =====
    const bow = new THREE.Group()
    bow.position.y = LH + 0.025
    lid.add(bow)

    const bigLoop = loopGeometry(0.34, 0.27, 0.05, 0.02)

    // أربع حلقات كبيرة (على المحورين)
    for (let k = 0; k < 4; k++) {
      const pivot = new THREE.Group()
      pivot.rotation.y = (k * Math.PI) / 2
      const m = new THREE.Mesh(bigLoop, ribbonMat)
      const s = k % 2 === 0 ? 1 : 0.85
      m.scale.setScalar(s)
      m.rotation.z = (k % 2 === 0 ? 0.62 : 0.52)
      m.position.set(0.03, 0.05, 0)
      pivot.add(m)
      bow.add(pivot)
    }
    // أربع حلقات صغيرة بين الكبيرة لتعطي شكل الوردة
    for (let k = 0; k < 4; k++) {
      const pivot = new THREE.Group()
      pivot.rotation.y = (k * Math.PI) / 2 + Math.PI / 4
      const m = new THREE.Mesh(bigLoop, ribbonMat)
      m.scale.setScalar(0.6)
      m.rotation.z = 0.28
      m.position.set(0.02, 0.03, 0)
      pivot.add(m)
      bow.add(pivot)
    }

    // ذيلان ملقيان على الغطاء بنهاية V
    const tailGeo = tailGeometry(0.46, 0.055, 0.07, 0.012)
    ;[-1, 1].forEach((side) => {
      const pivot = new THREE.Group()
      pivot.rotation.y = side * 0.55
      const m = new THREE.Mesh(tailGeo, ribbonMat)
      m.rotation.x = -Math.PI / 2
      m.position.set(0, 0.012, 0.02)
      pivot.add(m)
      bow.add(pivot)
    })

    // العقدة المركزية
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16), ribbonMat)
    knot.scale.set(1.15, 0.8, 1.15)
    knot.position.y = 0.06
    bow.add(knot)

    // ضوء دافئ داخل الصندوق يظهر عند الفتح
    const glow = new THREE.PointLight(0xffd9a0, 0, 3)
    glow.position.set(0, BH * 0.55, 0)
    root.add(glow)

    // الظل على الأرض
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.32 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.001
    ground.receiveShadow = true
    scene.add(ground)

    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })

    function applyColors(p) {
      if (boxMat.map) boxMat.map.dispose()
      boxMat.map = paperTexture(p.box)
      boxMat.color.set(0xffffff)
      boxMat.needsUpdate = true
      linerMat.color.set(p.box).multiplyScalar(0.5)
      ribbonMat.color.set(p.ribbon)
    }
    applyColors(PRESETS[0])

    // الكاميرا
    const TY_CLOSED = 0.62
    const TY_OPEN = 1.0
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, TY_CLOSED, 0)
    controls.enablePan = false
    controls.enableDamping = true
    controls.maxPolarAngle = 1.52

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
        const dist = Math.max(0.95 / half, 1.15 / (half * camera.aspect))
        const dir = new THREE.Vector3(0.55, 0.5, 1).normalize()
        camera.position.copy(controls.target).addScaledVector(dir, dist)
        controls.minDistance = dist * 0.5
        controls.maxDistance = dist * 3.2
        controls.update()
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // الحركة: الغطاء ينفتح على المفصّلة والكاميرا تبتعد قليلاً لتُظهر الداخل
    let lidA = 0
    let lidT = 0
    let zoom = 1
    let zoomT = 1
    let ty = TY_CLOSED
    let tyT = TY_CLOSED
    let glowT = 0
    const t0 = performance.now()
    let raf = 0
    function loop() {
      const t = (performance.now() - t0) / 1000
      root.rotation.y = Math.sin(t * 0.35) * 0.1

      lidA += (lidT - lidA) * 0.07
      hinge.rotation.x = lidA
      glow.intensity += (glowT - glow.intensity) * 0.07

      const nz = zoom + (zoomT - zoom) * 0.06
      const ny = ty + (tyT - ty) * 0.06
      const off = camera.position.clone().sub(controls.target)
      off.multiplyScalar(nz / zoom)
      controls.target.y += ny - ty
      camera.position.copy(controls.target).add(off)
      zoom = nz
      ty = ny

      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()
    window.__giftReady = true

    api.current = {
      setOpen: (v) => {
        lidT = v ? -1.85 : 0
        zoomT = v ? 1.38 : 1
        tyT = v ? TY_OPEN : TY_CLOSED
        glowT = v ? 2.4 : 0
      },
      applyColors,
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      const mats = new Set()
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m))
      })
      mats.forEach((m) => {
        if (m.map) m.map.dispose()
        m.dispose()
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