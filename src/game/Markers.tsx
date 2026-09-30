import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { game } from './store'

const ARROW = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(0.75, 0)
  shape.lineTo(-0.48, 0.4)
  shape.lineTo(-0.2, 0)
  shape.lineTo(-0.48, -0.4)
  shape.closePath()
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  return geometry
})()

const SPACING = 7.6
const FLOW = 2.15

function alongPath(points: { x: number; z: number }[], distance: number) {
  let walked = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]
    const b = points[index]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 0.05) continue
    if (walked + len >= distance) {
      const t = (distance - walked) / len
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: Math.atan2(b.z - a.z, b.x - a.x),
      }
    }
    walked += len
  }
  return null
}

function playerAlong(points: { x: number; z: number }[]) {
  let best = 0
  let bestDist = Infinity
  let walked = 0
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]
    const b = points[index]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz
    const len = Math.sqrt(len2)
    if (len < 0.05) continue
    let t = ((game.x - a.x) * dx + (game.z - a.z) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const px = a.x + dx * t
    const pz = a.z + dz * t
    const dist = (px - game.x) ** 2 + (pz - game.z) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = walked + len * t
    }
    walked += len
  }
  return best
}

function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + delta * (1 - Math.exp(-lambda * dt))
}

type ArrowSlot = { x: number; z: number; heading: number; placed: boolean }

export function Markers() {
  const arrows = useRef<THREE.InstancedMesh>(null)
  const circle = useRef<THREE.Mesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const slots = useMemo<ArrowSlot[]>(() => Array.from({ length: 70 }, () => ({ x: 0, z: 0, heading: 0, placed: false })), [])

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const mesh = arrows.current
    if (mesh) {
      const active = game.mission && game.mission.phase !== 'cooldown' && game.path.length > 1
      const origin = active ? playerAlong(game.path) : 0
      const flow = (clock.elapsedTime * FLOW) % SPACING
      let count = 0
      if (active) {
        for (let index = 0; index < slots.length; index++) {
          const point = alongPath(game.path, origin + 6.5 + flow + index * SPACING)
          if (!point) break
          const slot = slots[index]
          const jump = Math.hypot(point.x - slot.x, point.z - slot.z)
          if (!slot.placed || jump > 3.2) {
            slot.x = point.x
            slot.z = point.z
            slot.heading = point.heading
            slot.placed = true
          } else {
            const follow = 1 - Math.exp(-12 * dt)
            slot.x += (point.x - slot.x) * follow
            slot.z += (point.z - slot.z) * follow
            slot.heading = dampAngle(slot.heading, point.heading, 4.2, dt)
          }
          const dist = Math.hypot(slot.x - game.x, slot.z - game.z)
          const fade = THREE.MathUtils.smoothstep(dist, 4.8, 9)
          if (fade < 0.02) continue
          const bob = Math.sin(clock.elapsedTime * 2.1 + index * 0.55) * 0.025
          dummy.position.set(slot.x, 0.5 + bob, slot.z)
          dummy.rotation.set(0, -slot.heading, 0)
          const size = 1.45 * fade
          dummy.scale.set(size, size, size)
          dummy.updateMatrix()
          mesh.setMatrixAt(count, dummy.matrix)
          count += 1
        }
      }
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
    }

    const disc = circle.current
    if (!disc) return
    const mission = game.mission
    const target = mission && mission.phase !== 'cooldown'
      ? mission.phase === 'pickup' ? mission.pickup : mission.drop
      : null
    if (!target) {
      disc.visible = false
      return
    }
    disc.visible = true
    disc.position.set(target.x, 0.46, target.z)
    const material = disc.material as THREE.MeshBasicMaterial
    material.color.set(mission?.phase === 'deliver' ? '#37d67a' : '#ffe14a')
  })

  return (
    <group>
      <instancedMesh ref={arrows} args={[ARROW, undefined, 90]} frustumCulled={false}>
        <meshBasicMaterial color="#ffbf1a" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <mesh ref={circle} rotation-x={-Math.PI / 2} visible={false}>
        <circleGeometry args={[1.7, 40]} />
        <meshBasicMaterial color="#ffe14a" transparent opacity={0.72} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
