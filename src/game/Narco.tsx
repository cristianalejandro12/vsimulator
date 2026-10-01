import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { city } from './city'
import { game } from './store'

function Dealer({ x, z }: { x: number; z: number }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const root = group.current
    if (!root) return
    root.position.y = Math.sin(clock.elapsedTime * 1.6) * 0.03
    const dx = game.x - x
    const dz = game.z - z
    root.rotation.y = Math.atan2(dx, dz)
  })
  return (
    <group ref={group} position={[x, 0, z]}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 1.15, 10]} />
        <meshStandardMaterial color="#111111" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.26, 14, 12]} />
        <meshStandardMaterial color="#c68642" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.98, 0.02]} castShadow>
        <sphereGeometry args={[0.27, 12, 10]} />
        <meshStandardMaterial color="#141414" roughness={1} />
      </mesh>
      <mesh position={[0, 1.22, 0.22]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.16, 0.025, 8, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.24, 0.7, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function Narco() {
  const zone = city.narco
  const packs = useMemo(
    () =>
      [
        [0, 0, 0],
        [0.55, 0, 0.2],
        [-0.45, 0, 0.35],
        [0.15, 0.42, 0.05],
        [-0.2, 0.42, 0.28],
        [0.05, 0.82, 0.12],
      ] as Array<[number, number, number]>,
    [],
  )
  const packRoot = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const root = packRoot.current
    if (!root) return
    root.visible = game.stash?.phase === 'pickup'
    root.position.y = 0.2 + Math.sin(clock.elapsedTime * 2.2) * 0.05
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[zone.x, 0.11, zone.z]} receiveShadow>
        <planeGeometry args={[52, 52]} />
        <meshBasicMaterial color="#14110e" />
      </mesh>
      <pointLight position={[zone.x - 6, 5.2, zone.z]} color="#3dff78" intensity={4.2} distance={28} />
      <pointLight position={[zone.x + 8, 4.6, zone.z - 4]} color="#ff3b3b" intensity={3.6} distance={24} />
      <pointLight position={[zone.x, 6, zone.z + 8]} color="#5cff7a" intensity={2.4} distance={22} />
      <Dealer x={zone.talk.x} z={zone.talk.z} />
      <Dealer x={zone.talk.x - 2.4} z={zone.talk.z + 2.1} />
      <group ref={packRoot} position={[zone.stash.x, 0.2, zone.stash.z]} visible={false}>
        {packs.map(([px, py, pz], index) => (
          <mesh key={index} position={[px, py + 0.22, pz]} castShadow>
            <boxGeometry args={[0.72, 0.42, 0.5]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
