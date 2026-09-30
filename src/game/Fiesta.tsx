import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { city, type Venue } from './city'
import { game } from './store'

function flagTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return texture
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 300, 100)
  ctx.fillStyle = '#d52b1e'
  ctx.fillRect(0, 100, 300, 100)
  ctx.fillStyle = '#0039a6'
  ctx.fillRect(0, 0, 100, 100)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  const cx = 50
  const cy = 50
  const outer = 22
  const inner = 9
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  texture.needsUpdate = true
  return texture
}

function signTexture(name: string, color: string, accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return texture
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, 512, 160)
  ctx.fillStyle = color
  ctx.fillRect(10, 10, 492, 140)
  ctx.fillStyle = accent
  ctx.font = '700 42px Fredoka, Trebuchet MS, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 256, 82)
  texture.needsUpdate = true
  return texture
}

export function Flags() {
  const map = useMemo(() => flagTexture(), [])
  const cloth = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    cloth.current.forEach((mesh, index) => {
      if (!mesh) return
      mesh.rotation.y = Math.sin(time * 1.7 + index) * 0.18
      mesh.rotation.z = Math.sin(time * 2.3 + index * 0.4) * 0.08
    })
  })

  return (
    <group>
      {city.flags.map((flag, index) => (
        <group key={`${flag.x}:${flag.z}`} position={[flag.x, 0, flag.z]} rotation={[0, flag.rot, 0]}>
          <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.055, 3.4, 6]} />
            <meshStandardMaterial color="#f7f4ee" />
          </mesh>
          <mesh
            ref={(node) => {
              cloth.current[index] = node
            }}
            position={[0.62, 3.05, 0]}
          >
            <planeGeometry args={[1.2, 0.8]} />
            <meshBasicMaterial map={map} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Flames({ venueId, strong }: { venueId: string; strong: boolean }) {
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const hot = game.burnFx?.id === venueId && performance.now() < game.burnFx.until
    const time = clock.elapsedTime
    const gain = hot ? 1 : strong ? 0.55 : 0
    if (group.current) group.current.visible = gain > 0
    group.current?.children.forEach((child, index) => {
      if (child.type === 'PointLight') return
      const wave = 0.75 + Math.sin(time * (7 + index) + index) * 0.28
      child.scale.set(gain * wave, gain * (1.15 + Math.sin(time * 11 + index) * 0.35), gain * wave)
      child.position.y = 0.4 + Math.sin(time * 6 + index) * 0.2
    })
    if (light.current) light.current.intensity = gain * (2.2 + Math.sin(time * 14) * 0.7)
  })

  return (
    <group ref={group} position={[0, 3.2, 0]}>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} position={[(index - 2.5) * 1.15, 0.6, (index % 2) * 0.7 - 0.3]}>
          <coneGeometry args={[0.42, 1.7, 6]} />
          <meshBasicMaterial color={index % 2 ? '#ffb703' : '#ff4d00'} transparent opacity={0.92} />
        </mesh>
      ))}
      <pointLight ref={light} color="#ff7a18" distance={14} decay={2} intensity={0} />
    </group>
  )
}

function Guest({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.55, 4, 8]} />
        <meshStandardMaterial color="#243044" />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.16, 12, 10]} />
        <meshStandardMaterial color="#e0aa78" />
      </mesh>
    </group>
  )
}

function VenueMesh({ venue }: { venue: Venue }) {
  const [charred, setCharred] = useState(false)
  const sign = useMemo(() => signTexture(venue.name, venue.color, venue.accent), [venue.accent, venue.color, venue.name])
  const wall = charred ? '#2a2420' : '#f4efe6'
  const trim = charred ? '#1a1614' : venue.color

  useFrame(() => {
    if (!charred && game.burned.includes(venue.id)) setCharred(true)
  })

  return (
    <group position={[venue.bx, 0, venue.bz]} rotation={[0, venue.yaw, 0]}>
      <mesh position={[0, 0.08, -venue.bd / 2 - 1.5]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[venue.bw + 1.2, 3.2]} />
        <meshStandardMaterial color={charred ? '#3a302c' : venue.accent} />
      </mesh>
      <mesh position={[0, 2.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[venue.bw, 4.3, venue.bd]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      <mesh position={[0, 4.45, 0]}>
        <boxGeometry args={[venue.bw + 0.4, 0.28, venue.bd + 0.4]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh position={[0, 1.15, -venue.bd / 2 - 0.04]}>
        <boxGeometry args={[1.5, 2.2, 0.12]} />
        <meshStandardMaterial color={charred ? '#1a120e' : '#2c2622'} />
      </mesh>
      <mesh position={[0, 5.15, -venue.bd / 2 - 0.08]}>
        <planeGeometry args={[venue.bw * 0.92, 1.15]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {[-2.4, 2.4].map((offset) => (
        <mesh key={offset} position={[offset, 2.5, -venue.bd / 2 - 0.05]}>
          <boxGeometry args={[1.3, 1.15, 0.08]} />
          <meshStandardMaterial color={charred ? '#140e0c' : '#9fd4ee'} emissive={charred ? '#000000' : venue.accent} emissiveIntensity={charred ? 0 : 0.35} />
        </mesh>
      ))}
      {!charred && (
        <>
          <Guest position={[-1.6, 0, -venue.bd / 2 - 1.7]} />
          <Guest position={[1.5, 0, -venue.bd / 2 - 2.1]} />
          <mesh position={[-3.2, 3.4, -1.2]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshBasicMaterial color="#ffe56a" />
          </mesh>
          <mesh position={[3.2, 3.4, -1.2]}>
            <sphereGeometry args={[0.16, 10, 8]} />
            <meshBasicMaterial color="#ff4d8d" />
          </mesh>
        </>
      )}
      {charred && <Flames venueId={venue.id} strong />}
    </group>
  )
}

function PlaceSigns() {
  const maps = useMemo(() => city.signs.map((sign) => signTexture(sign.text, sign.color, sign.accent)), [])
  return (
    <group>
      {city.signs.map((sign, index) => (
        <mesh key={`${sign.text}-${index}`} position={[sign.x, sign.y, sign.z]}>
          <planeGeometry args={[Math.min(9.5, 1.4 + sign.text.length * 0.48), 1.45]} />
          <meshBasicMaterial map={maps[index]} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function Fiesta() {
  return (
    <group>
      {city.venues.map((venue) => (
        <VenueMesh key={venue.id} venue={venue} />
      ))}
      <PlaceSigns />
    </group>
  )
}
