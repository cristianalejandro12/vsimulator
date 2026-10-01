import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { GRID, LANE_OFFSET, ROAD, SPAN, roadCenterX, roadCenterZ, toWorld } from './city'
import { eatCan, game } from './store'

type Can = {
  x: number
  z: number
  yaw: number
  born: number
  eatAt: number
}

const COUNT = 12
const cans: Can[] = []

function randomSpot(): { x: number; z: number; yaw: number } {
  if (Math.random() < 0.5) {
    const i = Math.floor(Math.random() * (GRID + 1))
    const x = roadCenterX(i) + (Math.random() < 0.5 ? LANE_OFFSET : -LANE_OFFSET)
    const z = toWorld(ROAD + Math.random() * (SPAN - ROAD * 2))
    return { x, z, yaw: Math.random() * Math.PI * 2 }
  }
  const j = Math.floor(Math.random() * (GRID + 1))
  const z = roadCenterZ(j) + (Math.random() < 0.5 ? LANE_OFFSET : -LANE_OFFSET)
  const x = toWorld(ROAD + Math.random() * (SPAN - ROAD * 2))
  return { x, z, yaw: Math.random() * Math.PI * 2 }
}

function fillCans() {
  if (cans.length) return
  const now = performance.now()
  for (let index = 0; index < COUNT; index++) {
    const spot = randomSpot()
    cans.push({ ...spot, born: now - 800 - Math.random() * 2000, eatAt: 0 })
  }
}

export function nearbyCans(range = 90) {
  const rangeSq = range * range
  const spots: { x: number; z: number }[] = []
  for (const can of cans) {
    if (can.eatAt) continue
    const dx = can.x - game.x
    const dz = can.z - game.z
    if (dx * dx + dz * dz > rangeSq) continue
    spots.push({ x: can.x, z: can.z })
  }
  return spots
}

function prepareCan(source: THREE.Object3D) {
  const root = source.clone(true)
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.frustumCulled = false
  })
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.scale.setScalar(1)
  root.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const scale = 1.52 / Math.max(size.y, 0.001)
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.set(-center.x, -box.min.y, -center.z)
  return root
}

export function Cans() {
  fillCans()
  const { scene } = useGLTF('/models/can.glb', false, true)
  const prepared = useMemo(() => prepareCan(scene), [scene])
  const refs = useRef<Array<THREE.Group | null>>([])

  useFrame(() => {
    const now = performance.now()
    for (let index = 0; index < cans.length; index++) {
      const can = cans[index]
      const group = refs.current[index]
      if (!group) continue
      if (can.eatAt) {
        const t = Math.min(1, (now - can.eatAt) / 340)
        const lift = t < 0.45 ? 0.85 + t * 2.4 : 1.93 - (t - 0.45) * 2.6
        group.visible = true
        group.position.set(
          can.x + (game.x - can.x) * t,
          lift,
          can.z + (game.z - can.z) * t,
        )
        group.rotation.y = can.yaw + t * 14
        group.rotation.x = t * 1.8
        const pop = t < 0.22 ? 1 + t * 1.8 : Math.max(0, 1.4 - (t - 0.22) * 1.8)
        group.scale.setScalar(pop)
        if (t >= 1) {
          const next = randomSpot()
          can.x = next.x
          can.z = next.z
          can.yaw = next.yaw
          can.eatAt = 0
          can.born = now
        }
        continue
      }
      group.visible = true
      group.position.set(can.x, 0.85, can.z)
      group.rotation.set(0, can.yaw + now * 0.0012, 0)
      const age = (now - can.born) / 420
      let pop = 1
      if (age < 1) {
        pop = age < 0.38 ? 0.2 + age * 2.6 : age < 0.7 ? 1.18 - (age - 0.38) * 0.4 : 1
      }
      group.scale.setScalar(pop)
      if (game.started && Math.hypot(can.x - game.x, can.z - game.z) < 2.45) {
        can.eatAt = now
        eatCan()
      }
    }
  })

  return (
    <group>
      {cans.map((_, index) => (
        <group key={index} ref={(node) => { refs.current[index] = node }} position={[cans[index].x, 0.85, cans[index].z]}>
          <primitive object={index === 0 ? prepared : prepared.clone()} />
        </group>
      ))}
    </group>
  )
}

useGLTF.preload('/models/can.glb')
