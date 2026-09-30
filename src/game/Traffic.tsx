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

function closestDistance(path: Path, x: number, z: number) {
  let best = 0
  let bestDist = Infinity
  for (let index = 0; index < path.points.length; index++) {
    const point = path.points[index]
    const dist = Math.hypot(point.x - x, point.z - z)
    if (dist < bestDist) {
      bestDist = dist
      best = path.cum[index]
    }
  }
  return best
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

const FLEET_MODELS: VehicleKey[] = ['sedan', 'taxi', 'red', 'sedan', 'taxi', 'red', 'sedan', 'taxi']

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

type Stall = { x: number; z: number; heading: number }

function stallSpots(): Stall[] {
  const spots: Stall[] = city.restaurants.map((restaurant) => ({
    x: restaurant.pickup.x + 2.6,
    z: restaurant.pickup.z + 1.8,
    heading: restaurant.yaw + Math.PI,
  }))
  for (const prop of city.props) {
    if (prop.kind !== 'pizza') continue
    spots.push({
      x: prop.x + Math.sin(prop.yaw) * 9,
      z: prop.z + Math.cos(prop.yaw) * 9,
      heading: prop.yaw,
    })
  }
  return spots.length ? spots : [{ x: city.spawn.x, z: city.spawn.z + 6, heading: 0 }]
}

type Courier = {
  mode: 'seek' | 'wait'
  until: number
  path: Path
  d: number
  x: number
  z: number
  heading: number
  park: Stall
}

function makeCouriers(): Courier[] {
  const spots = stallSpots()
  const count = Math.random() < 0.45 ? 1 : 2
  const now = performance.now()
  return Array.from({ length: count }, (_, index) => {
    const path = loopAt((index * 3 + 1) % GRID, (index * 2 + 2) % GRID)
    const distance = 24 + index * 48
    const pose = samplePath(path, distance)
    const park = spots[index % spots.length]
    const waiting = index === 1
    return {
      mode: waiting ? 'wait' : 'seek',
      until: now + (waiting ? 16000 + Math.random() * 12000 : 20000 + Math.random() * 14000),
      path,
      d: distance,
      x: waiting ? park.x : pose.x,
      z: waiting ? park.z : pose.z,
      heading: waiting ? park.heading : pose.heading,
      park,
    }
  })
}

export function Traffic() {
  const couriers = useMemo(() => makeCouriers(), [])
  const courierRefs = useRef<Array<THREE.Group | null>>([])
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
    const now = performance.now()
    const stalls = stallSpots()
    for (const courier of couriers) {
      if (now >= courier.until) {
        if (courier.mode === 'seek') {
          const next = stalls[Math.floor(Math.random() * stalls.length)]
          courier.park = next
          courier.mode = 'wait'
          courier.until = now + 12000 + Math.random() * 16000
        } else {
          courier.path = loopAt(Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID))
          courier.d = closestDistance(courier.path, courier.x, courier.z)
          courier.mode = 'seek'
          courier.until = now + 18000 + Math.random() * 16000
        }
      }
      if (courier.mode === 'seek') {
        courier.d += 11.5 * step
        const pose = samplePath(courier.path, courier.d)
        courier.x = THREE.MathUtils.damp(courier.x, pose.x, 2.4, step)
        courier.z = THREE.MathUtils.damp(courier.z, pose.z, 2.4, step)
        const turn = Math.atan2(Math.sin(pose.heading - courier.heading), Math.cos(pose.heading - courier.heading))
        courier.heading += turn * Math.min(1, step * 8)
      } else {
        courier.x = THREE.MathUtils.damp(courier.x, courier.park.x, 3.2, step)
        courier.z = THREE.MathUtils.damp(courier.z, courier.park.z, 3.2, step)
        const turn = Math.atan2(Math.sin(courier.park.heading - courier.heading), Math.cos(courier.park.heading - courier.heading))
        courier.heading += turn * Math.min(1, step * 4)
      }
      moverColliders.push(makeAxes(courier.heading, FILES.rappi.length * 0.92, FILES.rappi.width, courier.x, courier.z))
    }
    sim.forEach((car, index) => {
      const group = refs.current[index]
      if (!group) return
      const spec = FILES[car.model]
      group.position.set(car.x, spec.y, car.z)
      group.rotation.y = spec.nose - car.heading
    })
    couriers.forEach((courier, index) => {
      const group = courierRefs.current[index]
      if (!group) return
      group.position.set(courier.x, FILES.rappi.y, courier.z)
      group.rotation.y = FILES.rappi.nose - courier.heading
    })
  })

  return (
    <group>
      {sim.map((car, index) => (
        <group key={`${car.model}-${index}`} ref={(node) => { refs.current[index] = node }}>
          <VehicleModel url={FILES[car.model].url} length={FILES[car.model].length} yaw={FILES[car.model].yaw} />
        </group>
      ))}
      {couriers.map((courier, index) => (
        <group key={`rappi-${index}`} ref={(node) => { courierRefs.current[index] = node }}>
          <VehicleModel url={FILES.rappi.url} length={FILES.rappi.length} yaw={FILES.rappi.yaw} />
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
