import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { city } from './city'
import { audio } from './audio'
import { prepareVehicle } from './models'
import { overlaps } from './physics'
import { blendedLook } from './day'
import { cycleTime, game, refreshRoute, startShift, tickClock, tryInteract } from './store'

const RADIUS = 0.5

export function Player() {
  const gltf = useGLTF('/models/uber-moto.glb', false, true)
  const bike = useMemo(() => prepareVehicle(gltf.scene, 2.15, true, 0), [gltf.scene])
  const rig = useRef<THREE.Group>(null)
  const lean = useRef<THREE.Group>(null)
  const bag = useRef<THREE.Mesh>(null)
  const keys = useRef<Record<string, boolean>>({})
  const prev = useRef({ e: false, r: false, h: false, m: false, t: false })
  const hemi = useRef<THREE.HemisphereLight>(null)
  const amb = useRef<THREE.AmbientLight>(null)
  const routeTimer = useRef(0)
  const bumpTimer = useRef(0)
  const { camera, scene, gl } = useThree()
  const sun = useRef<THREE.DirectionalLight>(null)
  const look = useRef(new THREE.Vector3())
  const desired = useRef(new THREE.Vector3())
  const camHeading = useRef(game.heading)
  const camPitch = useRef(0.5)
  const camTarget = useRef(game.heading)
  const pitchTarget = useRef(0.5)
  const dragging = useRef(false)

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current[event.code] = true
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault()
    }
    const up = (event: KeyboardEvent) => {
      keys.current[event.code] = false
    }
    const blur = () => {
      keys.current = {}
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => {
    if (sun.current) scene.add(sun.current.target)
  }, [scene])

  useEffect(() => {
    const el = gl.domElement
    const down = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return
      dragging.current = true
      el.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (!dragging.current) return
      camTarget.current += event.movementX * 0.0026
      pitchTarget.current = THREE.MathUtils.clamp(pitchTarget.current + event.movementY * 0.0016, 0.22, 0.92)
    }
    const up = () => {
      dragging.current = false
    }
    const menu = (event: Event) => event.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('contextmenu', menu)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('contextmenu', menu)
    }
  }, [gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    tickClock(dt)
    const pressed = keys.current
    const eDown = !!pressed.KeyE
    const rDown = !!pressed.KeyR
    const hDown = !!pressed.KeyH
    const mDown = !!pressed.KeyM
    const tDown = !!pressed.KeyT
    if (eDown && !prev.current.e && !game.mapOpen) tryInteract()
    if (hDown && !prev.current.h) audio.horn(game.muted)
    if (tDown && !prev.current.t && game.started) cycleTime()
    if (rDown && !prev.current.r && game.started) {
      game.x = city.spawn.x
      game.z = city.spawn.z
      game.heading = city.spawn.heading
      game.speed = 0
      camHeading.current = city.spawn.heading
      camTarget.current = city.spawn.heading
      camPitch.current = 0.5
      pitchTarget.current = 0.5
    }
    prev.current = { e: eDown, r: rDown, h: hDown, m: mDown, t: tDown }

    const yawGap = Math.atan2(Math.sin(camTarget.current - camHeading.current), Math.cos(camTarget.current - camHeading.current))
    camHeading.current += yawGap * (1 - Math.exp(-2.15 * dt))
    camPitch.current = THREE.MathUtils.damp(camPitch.current, pitchTarget.current, 4.2, dt)
    game.camHeading = camHeading.current
    if (game.started && !game.mapOpen) {
      const throttle = pressed.KeyW || pressed.ArrowUp
      const brake = pressed.KeyS || pressed.ArrowDown
      const steer = (pressed.KeyD || pressed.ArrowRight ? 1 : 0) - (pressed.KeyA || pressed.ArrowLeft ? 1 : 0)
      const boost = pressed.ShiftLeft || pressed.ShiftRight
      const max = boost ? 20 : 13
      if (throttle) game.speed = Math.min(max, game.speed + 22 * dt)
      else if (brake) game.speed = Math.max(-6, game.speed - 28 * dt)
      else game.speed -= Math.sign(game.speed) * Math.min(Math.abs(game.speed), 14 * dt)

      const moving = Math.abs(game.speed) > 0.15
      const headingBefore = game.heading
      if (moving) game.heading += steer * 2.05 * dt * Math.sign(game.speed)
      else if (steer) game.heading += steer * 1.15 * dt
      const spun = Math.atan2(Math.sin(game.heading - headingBefore), Math.cos(game.heading - headingBefore))
      camTarget.current += spun

      if (moving) {
        const mx = Math.cos(game.heading)
        const mz = Math.sin(game.heading)
        const step = game.speed * dt
        const nx = game.x + mx * step
        const nz = game.z + mz * step
        if (!overlaps(nx, nz, RADIUS)) {
          game.x = nx
          game.z = nz
        } else {
          if (!overlaps(nx, game.z, RADIUS)) game.x = nx
          if (!overlaps(game.x, nz, RADIUS)) game.z = nz
          else {
            bumpTimer.current -= dt
            if (bumpTimer.current <= 0) {
              audio.bump(game.muted)
              bumpTimer.current = 0.35
            }
          }
        }
      }

      if (lean.current) {
        const bank = THREE.MathUtils.clamp(steer * 0.18, -0.22, 0.22)
        lean.current.rotation.x = THREE.MathUtils.damp(lean.current.rotation.x, moving || steer ? bank : 0, 8, dt)
        lean.current.rotation.y = 0
        lean.current.rotation.z = 0
      }
    }

    audio.update(game.speed, game.muted || !game.started)

    if (rig.current) {
      rig.current.position.set(game.x, 0.28, game.z)
      rig.current.rotation.y = Math.PI - game.heading
    }
    if (bag.current) {
      bag.current.visible = game.carrying
      const material = bag.current.material as THREE.MeshStandardMaterial
      if (game.mission) material.color.set(game.mission.color)
    }

    const mission = game.mission
    if (mission && mission.phase !== 'cooldown') {
      const target = mission.phase === 'pickup' ? mission.pickup : mission.drop
      game.distance = Math.hypot(game.x - target.x, game.z - target.z)
    }
    routeTimer.current += dt
    if (routeTimer.current > 0.28) {
      routeTimer.current = 0
      refreshRoute()
    }

    const pitch = game.started ? camPitch.current : 0.42
    const dist = game.started ? 9.5 : 13
    const lookAhead = game.started ? 7 : 4
    const fx = Math.cos(camHeading.current)
    const fz = Math.sin(camHeading.current)
    const back = Math.cos(pitch) * dist
    desired.current.set(game.x - fx * back, 1.2 + Math.sin(pitch) * dist, game.z - fz * back)
    look.current.set(game.x + fx * lookAhead, 1.15, game.z + fz * lookAhead)
    camera.position.lerp(desired.current, 1 - Math.exp(-5 * dt))
    if (camera.position.y < 1.1) camera.position.y = 1.1
    camera.lookAt(look.current)
    const persp = camera as THREE.PerspectiveCamera
    const fov = 64
    if (Math.abs(persp.fov - fov) > 0.2) {
      persp.fov = fov
      persp.updateProjectionMatrix()
    }

    const light = blendedLook(game.clock)
    if (hemi.current) {
      hemi.current.color.set(light.hemiSky)
      hemi.current.groundColor.set(light.hemiGround)
      hemi.current.intensity = light.hemi
    }
    if (amb.current) amb.current.intensity = light.amb
    if (sun.current) {
      sun.current.color.set(light.sun)
      sun.current.intensity = light.sunI
      sun.current.position.set(game.x + light.az, light.elev, game.z + 14)
      sun.current.target.position.set(game.x, 0, game.z)
      sun.current.target.updateMatrixWorld()
    }
  })

  return (
    <group>
      <hemisphereLight ref={hemi} args={['#b9dcff', '#c6b496', 0.78]} />
      <ambientLight ref={amb} intensity={0.28} />
      <directionalLight
        ref={sun}
        castShadow
        intensity={1.65}
        color="#fff1dc"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={2}
        shadow-camera-far={80}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-bias={-0.00035}
        shadow-normalBias={0.05}
      />
      <group ref={rig}>
        <group ref={lean}>
          <primitive object={bike.object} />
          <mesh position={[bike.length * 0.46, bike.height * 0.38, bike.width * 0.28]}>
            <boxGeometry args={[0.12, 0.1, 0.1]} />
            <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[bike.length * 0.46, bike.height * 0.38, -bike.width * 0.28]}>
            <boxGeometry args={[0.12, 0.1, 0.1]} />
            <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={0.7} />
          </mesh>
          <mesh position={[-bike.length * 0.46, bike.height * 0.36, 0]}>
            <boxGeometry args={[0.1, 0.08, bike.width * 0.45]} />
            <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={0.45} />
          </mesh>
          <mesh ref={bag} position={[-bike.length * 0.28, bike.height * 0.62, 0]} visible={false} castShadow>
            <boxGeometry args={[0.42, 0.34, 0.32]} />
            <meshStandardMaterial color="#da291c" roughness={0.55} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function bootAudioAndShift() {
  audio.start()
  startShift()
}
