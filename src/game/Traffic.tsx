import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { GRID, LANE_OFFSET, city, roadCenterX, roadCenterZ, type VehicleKey } from './city'
import { VehicleModel } from './models'
import { game } from './store'
import { makeAxes, moverColliders } from './physics'

const FILES: Record<VehicleKey, { url: string; length: number; width: number; y: number; yaw: number; nose: number }> = {
  sedan: { url: '/models/sedan.glb', length: 4.55, width: 1.85, y: 0.28, yaw: 0, nose: Math.PI },
  red: { url: '/models/red-sedan.glb', length: 4.55, width: 1.85, y: 0.28, yaw: Math.PI, nose: 0 },
  taxi: { url: '/models/taxi.glb', length: 4.6, width: 1.85, y: 0.28, yaw: 0, nose: Math.PI },
  truck: { url: '/models/gasco.glb', length: 8.1, width: 2.45, y: 0.28, yaw: Math.PI, nose: 0 },
  rappi: { url: '/models/rappi-moto.glb', length: 2.25, width: 0.85, y: 0.28, yaw: 0, nose: 0 },
  bus: { url: '/models/transantiago.glb', length: 10.4, width: 2.55, y: 0.32, yaw: 0, nose: Math.PI },
}

type Pose = { x: number; z: number; heading: number }
type Path = { points: Pose[]; cum: number[]; length: number }

const TURN = 7

function pushLine(points: Pose[], x0: number, z0: number, x1: number, z1: number, heading: number) {
  const length = Math.hypot(x1 - x0, z1 - z0)
  const steps = Math.max(1, Math.ceil(length / 3))
  for (let step = 0; step < steps; step++) {
    const t = step / steps
    points.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, heading })
  }
}

function pushArc(points: Pose[], cx: number, cz: number, radius: number, a0: number, a1: number) {
  const sweep = a1 - a0
  const steps = Math.max(4, Math.ceil((Math.abs(sweep) * radius) / 2))
  const dir = Math.sign(sweep) || 1
  for (let step = 0; step < steps; step++) {
    const angle = a0 + sweep * (step / steps)
    points.push({
      x: cx + radius * Math.cos(angle),
      z: cz + radius * Math.sin(angle),
      heading: Math.atan2(dir * Math.cos(angle), dir * -Math.sin(angle)),
    })
  }
}

function blockLoop(i: number, j: number) {
  const lane = LANE_OFFSET
  const x0 = roadCenterX(i)
  const x1 = roadCenterX(i + 1)
  const z0 = roadCenterZ(j)
  const z1 = roadCenterZ(j + 1)
  const points: Pose[] = []
  pushLine(points, x1 - lane - TURN, z0 + lane, x0 + lane + TURN, z0 + lane, Math.PI)
  pushArc(points, x0 + lane + TURN, z0 + lane + TURN, TURN, -Math.PI / 2, -Math.PI)
  pushLine(points, x0 + lane, z0 + lane + TURN, x0 + lane, z1 - lane - TURN, Math.PI / 2)
  pushArc(points, x0 + lane + TURN, z1 - lane - TURN, TURN, Math.PI, Math.PI / 2)
  pushLine(points, x0 + lane + TURN, z1 - lane, x1 - lane - TURN, z1 - lane, 0)
  pushArc(points, x1 - lane - TURN, z1 - lane - TURN, TURN, Math.PI / 2, 0)
  pushLine(points, x1 - lane, z1 - lane - TURN, x1 - lane, z0 + lane + TURN, -Math.PI / 2)
  pushArc(points, x1 - lane - TURN, z0 + lane + TURN, TURN, 0, -Math.PI / 2)
  const cum = [0]
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]
    const point = points[index]
    cum.push(cum[index - 1] + Math.hypot(point.x - previous.x, point.z - previous.z))
  }
  const last = points[points.length - 1]
  const first = points[0]
  cum.push(cum[cum.length - 1] + Math.hypot(first.x - last.x, first.z - last.z))
  return { points, cum, length: cum[cum.length - 1] }
}

function samplePath(path: Path, distance: number): Pose {
  const count = path.points.length
  let cursor = distance % path.length
  if (cursor < 0) cursor += path.length
  let index = 0
  while (index < count - 1 && path.cum[index + 1] < cursor) index += 1
  const span = path.cum[index + 1] - path.cum[index] || 1
  const t = (cursor - path.cum[index]) / span
  const from = path.points[index]
  const to = path.points[(index + 1) % count]
  const turn = Math.atan2(Math.sin(to.heading - from.heading), Math.cos(to.heading - from.heading))
  return {
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    heading: from.heading + turn * t,
  }
}

const LOOPS = new Map<string, Path>()
function loopAt(i: number, j: number) {
  const key = `${i},${j}`
  const cached = LOOPS.get(key)
  if (cached) return cached
  const built = blockLoop(i, j)
  LOOPS.set(key, built)
  return built
}

type SimCar = {
  model: VehicleKey
  path: Path
  length: number
  width: number
  d: number
  speed: number
  base: number
  x: number
  z: number
  heading: number
}

const FLEET_MODELS: VehicleKey[] = ['sedan', 'taxi', 'red', 'rappi', 'sedan', 'taxi', 'rappi', 'red']

const FLEET: Array<{ i: number; j: number; model: VehicleKey; d: number; speed: number }> = []
for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    if ((i + j * 2) % 3 !== 0) continue
    const index = FLEET.length
    const model = index === 4 ? 'truck' : FLEET_MODELS[index % FLEET_MODELS.length]
    FLEET.push({
      i,
      j,
      model,
      d: 12 + ((index * 37) % 110),
      speed: model === 'truck' ? 8 : model === 'rappi' ? 13 : 10.6 + (index % 4) * 0.35,
    })
  }
}
FLEET.push(
  { i: 1, j: 2, model: 'bus', d: 18, speed: 7.2 },
  { i: 6, j: 4, model: 'bus', d: 80, speed: 7.5 },
)

export function Traffic() {
  const sim = useMemo<SimCar[]>(() => {
    return FLEET.map((item) => {
      const path = loopAt(item.i, item.j)
      const spec = FILES[item.model]
      const pose = samplePath(path, item.d)
      return {
        model: item.model,
        path,
        length: spec.length,
        width: spec.width,
        d: item.d,
        speed: item.speed,
        base: item.speed,
        x: pose.x,
        z: pose.z,
        heading: pose.heading,
      }
    })
  }, [])
  const refs = useRef<Array<THREE.Group | null>>([])

  useFrame((_, dt) => {
    moverColliders.length = 0
    const step = Math.min(dt, 0.05)
    for (let carIndex = 0; carIndex < sim.length; carIndex++) {
      const car = sim[carIndex]
      const dx = game.x - car.x
      const dz = game.z - car.z
      const dist = Math.hypot(dx, dz)
      const ahead = dx * Math.cos(car.heading) + dz * Math.sin(car.heading)
      const fx = Math.cos(car.heading)
      const fz = Math.sin(car.heading)
      let blocked = false
      let followCap = car.base
      for (let otherIndex = 0; otherIndex < sim.length; otherIndex++) {
        if (otherIndex === carIndex) continue
        const other = sim[otherIndex]
        const relX = other.x - car.x
        const relZ = other.z - car.z
        const forward = relX * fx + relZ * fz
        const side = relX * Math.sin(car.heading) - relZ * Math.cos(car.heading)
        const reach = (car.length + other.length) * 0.5 + 5
        const wide = (car.width + other.width) * 0.5 + 0.7
        if (forward < 0.3 || forward > reach || Math.abs(side) > wide) continue
        const align = fx * Math.cos(other.heading) + fz * Math.sin(other.heading)
        if (align > 0.45) {
          followCap = Math.min(followCap, Math.max(0, other.speed * 0.92))
          if (forward < (car.length + other.length) * 0.28 + 2.8) blocked = true
        } else if (carIndex > otherIndex) {
          blocked = true
        }
      }
      if (blocked) car.speed = 0
      else if (ahead > 0 && ahead < car.length * 0.5 + 8 && dist < 14) car.speed = Math.min(car.speed, Math.max(0, Math.abs(game.speed) * 0.7))
      else {
        car.speed = THREE.MathUtils.lerp(car.speed, car.base, 1 - Math.exp(-1.4 * step))
        car.speed = Math.min(car.speed, followCap)
      }
      if (!blocked) car.d += car.speed * step
      const pose = samplePath(car.path, car.d)
      car.x = pose.x
      car.z = pose.z
      const turn = Math.atan2(Math.sin(pose.heading - car.heading), Math.cos(pose.heading - car.heading))
      car.heading += turn * Math.min(1, step * 24)
      moverColliders.push(makeAxes(car.heading, car.length * 0.92, car.width, car.x, car.z))
    }
    sim.forEach((car, index) => {
      const group = refs.current[index]
      if (!group) return
      const spec = FILES[car.model]
      group.position.set(car.x, spec.y, car.z)
      group.rotation.y = spec.nose - car.heading
    })
  })

  return (
    <group>
      {sim.map((car, index) => (
        <group key={`${car.model}-${index}`} ref={(node) => { refs.current[index] = node }}>
          <VehicleModel url={FILES[car.model].url} length={FILES[car.model].length} yaw={FILES[car.model].yaw} />
        </group>
      ))}
      {city.parked.map((car, index) => (
        <group key={`park-${index}`} position={[car.x, FILES[car.model].y, car.z]} rotation={[0, car.heading, 0]}>
          <VehicleModel url={FILES[car.model].url} length={FILES[car.model].length} yaw={FILES[car.model].yaw} />
        </group>
      ))}
    </group>
  )
}

useGLTF.preload('/models/transantiago.glb')
