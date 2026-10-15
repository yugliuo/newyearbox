import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const D = Math.PI / 180
const GOLD = 0xc9a24b

// خشب بخطوطه الطبيعية مرسوم بالكود (بلا أي صورة جاهزة)
function woodTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const x = c.getContext('2d')
  x.fillStyle = '#3a2416'
  x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 46; i++) {
    const y = (i / 46) * 512 + (Math.sin(i * 12.9) * 4)
    const w = 6 + Math.abs(Math.sin(i * 7.3)) * 10
    const shade = 18 + Math.abs(Math.sin(i * 3.1)) * 22
    x.strokeStyle = 'rgba(' + (58 + shade) + ',' + (36 + shade * 0.6) + ',' + (22 + shade * 0.3) + ',0.55)'
    x.lineWidth = w
    x.beginPath()
    x.moveTo(0, y)
    for (let xx = 0; xx <= 512; xx += 32) x.lineTo(xx, y + Math.sin(xx * 0.02 + i) * 5)
    x.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function lockPlateTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  x.fillStyle = '#7a5a20'
  x.fillRect(0, 0, 128, 128)
  const g = x.createLinearGradient(0, 0, 128, 128)
  g.addColorStop(0, '#f1d98a')
  g.addColorStop(0.5, '#c9a24b')
  g.addColorStop(1, '#9a7830')
  x.fillStyle = g
  x.fillRect(4, 4, 120, 120)
  x.fillStyle = '#3a2416'
  x.beginPath()
  x.arc(64, 52, 15, 0, Math.PI * 2)
  x.fill()
  x.beginPath()
  x.moveTo(54, 60)
  x.lineTo(74, 60)
  x.lineTo(68, 96)
  x.lineTo(60, 96)
  x.closePath()
  x.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// شريط زاوية قطري يغلّف حافة الصندوق الرأسية، بشكل زخرفة تقليدية للصناديق
function cornerStrap(mat, height) {
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.018), mat)
  strap.rotation.y = Math.PI / 4
  return strap
}

export default function Box3D() {
  const mount = useRef(null)

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
    scene.environmentIntensity = 0.5
    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x0a0a14, 0.3))
    const key = new THREE.DirectionalLight(0xfff3e0, 2.4)
    key.position.set(-3, 4, 3.5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x6fa8ff, 1.2)
    rim.position.set(3, 1.5, -3)
    scene.add(rim)

    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55, metalness: 0.08 })
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.3, metalness: 1 })
    const lockMat = new THREE.MeshStandardMaterial({ map: lockPlateTexture(), roughness: 0.35, metalness: 0.9 })

    const W = 1.7
    const Dp = 1.05
    const baseH = 0.78
    const lidH = 0.34

    const box = new THREE.Group()
    scene.add(box)

    // جسم الصندوق
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, baseH, Dp), wood)
    base.position.y = baseH / 2
    box.add(base)

    // الغطاء (بسطح مستوٍ أنيق فوق الصندوق)
    const lid = new THREE.Group()
    const lidTop = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, lidH, Dp + 0.04), wood)
    lidTop.position.y = lidH / 2
    lid.add(lidTop)
    const lidRim = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.05, Dp - 0.03), wood)
    lidRim.position.y = -0.025
    lid.add(lidRim)
    lid.position.y = baseH
    box.add(lid)

    // شريط معدني أوسط يلتف حول الصندوق
    const bandY = baseH * 0.47
    ;[
      [W + 0.02, 0.13, Dp + 0.001, 0, 0],
      [Dp + 0.001, 0.13, W + 0.02, Math.PI / 2, 0],
    ].forEach(([w, h, , rotY]) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.025), gold)
      band.rotation.y = rotY
      band.position.y = bandY
      band.position.z = rotY ? 0 : Dp / 2 + 0.012
      band.position.x = rotY ? W / 2 + 0.012 : 0
      box.add(band.clone())
      const back = band.clone()
      back.position.z = rotY ? 0 : -(Dp / 2 + 0.012)
      back.position.x = rotY ? -(W / 2 + 0.012) : 0
      box.add(back)
    })

    // أربطة الزوايا الذهبية (أسفل وأعلى)
    const corners = [
      [-W / 2, Dp / 2],
      [W / 2, Dp / 2],
      [-W / 2, -Dp / 2],
      [W / 2, -Dp / 2],
    ]
    corners.forEach(([cx, cz]) => {
      const strap = cornerStrap(gold, baseH - 0.1)
      strap.position.set(cx, baseH / 2, cz)
      box.add(strap)
      const lidStrap = cornerStrap(gold, lidH - 0.04)
      lidStrap.position.set(cx * 0.985, baseH + lidH / 2, cz * 0.985)
      box.add(lidStrap)
    })

    // صفيحة القفل على الواجهة (فوق الشريط المعدني كمشبك حقيقي)
    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.02), gold)
    backing.position.set(0, bandY, Dp / 2 + 0.02)
    box.add(backing)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), lockMat)
    plate.position.set(0, bandY, Dp / 2 + 0.031)
    box.add(plate)

    // مقبضان جانبيان
    ;[-1, 1].forEach((side) => {
      const mount1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.1), gold)
      mount1.position.set(side * (W / 2 + 0.01), baseH * 0.6, 0.06)
      box.add(mount1)
      const mount2 = mount1.clone()
      mount2.position.z = -0.06
      box.add(mount2)
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.019, 12, 28, Math.PI), gold)
      handle.rotation.y = Math.PI / 2
      handle.position.set(side * (W / 2 + 0.01), baseH * 0.6 - 0.03, 0)
      box.add(handle)
    })

    box.position.y = -0.55

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.03, 0)
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
        const dist = Math.max(0.92 / half, 1.1 / (half * camera.aspect))
        camera.position.set(0.8, 0.4, dist)
        controls.minDistance = dist * 0.6
        controls.maxDistance = dist * 2.2
        controls.update()
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const t0 = performance.now()
    let raf = 0
    function loop() {
      const t = (performance.now() - t0) / 1000
      box.rotation.y = Math.sin(t * 0.4) * 0.08
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()
    window.__boxReady = true

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

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', padding: '12px 16px 0', fontSize: 14, opacity: 0.85 }}>اسحب بإصبعك لتدوير الصندوق</div>
      <div ref={mount} style={{ flex: 1, minHeight: 0, touchAction: 'none' }} />
    </div>
  )
}