import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { prepareVehicle } from './models'
import { resolveCircle } from './physics'
import { confiscateStolen, formatClp, game, poke, showNotice } from './store'

const CHASE_MS = 30000
const ESCAPE_DIST = 48
const TOP_SPEED = 12.2

let policeSecond = -1

function losePolice(text: string) {
  game.pursuit = null
  game.wanted = false
  policeSecond = -1
  showNotice('🏃', 'Perdiste a la policía', text, 'cash', 3200)
}

function altoBubble() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return texture
  ctx.clearRect(0, 0, 1024, 512)
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.roundRect(16, 18, 992, 360, 64)
  ctx.fill()
  ctx.fillStyle = '#ff5a4a'
  ctx.beginPath()
  ctx.roundRect(36, 38, 952, 320, 52)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.moveTo(430, 358)
  ctx.lineTo(512, 490)
  ctx.lineTo(594, 358)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.font = '700 118px Fredoka, "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('¡Alto ahí!!', 512, 198)
  texture.needsUpdate = true
  return texture
}

function caughtByPolice(job: NonNullable<typeof game.pursuit>) {
  if (job.phase === 'bust') return
  const { taken, phones } = confiscateStolen()
  job.phase = 'bust'
  job.until = performance.now() + 3000
  job.speed = 0
  game.wanted = true
  policeSecond = -1
  const loot =
    phones > 0
      ? `Te quitaron ${phones} ${phones === 1 ? 'celular' : 'celulares'} y ${formatClp(taken)}.`
      : 'Esta vez no llevabas nada robado.'
  showNotice('🚓', 'Te pilló la policía', loot, 'fire', 4200)
  poke()
}

function placePolice() {
  const tries: Array<[number, number]> = [
    [58, 0],
    [72, 0.45],
    [72, -0.45],
    [50, 0.95],
    [50, -0.95],
    [84, 0],
  ]
  let best = { x: game.x - Math.cos(game.heading) * 58, z: game.z - Math.sin(game.heading) * 58, dist: 58 }
  for (const [dist, side] of tries) {
    const aim = game.heading + side
    const placed = resolveCircle(game.x - Math.cos(aim) * dist, game.z - Math.sin(aim) * dist, 1.4)
    const away = Math.hypot(placed.x - game.x, placed.z - game.z)
    if (away >= 42 && away <= 90) return placed
    if (Math.abs(away - 62) < Math.abs(best.dist - 62)) best = { x: placed.x, z: placed.z, dist: away }
  }
  return best
}

export function Police() {
  const gltf = useGLTF('/models/police.glb', false, true)
  const car = useMemo(() => {
    const fitted = prepareVehicle(gltf.scene, 4.7, false, 0)
    fitted.object.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial
        standard.metalness = Math.min(standard.metalness ?? 0, 0.25)
        standard.roughness = Math.max(standard.roughness ?? 0.5, 0.45)
      }
    })
    return fitted
  }, [gltf.scene])
  const rig = useRef<THREE.Group>(null)
  const red = useRef<THREE.PointLight>(null)
  const blue = useRef<THREE.PointLight>(null)
  const shout = useRef<THREE.Sprite>(null)
  const alto = useMemo(() => altoBubble(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const job = game.pursuit
    const now = performance.now()
    if (!job || !game.started) {
      if (rig.current) rig.current.visible = false
      return
    }

    if (job.phase === 'bust') {
      if (rig.current) {
        rig.current.visible = true
        rig.current.position.set(job.x, 0.16, job.z)
        const face = Math.atan2(game.z - job.z, game.x - job.x)
        rig.current.rotation.y = Math.PI - face
      }
      const flash = Math.floor(now / 140) % 2 === 0
      if (red.current) red.current.intensity = flash ? 6 : 0.2
      if (blue.current) blue.current.intensity = flash ? 0.2 : 6
      if (shout.current) {
        const left = Math.max(0, job.until - now)
        const age = 1 - left / 3000
        const pop = Math.min(1, age / 0.12)
        shout.current.visible = true
        shout.current.scale.set(3.5 * pop, 1.65 * pop, 1)
        shout.current.position.y = (car.height + 1.7) + Math.sin(now / 180) * 0.06
        const material = shout.current.material as THREE.SpriteMaterial
        material.rotation = Math.sin(now / 160) * 0.08
      }
      if (now >= job.until) {
        game.pursuit = null
        game.wanted = false
        policeSecond = -1
        if (rig.current) rig.current.visible = false
        if (shout.current) shout.current.visible = false
        poke()
      }
      return
    }

    if (job.phase === 'delay') {
      if (rig.current) rig.current.visible = false
      const left = Math.ceil((job.until - now) / 1000)
      if (left !== policeSecond) {
        policeSecond = left
        game.wanted = true
        poke()
      }
      if (now < job.until) return
      const placed = placePolice()
      job.phase = 'chase'
      job.until = now + CHASE_MS
      job.x = placed.x
      job.z = placed.z
      job.heading = Math.atan2(game.z - placed.z, game.x - placed.x)
      job.speed = 9
      policeSecond = -1
      showNotice('🚓', 'La policía te vio', 'Si te alcanzan, te quitan los celulares.', 'fire', 3600)
    }

    const dist = Math.hypot(game.x - job.x, game.z - job.z)
    if (dist < 5.6) {
      caughtByPolice(job)
      return
    }
    const timeUp = now >= job.until
    if (timeUp && dist > ESCAPE_DIST) {
      losePolice('Te alejaste a tiempo.')
      return
    }
    if (now > job.until + 12000 && dist > 24) {
      losePolice('Se cansaron de buscarte.')
      return
    }

    const desired = Math.atan2(game.z - job.z, game.x - job.x)
    const turn = Math.atan2(Math.sin(desired - job.heading), Math.cos(desired - job.heading))
    job.heading += THREE.MathUtils.clamp(turn, -1.7 * dt, 1.7 * dt)
    const target = dist < 7 ? 8 : TOP_SPEED
    job.speed = THREE.MathUtils.lerp(job.speed, target, 1 - Math.exp(-1.6 * dt))
    const stepX = job.x + Math.cos(job.heading) * job.speed * dt
    const stepZ = job.z + Math.sin(job.heading) * job.speed * dt
    const next = resolveCircle(stepX, stepZ, 1.15)
    const moved = Math.hypot(next.x - job.x, next.z - job.z)
    if (moved < job.speed * dt * 0.3) job.heading += 1.4 * dt
    job.x = next.x
    job.z = next.z

    const shown = timeUp ? 0 : Math.ceil((job.until - now) / 1000)
    if (shown !== policeSecond) {
      policeSecond = shown
      poke()
    }

    if (!rig.current) return
    rig.current.visible = true
    rig.current.position.set(job.x, 0.16, job.z)
    rig.current.rotation.y = Math.PI - job.heading
    const flash = Math.floor(now / 140) % 2 === 0
    if (red.current) red.current.intensity = flash ? 6 : 0.2
    if (blue.current) blue.current.intensity = flash ? 0.2 : 6
  })

  return (
    <group ref={rig} visible={false}>
      <primitive object={car.object} />
      <mesh position={[0, car.height * 0.92, 0]}>
        <boxGeometry args={[0.7, 0.12, 0.32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <pointLight ref={red} position={[-0.22, car.height + 0.35, 0]} color="#ff2a2a" distance={16} decay={2} />
      <pointLight ref={blue} position={[0.22, car.height + 0.35, 0]} color="#3d7dff" distance={16} decay={2} />
      <sprite ref={shout} visible={false} position={[0, car.height + 1.7, 0]} scale={[3.5, 1.65, 1]}>
        <spriteMaterial map={alto} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

useGLTF.preload('/models/police.glb')
