import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { GRID, LANE_OFFSET, city, roadCenterX, roadCenterZ, type VehicleKey } from './city'
import { VehicleModel } from './models'
import { route } from './gps'
import { game, poke, snatchMission } from './store'
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

function nearestLoop(x: number, z: number) {
  let bestI = 0
  let bestJ = 0
  let best = Infinity
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const cx = (roadCenterX(i) + roadCenterX(i + 1)) / 2
      const cz = (roadCenterZ(j) + roadCenterZ(j + 1)) / 2
      const dist = Math.hypot(cx - x, cz - z)
      if (dist < best) {
        best = dist
        bestI = i
        bestJ = j
      }
    }
  }
  return loopAt(bestI, bestJ)
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
  mode: 'wait' | 'seek' | 'haul' | 'rival'
  until: number
  path: Path
  d: number
  x: number
  z: number
  heading: number
  park: Stall
  speed: number
  shoutUntil: number
  nextShout: number
  pace: number
  hoverY: number
  dropping: boolean
  racePath: { x: number; z: number }[]
  raceI: number
}

function vainaBubble() {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 288
  const ctx = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  if (!ctx) return texture
  ctx.clearRect(0, 0, 768, 288)
  ctx.fillStyle = '#ff4d8d'
  ctx.beginPath()
  ctx.roundRect(28, 22, 712, 188, 36)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.roundRect(16, 10, 712, 188, 36)
  ctx.fill()
  ctx.fillStyle = '#ffe56a'
  ctx.beginPath()
  ctx.roundRect(28, 22, 688, 164, 28)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.moveTo(348, 186)
  ctx.lineTo(384, 248)
  ctx.lineTo(420, 186)
  ctx.fill()
  ctx.fillStyle = '#ffe56a'
  ctx.beginPath()
  ctx.moveTo(356, 176)
  ctx.lineTo(384, 228)
  ctx.lineTo(412, 176)
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1a1a1a'
  ctx.fillStyle = '#1a1a1a'
  ctx.lineWidth = 10
  ctx.font = '800 42px Fredoka, "Trebuchet MS", sans-serif'
  ctx.strokeText('es mucha la vaina', 372, 78)
  ctx.fillText('es mucha la vaina', 372, 78)
  ctx.font = '800 48px Fredoka, "Trebuchet MS", sans-serif'
  ctx.fillStyle = '#ff4d1a'
  ctx.strokeText('marico !!!!!!!!', 372, 132)
  ctx.fillText('marico !!!!!!!!', 372, 132)
  texture.needsUpdate = true
  return texture
}

function makeCouriers(): Courier[] {
  const spots = stallSpots()
  const count = 5 + Math.floor(Math.random() * 2)
  const now = performance.now()
  const modes: Array<Courier['mode']> = ['wait', 'seek', 'haul', 'seek', 'wait', 'haul']
  return Array.from({ length: count }, (_, index) => {
    const path = loopAt((index * 3 + 1) % GRID, (index * 2 + 2) % GRID)
    const distance = 18 + index * 31
    const pose = samplePath(path, distance)
    const park = spots[index % spots.length]
    const mode = modes[index % modes.length]
    const waiting = mode === 'wait'
    return {
      mode,
      until: now + (waiting ? 10000 + Math.random() * 14000 : 14000 + Math.random() * 18000),
      path,
      d: distance,
      x: waiting ? park.x : pose.x,
      z: waiting ? park.z : pose.z,
      heading: waiting ? park.heading : pose.heading,
      park,
      speed: mode === 'haul' ? 12.4 : 11.2,
      shoutUntil: 0,
      nextShout: now + 6000 + index * 3500 + Math.random() * 8000,
      pace: 0.78 + Math.random() * 0.28,
      hoverY: FILES.rappi.y,
      dropping: false,
      racePath: [],
      raceI: 0,
    }
  })
}

export function Traffic() {
  const couriers = useMemo(() => makeCouriers(), [])
  const courierRefs = useRef<Array<THREE.Group | null>>([])
  const shoutRefs = useRef<Array<THREE.Sprite | null>>([])
  const dropRefs = useRef<Array<THREE.Mesh | null>>([])
  const shoutTex = useMemo(() => vainaBubble(), [])
  const rivalId = useRef(-1)
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
    const mission = game.mission
    const racing = !!(mission && mission.phase === 'pickup' && mission.contested)
    if (racing) {
      if (rivalId.current < 0 || !couriers[rivalId.current] || couriers[rivalId.current].mode !== 'rival') {
        rivalId.current = Math.floor(Math.random() * couriers.length)
        const rival = couriers[rivalId.current]
        const fx = Math.cos(game.heading)
        const fz = Math.sin(game.heading)
        const rx = Math.sin(game.heading)
        const rz = -Math.cos(game.heading)
        const ahead = 8.2 + Math.random() * 3.4
        const side = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 2)
        rival.x = game.x + fx * ahead + rx * side
        rival.z = game.z + fz * ahead + rz * side
        rival.heading = game.heading
        rival.mode = 'rival'
        rival.pace = Math.random() < 0.34 ? 65 / 3.6 : 60 / 3.6
        rival.until = now + 80000
        rival.hoverY = 26
        rival.dropping = true
        rival.racePath = []
        rival.raceI = 0
        poke()
      }
      const rival = couriers[rivalId.current]
      if (rival) {
        rival.speed = rival.pace
        let toShop = Math.hypot(rival.x - mission!.pickup.x, rival.z - mission!.pickup.z)
        if (rival.racePath.length) {
          toShop = 0
          let cx = rival.x
          let cz = rival.z
          for (let i = rival.raceI; i < rival.racePath.length; i++) {
            const node = rival.racePath[i]
            toShop += Math.hypot(node.x - cx, node.z - cz)
            cx = node.x
            cz = node.z
          }
        }
        const toYou = Math.hypot(rival.x - game.x, rival.z - game.z)
        game.rival = { x: rival.x, z: rival.z, toShop, toYou, dropping: rival.dropping, kph: Math.round(rival.speed * 3.6) }
      }
    } else if (rivalId.current >= 0) {
      const rival = couriers[rivalId.current]
      if (rival && rival.mode === 'rival') {
        rival.path = nearestLoop(rival.x, rival.z)
        rival.d = closestDistance(rival.path, rival.x, rival.z)
        rival.mode = 'seek'
        rival.speed = 11.2
        rival.hoverY = FILES.rappi.y
        rival.dropping = false
        rival.racePath = []
        rival.raceI = 0
        rival.until = now + 12000 + Math.random() * 10000
      }
      rivalId.current = -1
      game.rival = null
    } else {
      game.rival = null
    }

    for (const courier of couriers) {
      if (courier.mode !== 'rival' && now >= courier.until) {
        if (courier.mode === 'wait') {
          courier.path = nearestLoop(courier.x, courier.z)
          courier.d = closestDistance(courier.path, courier.x, courier.z)
          courier.mode = Math.random() < 0.55 ? 'haul' : 'seek'
          courier.speed = courier.mode === 'haul' ? 12.6 : 11.1
          courier.until = now + 16000 + Math.random() * 18000
        } else if (courier.mode === 'seek') {
          const next = stalls[Math.floor(Math.random() * stalls.length)]
          courier.park = next
          courier.mode = 'wait'
          courier.until = now + 9000 + Math.random() * 14000
        } else {
          const next = stalls[Math.floor(Math.random() * stalls.length)]
          courier.park = next
          courier.mode = Math.random() < 0.4 ? 'wait' : 'seek'
          if (courier.mode === 'seek') {
            courier.path = nearestLoop(courier.x, courier.z)
            courier.d = closestDistance(courier.path, courier.x, courier.z)
            courier.speed = 11.1
            courier.until = now + 14000 + Math.random() * 16000
          } else {
            courier.until = now + 10000 + Math.random() * 12000
          }
        }
      }
      if (courier.mode === 'rival' && mission) {
        if (courier.dropping) {
          courier.hoverY = THREE.MathUtils.damp(courier.hoverY, FILES.rappi.y, 5.8, step)
          if (courier.hoverY <= FILES.rappi.y + 0.28) {
            courier.hoverY = FILES.rappi.y
            courier.dropping = false
            courier.racePath = route(courier.x, courier.z, mission.pickup.x, mission.pickup.z)
            courier.raceI = 0
            poke()
          }
        } else {
          if (!courier.racePath.length) {
            courier.racePath = route(courier.x, courier.z, mission.pickup.x, mission.pickup.z)
            courier.raceI = 0
          }
          const points = courier.racePath
          while (courier.raceI < points.length - 1) {
            const node = points[courier.raceI]
            if (Math.hypot(courier.x - node.x, courier.z - node.z) < 4.2) courier.raceI += 1
            else break
          }
          const target = points[Math.min(courier.raceI, points.length - 1)]
          const dx = target.x - courier.x
          const dz = target.z - courier.z
          const dist = Math.hypot(dx, dz) || 1
          const want = Math.atan2(dz, dx)
          const turn = Math.atan2(Math.sin(want - courier.heading), Math.cos(want - courier.heading))
          courier.heading += turn * Math.min(1, step * 5.2)
          const move = Math.min(dist, courier.speed * step)
          courier.x += Math.cos(courier.heading) * move
          courier.z += Math.sin(courier.heading) * move
          const toDoor = Math.hypot(courier.x - mission.pickup.x, courier.z - mission.pickup.z)
          if (toDoor < 3.8 && mission.phase === 'pickup') {
            snatchMission('¡Un Rappi se llevó el pedido!')
            courier.mode = 'haul'
            courier.speed = 12.2
            courier.path = nearestLoop(courier.x, courier.z)
            courier.d = closestDistance(courier.path, courier.x, courier.z)
            courier.racePath = []
            courier.until = now + 16000
            rivalId.current = -1
            game.rival = null
          }
        }
      } else if (courier.mode === 'seek' || courier.mode === 'haul') {
        courier.d += Math.min(courier.speed * step, 0.85)
        const pose = samplePath(courier.path, courier.d)
        const gap = Math.hypot(pose.x - courier.x, pose.z - courier.z)
        if (gap > 18) {
          courier.path = nearestLoop(courier.x, courier.z)
          courier.d = closestDistance(courier.path, courier.x, courier.z)
          const near = samplePath(courier.path, courier.d)
          const slide = Math.min(gap, courier.speed * step)
          const nx = near.x - courier.x
          const nz = near.z - courier.z
          const nd = Math.hypot(nx, nz) || 1
          courier.x += (nx / nd) * slide
          courier.z += (nz / nd) * slide
        } else {
          const slide = Math.min(gap, courier.speed * step)
          if (gap > 0.001) {
            courier.x += ((pose.x - courier.x) / gap) * slide
            courier.z += ((pose.z - courier.z) / gap) * slide
          } else {
            courier.x = pose.x
            courier.z = pose.z
          }
          const turn = Math.atan2(Math.sin(pose.heading - courier.heading), Math.cos(pose.heading - courier.heading))
          courier.heading += turn * Math.min(1, step * 8)
        }
      } else if (courier.mode === 'wait') {
        const gap = Math.hypot(courier.park.x - courier.x, courier.park.z - courier.z)
        const slide = Math.min(gap, 8 * step)
        if (gap > 0.001) {
          courier.x += ((courier.park.x - courier.x) / gap) * slide
          courier.z += ((courier.park.z - courier.z) / gap) * slide
        }
        const turn = Math.atan2(Math.sin(courier.park.heading - courier.heading), Math.cos(courier.park.heading - courier.heading))
        courier.heading += turn * Math.min(1, step * 4)
      }
      if (now >= courier.nextShout && Math.random() < 0.7) {
        courier.shoutUntil = now + 2400
        courier.nextShout = now + 7000 + Math.random() * 10000
      } else if (now >= courier.nextShout) {
        courier.nextShout = now + 4000 + Math.random() * 7000
      }
      if (!courier.dropping) {
        moverColliders.push(makeAxes(courier.heading, FILES.rappi.length * 0.92, FILES.rappi.width, courier.x, courier.z))
      }
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
      group.position.set(courier.x, courier.hoverY, courier.z)
      group.rotation.y = FILES.rappi.nose - courier.heading
      if (courier.dropping) group.rotation.y += now * 0.004
      const shout = shoutRefs.current[index]
      if (shout) {
        const live = now < courier.shoutUntil
        shout.visible = live
        if (live) {
          const t = 1 - (courier.shoutUntil - now) / 2400
          const pop = t < 0.18 ? 0.45 + t * 4.2 : t > 0.82 ? 1 - (t - 0.82) * 2.4 : 1 + Math.sin(now * 0.02) * 0.04
          shout.scale.set(3.15 * pop, 1.22 * pop, 1)
          shout.position.set(0, 2.05 + Math.sin(now * 0.012) * 0.05, 0)
        }
      }
      const ring = dropRefs.current[index]
      if (ring) {
        ring.visible = courier.dropping
        ring.position.y = 0.06 - courier.hoverY
        const pulse = 1.1 + Math.sin(now * 0.012) * 0.18
        ring.scale.set(pulse, pulse, 1)
      }
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
          <sprite
            ref={(node) => { shoutRefs.current[index] = node }}
            scale={[3.15, 1.22, 1]}
            position={[0, 2.05, 0]}
            visible={false}
          >
            <spriteMaterial map={shoutTex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </sprite>
          <mesh
            ref={(node) => { dropRefs.current[index] = node }}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.55, 1.9, 28]} />
            <meshBasicMaterial color="#ffe56a" transparent opacity={0.78} depthWrite={false} />
          </mesh>
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
