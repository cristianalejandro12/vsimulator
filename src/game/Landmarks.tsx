import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { city } from './city'
import { upsertCollider } from './physics'

function signTexture(text: string, background: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  if (!ctx) return texture
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 1024, 256)
  ctx.fillStyle = color
  ctx.font = '700 120px Fredoka, Trebuchet MS, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 512, 132)
  texture.needsUpdate = true
  return texture
}

function Costanera({ x, z }: { x: number; z: number }) {
  const sign = useMemo(() => signTexture('COSTANERA CENTER', '#102033', '#ffffff'), [])
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 4.2, 1.2]} castShadow receiveShadow>
        <boxGeometry args={[26, 8.4, 18]} />
        <meshStandardMaterial color="#e7eef3" roughness={0.72} />
      </mesh>
      <mesh position={[0, 5.2, -7.7]}>
        <boxGeometry args={[24, 5.2, 0.25]} />
        <meshStandardMaterial color="#8fd4e4" metalness={0.2} roughness={0.25} />
      </mesh>
      <mesh position={[0, 8.7, -8.1]}>
        <planeGeometry args={[16, 1.6]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <mesh position={[1.5, 34, 0.4]} castShadow>
        <boxGeometry args={[12.5, 52, 12.5]} />
        <meshStandardMaterial color="#7ecbdc" metalness={0.22} roughness={0.28} />
      </mesh>
      {[-5.2, -2.6, 0, 2.6, 5.2].map((offset) => (
        <mesh key={offset} position={[1.5 + offset, 34, -5.95]}>
          <boxGeometry args={[0.28, 50, 0.2]} />
          <meshStandardMaterial color="#f4f7fb" />
        </mesh>
      ))}
      <mesh position={[1.5, 61.2, 0.4]}>
        <boxGeometry args={[8, 3.2, 8]} />
        <meshStandardMaterial color="#d5e4ea" />
      </mesh>
      <mesh position={[1.5, 66, 0.4]}>
        <boxGeometry args={[2.2, 6, 2.2]} />
        <meshStandardMaterial color="#123044" />
      </mesh>
      <mesh position={[1.5, 70.2, 0.4]}>
        <sphereGeometry args={[0.45, 10, 8]} />
        <meshStandardMaterial color="#ff4a3a" emissive="#ff4a3a" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function Entel({ x, z }: { x: number; z: number }) {
  const sign = useMemo(() => signTexture('ENTEL', '#0b3f86', '#ffffff'), [])
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[6.2, 7.2, 3.2, 16]} />
        <meshStandardMaterial color="#d7dde4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.5, 6.4]}>
        <planeGeometry args={[8, 1.8]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <mesh position={[0, 24, 0]} castShadow>
        <cylinderGeometry args={[2.15, 2.7, 42, 14]} />
        <meshStandardMaterial color="#f3f5f7" roughness={0.55} />
      </mesh>
      <mesh position={[0, 44.5, 0]} castShadow>
        <sphereGeometry args={[4.1, 18, 14]} />
        <meshStandardMaterial color="#e8eef3" roughness={0.4} />
      </mesh>
      <mesh position={[0, 44.5, 0]}>
        <sphereGeometry args={[2.3, 14, 10]} />
        <meshStandardMaterial color="#8fd0ea" metalness={0.15} roughness={0.25} />
      </mesh>
      <mesh position={[0, 54, 0]}>
        <cylinderGeometry args={[0.28, 0.55, 16, 8]} />
        <meshStandardMaterial color="#c5ced6" metalness={0.35} roughness={0.4} />
      </mesh>
      <mesh position={[0, 62.4, 0]}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshStandardMaterial color="#e10600" emissive="#e10600" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

export function Landmarks() {
  useLayoutEffect(() => {
    for (const spot of city.landmarks) {
      const wide = spot.id === 'costanera'
      upsertCollider({
        id: spot.id,
        x: spot.x,
        z: spot.z,
        hx: wide ? 9 : 6,
        hz: wide ? 13 : 6,
        fx: 0,
        fz: 1,
        rx: 1,
        rz: 0,
      })
    }
  }, [])

  return (
    <group>
      {city.landmarks.map((spot) =>
        spot.id === 'costanera' ? (
          <Costanera key={spot.id} x={spot.x} z={spot.z} />
        ) : (
          <Entel key={spot.id} x={spot.x} z={spot.z} />
        ),
      )}
    </group>
  )
}
