import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SIDEWALK, city } from './city'
import { game, stealPhone } from './store'

const SHIRTS = ['#3d7ea6', '#c45a4a', '#6a8f4e', '#8a6bb5', '#d08a3a', '#4a6d8c', '#b56b8a', '#5c7a6a']
const SKINS = ['#f0c7a0', '#e0aa78', '#c68642', '#8d5524', '#f3d0b0', '#a56b3c', '#d9a066', '#6b3e26']
const HAIR = ['#1c1410', '#3b2a1a', '#111111', '#5c3a22', '#2a2118', '#141414', '#4a3020', '#1a120e']
const PANTS = ['#243044', '#1e2a3a', '#3a342c', '#2c3344', '#1a2740', '#34302c', '#2a3148', '#3a2c28']

type Person = {
  id: number
  stop: number
  x: number
  z: number
  yaw: number
  phone: boolean
  hat: boolean
  bag: boolean
  shirt: string
  skin: string
  hair: string
  pants: string
}

const TO_CURB = SIDEWALK * 0.62 - 0.32

const phoneCool = new Map<number, number>()
const linger = new Map<number, number>()
const hidingUntil = new Map<number, number>()

function onSidewalk(x: number, z: number) {
  for (const quad of city.sidewalk) {
    const x0 = Math.min(quad.x0, quad.x1)
    const x1 = Math.max(quad.x0, quad.x1)
    const z0 = Math.min(quad.z0, quad.z1)
    const z1 = Math.max(quad.z0, quad.z1)
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true
  }
  return false
}

function stopHiding(stop: number, now: number) {
  return now < (hidingUntil.get(stop) ?? 0) || (linger.get(stop) ?? 0) >= 5
}

export function nearbyPhones(range = 78) {
  const now = performance.now()
  const rangeSq = range * range
  const spots: { x: number; z: number }[] = []
  for (const person of PEOPLE) {
    if (!person.phone) continue
    if (stopHiding(person.stop, now)) continue
    if (now < (phoneCool.get(person.id) ?? 0)) continue
    const dx = person.x - game.x
    const dz = person.z - game.z
    if (dx * dx + dz * dz > rangeSq) continue
    spots.push({ x: person.x, z: person.z })
  }
  return spots
}

const PEOPLE: Person[] = city.stops.flatMap((stop, index) => {
  let x = stop.x
  let z = stop.z
  let yaw = 0
  let vertical = false
  if (Math.abs(stop.rot + Math.PI / 2) < 0.2) {
    x -= TO_CURB
    yaw = -Math.PI / 2
    vertical = true
  } else if (Math.abs(stop.rot - Math.PI / 2) < 0.2) {
    x += TO_CURB
    yaw = Math.PI / 2
    vertical = true
  } else if (Math.abs(stop.rot) < 0.2) {
    z += TO_CURB
    yaw = 0
  } else {
    z -= TO_CURB
    yaw = Math.PI
  }
  return [1.15, -1.2].map((offset, slot) => {
    const n = index * 2 + slot
    return {
      id: n,
      stop: index,
      x: x + (vertical ? 0 : offset),
      z: z + (vertical ? offset : 0),
      yaw,
      phone: n % 4 !== 3,
      hat: n % 5 < 2,
      bag: n % 4 === 0,
      shirt: SHIRTS[n % SHIRTS.length],
      skin: SKINS[n % SKINS.length],
      hair: HAIR[n % HAIR.length],
      pants: PANTS[n % PANTS.length],
    }
  })
})

function phoneBubble() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return texture
  ctx.clearRect(0, 0, 512, 512)
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.roundRect(28, 36, 456, 340, 72)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(44, 52, 424, 308, 60)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.moveTo(196, 356)
  ctx.lineTo(256, 470)
  ctx.lineTo(318, 356)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(214, 348)
  ctx.lineTo(256, 438)
  ctx.lineTo(300, 348)
  ctx.fill()
  ctx.font = '250px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('📱', 256, 200)
  texture.needsUpdate = true
  return texture
}

function questionBubble() {
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
  ctx.fillStyle = '#ffe56a'
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
  ctx.font = '700 92px Fredoka, "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('¡Me robaron', 512, 145)
  ctx.fillText('mi celular!', 512, 255)
  texture.needsUpdate = true
  return texture
}

function warnBubble() {
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
  ctx.fillStyle = '#ffffff'
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
  ctx.font = '700 78px Fredoka, "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Cuidado con', 512, 145)
  ctx.fillText('la moto...', 512, 250)
  texture.needsUpdate = true
  return texture
}

function PersonBody({
  person,
  phone,
  armRef,
  phoneRef,
}: {
  person: Person
  phone: boolean
  armRef: (node: THREE.Group | null) => void
  phoneRef: (node: THREE.Mesh | null) => void
}) {
  return (
    <group>
      <mesh position={[-0.1, 0.04, 0.04]} castShadow>
        <boxGeometry args={[0.14, 0.07, 0.26]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[0.1, 0.04, 0.04]} castShadow>
        <boxGeometry args={[0.14, 0.07, 0.26]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[-0.1, 0.09, 0.02]}>
        <boxGeometry args={[0.15, 0.05, 0.16]} />
        <meshStandardMaterial color={person.shirt} />
      </mesh>
      <mesh position={[0.1, 0.09, 0.02]}>
        <boxGeometry args={[0.15, 0.05, 0.16]} />
        <meshStandardMaterial color={person.shirt} />
      </mesh>
      <mesh position={[-0.09, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.42, 4, 8]} />
        <meshStandardMaterial color={person.pants} />
      </mesh>
      <mesh position={[0.09, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.42, 4, 8]} />
        <meshStandardMaterial color={person.pants} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshStandardMaterial color={person.pants} />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.34, 4, 10]} />
        <meshStandardMaterial color={person.shirt} />
      </mesh>
      <mesh position={[0, 1.28, 0.08]}>
        <boxGeometry args={[0.22, 0.06, 0.08]} />
        <meshStandardMaterial color="#f4f7fb" />
      </mesh>
      <group position={[-0.24, 1.2, 0]} rotation={[0.2, 0, 0.18]}>
        <mesh position={[0, -0.2, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.28, 3, 6]} />
          <meshStandardMaterial color={person.shirt} />
        </mesh>
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color={person.skin} />
        </mesh>
      </group>
      {person.bag && (
        <mesh position={[0, 1.05, -0.16]} castShadow>
          <boxGeometry args={[0.22, 0.26, 0.1]} />
          <meshStandardMaterial color="#2a3344" />
        </mesh>
      )}
      <group ref={armRef} position={[0.22, 1.22, 0.04]} rotation={[0.7, 0, -0.85]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.2, 3, 6]} />
          <meshStandardMaterial color={person.shirt} />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color={person.skin} />
        </mesh>
        {phone && (
          <mesh ref={phoneRef} position={[0.02, -0.4, 0.04]}>
            <boxGeometry args={[0.08, 0.14, 0.02]} />
            <meshStandardMaterial color="#161616" emissive="#9ad8ff" emissiveIntensity={0.85} />
          </mesh>
        )}
      </group>
      <mesh position={[0, 1.34, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.08, 8]} />
        <meshStandardMaterial color={person.skin} />
      </mesh>
      <mesh position={[0, 1.52, 0.02]} castShadow>
        <sphereGeometry args={[0.155, 16, 14]} />
        <meshStandardMaterial color={person.skin} />
      </mesh>
      <mesh position={[0, 1.66, -0.03]} scale={[1.05, 0.55, 1.02]}>
        <sphereGeometry args={[0.15, 14, 10]} />
        <meshStandardMaterial color={person.hair} />
      </mesh>
      {person.hat && (
        <group position={[0, 1.66, 0.01]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.16, 0.17, 0.08, 12]} />
            <meshStandardMaterial color={person.shirt} />
          </mesh>
          <mesh position={[0, 0.0, 0.02]} rotation={[0.15, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.025, 14]} />
            <meshStandardMaterial color="#1c1c1c" />
          </mesh>
        </group>
      )}
      <mesh position={[-0.055, 1.6, 0.12]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.055, 0.012, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.055, 1.6, 0.12]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.055, 0.012, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[-0.055, 1.55, 0.13]}>
        <sphereGeometry args={[0.02, 8, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.055, 1.55, 0.13]}>
        <sphereGeometry args={[0.02, 8, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 1.5, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[0.018, 6, 4]} />
        <meshStandardMaterial color={person.skin} />
      </mesh>
    </group>
  )
}

export function Phones() {
  const bubble = useMemo(() => phoneBubble(), [])
  const questions = useMemo(() => questionBubble(), [])
  const warning = useMemo(() => warnBubble(), [])
  const sprites = useRef<(THREE.Sprite | null)[]>([])
  const bodies = useRef<(THREE.Group | null)[]>([])
  const arms = useRef<(THREE.Group | null)[]>([])
  const handPhones = useRef<(THREE.Mesh | null)[]>([])
  const marks = useRef<THREE.Sprite>(null)
  const warn = useRef<THREE.Sprite>(null)
  const markAt = useRef({ x: 0, z: 0, until: 0 })
  const warnAt = useRef({ x: 0, z: 0, until: 0 })

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime
    const dt = Math.min(delta, 0.05)
    const now = performance.now()
    if (game.started) {
      const walking = onSidewalk(game.x, game.z)
      const seen = new Set<number>()
      for (const person of PEOPLE) {
        if (seen.has(person.stop)) continue
        seen.add(person.stop)
        const near = walking && Math.hypot(game.x - person.x, game.z - person.z) < 6.2
        const prev = linger.get(person.stop) ?? 0
        const next = near ? prev + dt : 0
        linger.set(person.stop, next)
        if (next >= 5 && prev < 5) {
          hidingUntil.set(person.stop, now + 18000)
          warnAt.current = { x: person.x, z: person.z, until: now + 4600 }
        }
      }
    }

    PEOPLE.forEach((person, index) => {
      const guarded = stopHiding(person.stop, now)
      const body = bodies.current[index]
      if (body) {
        body.position.y = 0.5 + Math.sin(time * 1.8 + index) * 0.012
        body.rotation.z = Math.sin(time * 1.3 + index) * 0.03
        const face = Math.atan2(game.x - person.x, game.z - person.z)
        const want = guarded ? face - person.yaw : 0
        const look = person.yaw + (guarded ? THREE.MathUtils.clamp(want, -0.7, 0.7) : 0)
        body.rotation.y = THREE.MathUtils.damp(body.rotation.y, look, 4, dt)
      }
      const arm = arms.current[index]
      if (arm) arm.rotation.x = THREE.MathUtils.damp(arm.rotation.x, guarded ? 1.45 : 0.7, 7, dt)
      const hand = handPhones.current[index]
      if (hand) hand.visible = person.phone && !guarded && now >= (phoneCool.get(person.id) ?? 0)
      const sprite = sprites.current[index]
      if (!sprite) return
      const until = phoneCool.get(person.id) ?? 0
      const show = person.phone && now > until && !guarded
      sprite.visible = show
      if (show) {
        const pulse = 1.45 + Math.sin(time * 4 + index) * 0.08
        sprite.scale.set(pulse, pulse, 1)
        sprite.position.y = 2.45 + Math.sin(time * 2.4 + index) * 0.04
      }
    })

    const mark = markAt.current
    if (marks.current) {
      const show = now < mark.until
      marks.current.visible = show
      if (show) {
        const age = 1 - (mark.until - now) / 5200
        const pop = Math.min(1, age / 0.14)
        const bounce = age < 0.22 ? Math.sin((age / 0.22) * Math.PI) : 0
        const w = 3.35 * pop * (1 + Math.sin(time * 8) * 0.06)
        const h = 1.7 * pop * (1 + Math.sin(time * 8 + 0.4) * 0.07)
        marks.current.scale.set(w, h, 1)
        marks.current.position.set(mark.x, 3.15 + bounce * 0.45 + Math.sin(time * 5) * 0.06, mark.z)
        const material = marks.current.material as THREE.SpriteMaterial
        material.rotation = Math.sin(time * 9) * 0.16 * (1 - age * 0.45)
      }
    }

    const caution = warnAt.current
    if (warn.current) {
      const show = now < caution.until
      warn.current.visible = show
      if (show) {
        const age = 1 - (caution.until - now) / 4600
        const pop = Math.min(1, age / 0.14)
        warn.current.scale.set(3.4 * pop, 1.65 * pop, 1)
        warn.current.position.set(caution.x, 3.2 + Math.sin(time * 5) * 0.05, caution.z)
        const material = warn.current.material as THREE.SpriteMaterial
        material.rotation = Math.sin(time * 7) * 0.1
      }
    }

    if (!game.started) return

    for (const person of PEOPLE) {
      if (!person.phone) continue
      if (stopHiding(person.stop, now)) continue
      if (now < (phoneCool.get(person.id) ?? 0)) continue
      if (Math.hypot(game.x - person.x, game.z - person.z) > 2.3) continue
      phoneCool.set(person.id, now + 28000)
      markAt.current = { x: person.x, z: person.z, until: now + 5200 }
      stealPhone()
      break
    }
  })

  return (
    <group>
      {PEOPLE.map((person, index) => (
        <group
          key={index}
          ref={(node) => {
            bodies.current[index] = node
          }}
          position={[person.x, 0.5, person.z]}
          rotation={[0, person.yaw, 0]}
        >
          <PersonBody
            person={person}
            phone={person.phone}
            armRef={(node) => {
              arms.current[index] = node
            }}
            phoneRef={(node) => {
              handPhones.current[index] = node
            }}
          />
          <sprite
            ref={(node) => {
              sprites.current[index] = node
            }}
            position={[0, 2.45, 0]}
            scale={[1.45, 1.45, 1]}
            visible={person.phone}
          >
            <spriteMaterial map={bubble} transparent depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
      <sprite ref={marks} visible={false} position={[0, 3.15, 0]} scale={[3.35, 1.7, 1]}>
        <spriteMaterial map={questions} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <sprite ref={warn} visible={false} position={[0, 3.2, 0]} scale={[3.4, 1.65, 1]}>
        <spriteMaterial map={warning} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}
