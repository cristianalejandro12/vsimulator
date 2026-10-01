import { addStaticColliders, makeAxes, type Collider } from './physics'

export const GRID = 8
export const BLOCK = 54
export const ROAD = 14
export const CELL = BLOCK + ROAD
export const SPAN = GRID * CELL + ROAD
export const SIDEWALK = 2.55
export const LANE_OFFSET = 1.75
export const PARK_OFFSET = 3.45

export function nodesAt() {
  return GRID + 1
}

export function toWorld(value: number) {
  return value - SPAN / 2
}

export function roadCenterX(i: number) {
  return toWorld(i * CELL + ROAD / 2)
}

export function roadCenterZ(j: number) {
  return toWorld(j * CELL + ROAD / 2)
}

export const H_STREETS = [
  'Av. Matta',
  'Av. Grecia',
  'Av. Irarrázaval',
  'Av. Departamental',
  'Av. Vicuña Mackenna',
  'Calle Condell',
  'Av. Pajaritos',
  'Av. Apoquindo',
  'Gran Avenida',
]
export const V_STREETS = [
  'Av. Independencia',
  'Av. Recoleta',
  'Av. Brasil',
  'Av. Santa Rosa',
  'Av. Matucana',
  'Av. Tobalaba',
  'Av. La Florida',
  'Av. Las Condes',
  'Av. Providencia',
]

const WALLS = ['#f6e27a', '#f4a4b8', '#8fd4c1', '#7eb6e8', '#f0a06a', '#c9b6f2', '#f7f4ef', '#9ccc7a', '#f2c1a0', '#6ec4d4', '#e07a7a', '#efe6c8']
const DOORS = ['#6e432e', '#4e3528', '#7a5340', '#314155', '#5c3a32']
const ROOFS = ['#c4523a', '#3d6ea8', '#5c8a4a', '#6b5344']

function shade(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16)
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * factor)))
  return `#${[channel(16), channel(8), channel(0)].map((part) => part.toString(16).padStart(2, '0')).join('')}`
}

export type Xform = {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rot: number
  color: string
}

export type House = {
  address: string
  delivery: { x: number; z: number }
}

export type BuildingDrop = {
  address: string
  delivery: { x: number; z: number }
}

export type Venue = {
  id: string
  name: string
  x: number
  z: number
  yaw: number
  color: string
  accent: string
  bx: number
  bz: number
  bw: number
  bd: number
}

export type FlagSpot = { x: number; z: number; rot: number }

export type PropKind = 'horizon' | 'panel' | 'pizza'

export type Landmark = {
  id: 'entel' | 'costanera'
  x: number
  z: number
}

export type CityProp = {
  id: string
  kind: PropKind
  x: number
  z: number
  yaw: number
}

export type PlaceSign = {
  x: number
  y: number
  z: number
  text: string
  color: string
  accent: string
}

export type Lane = {
  id: string
  x0: number
  z0: number
  x1: number
  z1: number
  heading: number
  length: number
}

export type ParkedCar = {
  x: number
  z: number
  heading: number
  model: VehicleKey
}

export type VehicleKey = 'sedan' | 'red' | 'taxi' | 'truck' | 'rappi' | 'bus'

export type Restaurant = {
  id: 'mcdonalds' | 'kfc' | 'burgerking'
  name: string
  url: string
  color: string
  sign: string
  x: number
  z: number
  yaw: number
  width: number
  depth: number
  pickup: { x: number; z: number }
  stall: { x: number; z: number }
}

export type Quad = { x0: number; z0: number; x1: number; z1: number; y: number }

export type City = {
  grass: Quad[]
  asphalt: Quad[]
  sidewalk: Quad[]
  marks: Quad[]
  yellow: Quad[]
  walls: Xform[]
  roofs: Xform[]
  doors: Xform[]
  windows: Xform[]
  frames: Xform[]
  tanks: Xform[]
  fences: Xform[]
  extras: Xform[]
  trunks: Xform[]
  crowns: Xform[]
  poles: Xform[]
  lampHeads: Xform[]
  houses: House[]
  venues: Venue[]
  flags: FlagSpot[]
  pitches: { x: number; z: number }[]
  signs: PlaceSign[]
  props: CityProp[]
  landmarks: Landmark[]
  buildingDrops: BuildingDrop[]
  colliders: Collider[]
  restaurants: Restaurant[]
  lanes: Lane[]
  parked: ParkedCar[]
  spawn: { x: number; z: number; heading: number }
  stops: { x: number; z: number; rot: number }[]
}

function makeRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function blockRect(ix: number, iz: number) {
  const x0 = toWorld(ix * CELL + ROAD)
  const z0 = toWorld(iz * CELL + ROAD)
  return { x0, z0, x1: x0 + BLOCK, z1: z0 + BLOCK }
}

function pushBox(list: Xform[], x: number, y: number, z: number, sx: number, sy: number, sz: number, rot: number, color: string) {
  list.push({ x, y, z, sx, sy, sz, rot, color })
}

export function createCity(): City {
  const rng = makeRng(42)
  const city: City = {
    grass: [],
    asphalt: [],
    sidewalk: [],
    marks: [],
    yellow: [],
    walls: [],
    roofs: [],
    doors: [],
    windows: [],
    frames: [],
    tanks: [],
    fences: [],
    extras: [],
    trunks: [],
    crowns: [],
    poles: [],
    lampHeads: [],
    houses: [],
    venues: [],
    flags: [],
    pitches: [],
    signs: [],
    props: [],
    landmarks: [],
    buildingDrops: [],
    colliders: [],
    restaurants: [],
    lanes: [],
    parked: [],
    spawn: {
      x: roadCenterX(Math.floor(GRID / 2)) + LANE_OFFSET,
      z: roadCenterZ(Math.floor(GRID / 2)) - 18,
      heading: Math.PI / 2,
    },
    stops: [],
  }

  buildGround(city)
  const restaurantBlocks = new Set(['1,1', '3,2', '0,3'])

  const placeBlock = (ix: number, iz: number) => {
    const key = `${ix},${iz}`
    const edges: Array<'n' | 's' | 'e' | 'w'> = restaurantBlocks.has(key) ? ['n'] : ['n', 's', 'e', 'w']
    for (const edge of edges) addHouses(city, rng, ix, iz, edge)
  }
  for (let iz = 0; iz < 4; iz++) {
    for (let ix = 0; ix < 4; ix++) placeBlock(ix, iz)
  }
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      if (ix < 4 && iz < 4) continue
      placeBlock(ix, iz)
    }
  }

  addRestaurant(city, {
    id: 'mcdonalds',
    name: "McDonald's",
    url: '/models/mcdonalds.glb',
    color: '#da291c',
    sign: '#ffc72c',
    ix: 1,
    iz: 1,
    yaw: Math.PI,
  })
  addRestaurant(city, {
    id: 'kfc',
    name: 'KFC',
    url: '/models/kfc.glb',
    color: '#e4002b',
    sign: '#ffffff',
    ix: 3,
    iz: 2,
    yaw: Math.PI,
  })
  addRestaurant(city, {
    id: 'burgerking',
    name: 'Burger King',
    url: '/models/burgerking.glb',
    color: '#d62300',
    sign: '#ff8733',
    ix: 0,
    iz: 3,
    yaw: Math.PI,
  })

  addTreesAndLamps(city)
  addBusStops(city)
  addBarriers(city)
  buildLanes(city)
  addParked(city, rng)
  addFiesta(city)
  addProps(city)
  addLandmarks(city)
  return city
}

function buildGround(city: City) {
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const rect = blockRect(ix, iz)
      city.grass.push({ x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: rect.z1, y: 0 })
    }
  }

  for (let i = 0; i <= GRID; i++) {
    const x0 = toWorld(i * CELL)
    const x1 = toWorld(i * CELL + ROAD)
    for (let j = 0; j < GRID; j++) {
      const z0 = toWorld(j * CELL + ROAD)
      const z1 = toWorld((j + 1) * CELL)
      city.asphalt.push({ x0, z0, x1, z1, y: 0.02 })
    }
  }

  for (let j = 0; j <= GRID; j++) {
    const z0 = toWorld(j * CELL)
    const z1 = toWorld(j * CELL + ROAD)
    city.asphalt.push({ x0: toWorld(0), z0, x1: toWorld(SPAN), z1, y: 0.02 })
  }

  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const rect = blockRect(ix, iz)
      city.sidewalk.push({ x0: rect.x0, z0: rect.z0 - SIDEWALK, x1: rect.x1, z1: rect.z0, y: 0.045 })
      city.sidewalk.push({ x0: rect.x0, z0: rect.z1, x1: rect.x1, z1: rect.z1 + SIDEWALK, y: 0.045 })
      city.sidewalk.push({ x0: rect.x0 - SIDEWALK, z0: rect.z0, x1: rect.x0, z1: rect.z1, y: 0.045 })
      city.sidewalk.push({ x0: rect.x1, z0: rect.z0, x1: rect.x1 + SIDEWALK, z1: rect.z1, y: 0.045 })
    }
  }

  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const x = toWorld(i * CELL)
      const z = toWorld(j * CELL)
      city.sidewalk.push({ x0: x, z0: z, x1: x + SIDEWALK, z1: z + SIDEWALK, y: 0.045 })
      city.sidewalk.push({ x0: x + ROAD - SIDEWALK, z0: z, x1: x + ROAD, z1: z + SIDEWALK, y: 0.045 })
      city.sidewalk.push({ x0: x, z0: z + ROAD - SIDEWALK, x1: x + SIDEWALK, z1: z + ROAD, y: 0.045 })
      city.sidewalk.push({ x0: x + ROAD - SIDEWALK, z0: z + ROAD - SIDEWALK, x1: x + ROAD, z1: z + ROAD, y: 0.045 })
    }
  }

  for (let i = 0; i <= GRID; i++) {
    const x = roadCenterX(i)
    const left = toWorld(i * CELL + SIDEWALK + 0.15)
    const right = toWorld(i * CELL + ROAD - SIDEWALK - 0.15)
    for (let j = 0; j < GRID; j++) {
      const z0 = toWorld(j * CELL + ROAD + 1.5)
      const z1 = toWorld((j + 1) * CELL - 1.5)
      addCenterDashes(city, x, z0, x, z1, true)
      addSolidLine(city, left, z0, left, z1, true)
      addSolidLine(city, right, z0, right, z1, true)
    }
  }
  for (let j = 0; j <= GRID; j++) {
    const z = roadCenterZ(j)
    const south = toWorld(j * CELL + SIDEWALK + 0.15)
    const north = toWorld(j * CELL + ROAD - SIDEWALK - 0.15)
    for (let i = 0; i < GRID; i++) {
      const x0 = toWorld(i * CELL + ROAD + 1.5)
      const x1 = toWorld((i + 1) * CELL - 1.5)
      addCenterDashes(city, x0, z, x1, z, false)
      addSolidLine(city, x0, south, x1, south, false)
      addSolidLine(city, x0, north, x1, north, false)
    }
  }

  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      if (i !== 2 && i !== 5 && j !== 2 && j !== 5) continue
      addCrosswalk(city, i, j)
    }
  }
}

function addCenterDashes(city: City, x0: number, z0: number, x1: number, z1: number, vertical: boolean) {
  const length = Math.hypot(x1 - x0, z1 - z0)
  const steps = Math.max(1, Math.floor(length / 6.2))
  for (let step = 0; step < steps; step++) {
    const t = (step + 0.5) / steps
    const x = x0 + (x1 - x0) * t
    const z = z0 + (z1 - z0) * t
    if (vertical) city.yellow.push({ x0: x - 0.28, z0: z - 1.7, x1: x + 0.28, z1: z + 1.7, y: 0 })
    else city.yellow.push({ x0: x - 1.7, z0: z - 0.28, x1: x + 1.7, z1: z + 0.28, y: 0 })
  }
}

function addSolidLine(city: City, x0: number, z0: number, x1: number, z1: number, vertical: boolean) {
  if (vertical) city.marks.push({ x0: x0 - 0.18, z0, x1: x0 + 0.18, z1, y: 0 })
  else city.marks.push({ x0, z0: z0 - 0.18, x1, z1: z0 + 0.18, y: 0 })
}

function addCrosswalk(city: City, i: number, j: number) {
  const cx = roadCenterX(i)
  const cz = roadCenterZ(j)
  const arms = [
    { x: cx, z: cz - 4.6, vertical: false },
    { x: cx, z: cz + 4.6, vertical: false },
    { x: cx - 4.6, z: cz, vertical: true },
    { x: cx + 4.6, z: cz, vertical: true },
  ]
  for (const arm of arms) {
    for (let stripe = -2; stripe <= 2; stripe++) {
      if (arm.vertical) {
        city.marks.push({
          x0: arm.x - 1.3,
          z0: arm.z + stripe * 0.85 - 0.22,
          x1: arm.x + 1.3,
          z1: arm.z + stripe * 0.85 + 0.22,
          y: 0,
        })
      } else {
        city.marks.push({
          x0: arm.x + stripe * 0.85 - 0.22,
          z0: arm.z - 1.3,
          x1: arm.x + stripe * 0.85 + 0.22,
          z1: arm.z + 1.3,
          y: 0,
        })
      }
    }
  }
}

function addHouses(city: City, rng: () => number, ix: number, iz: number, edge: 'n' | 's' | 'e' | 'w') {
  const rect = blockRect(ix, iz)
  const facing = edge === 's' ? -Math.PI / 2 : edge === 'n' ? Math.PI / 2 : edge === 'w' ? Math.PI : 0
  const fx = Math.cos(facing)
  const fz = Math.sin(facing)
  const rx = fz
  const rz = -fx
  let cursor = 13

  while (cursor < BLOCK - 13) {
    const width = 8.2 + rng() * 3.3
    if (cursor + width > BLOCK - 12.2) break
    const along = cursor + width / 2
    cursor += width + 1.5 + rng() * 2.1
    const yard = 4.1 + rng() * 1.4
    const depth = 7.4 + rng() * 1.8
    const floors = rng() > 0.48 ? 2 : 1
    const wall = WALLS[Math.floor(rng() * WALLS.length)]
    const doorColor = DOORS[Math.floor(rng() * DOORS.length)]
    const roof = ROOFS[Math.floor(rng() * ROOFS.length)]
    const garage = floors === 1 && rng() > 0.62

    let ex = 0
    let ez = 0
    if (edge === 's') {
      ex = rect.x0 + along
      ez = rect.z0
    } else if (edge === 'n') {
      ex = rect.x0 + along
      ez = rect.z1
    } else if (edge === 'w') {
      ex = rect.x0
      ez = rect.z0 + along
    } else {
      ex = rect.x1
      ez = rect.z0 + along
    }

    const facadeX = ex - fx * yard
    const facadeZ = ez - fz * yard
    const cx = facadeX - fx * (depth / 2)
    const cz = facadeZ - fz * (depth / 2)
    const height = floors === 2 ? 6.15 : 3.2

    pushBox(city.extras, cx, 0.18, cz, depth + 0.22, 0.36, width + 0.22, facing, shade(wall, 0.55))
    pushBox(city.walls, cx, height / 2 + 0.12, cz, depth, height, width, facing, wall)
    pushBox(city.walls, cx, 0.48, cz, depth + 0.06, 0.42, width + 0.06, facing, shade(wall, 0.62))
    pushBox(city.extras, cx, height + 0.02, cz, depth + 0.16, 0.16, width + 0.16, facing, '#f7f4ee')
    pushBox(city.roofs, cx, height + 0.34, cz, depth + 0.85, 0.28, width + 0.85, facing, roof)
    pushBox(city.roofs, cx, height + 0.56, cz, depth * 0.72, 0.22, width * 0.72, facing, shade(roof, 0.78))
    pushBox(city.extras, facadeX + fx * 0.42, 0.1, facadeZ + fz * 0.42, 0.7, 0.2, Math.min(1.5, width * 0.28), facing, '#d7d0c4')
    pushBox(city.roofs, facadeX + fx * 1.15, 2.42, facadeZ + fz * 1.15, 1.55, 0.1, Math.min(width * 0.55, 3.4), facing, roof)
    pushBox(city.extras, facadeX + fx * 1.7 + rx * 1.05, 1.2, facadeZ + fz * 1.7 + rz * 1.05, 0.16, 2.15, 0.16, facing, '#f4f0e8')
    pushBox(city.extras, facadeX + fx * 1.7 - rx * 1.05, 1.2, facadeZ + fz * 1.7 - rz * 1.05, 0.16, 2.15, 0.16, facing, '#f4f0e8')

    const doorW = garage ? 2.35 : 1.05
    const doorH = garage ? 2.25 : 2.15
    pushBox(city.frames, facadeX + fx * 0.02, doorH / 2 + 0.06, facadeZ + fz * 0.02, 0.1, doorH + 0.28, doorW + 0.28, facing, '#2c2622')
    pushBox(city.doors, facadeX + fx * 0.08, doorH / 2, facadeZ + fz * 0.08, 0.12, doorH, doorW, facing, garage ? '#d8d2c6' : doorColor)

    const shutter = rng() > 0.5 ? '#f4f1ea' : '#d5ebe3'
    const windowOffsets = width > 10 ? [-width * 0.28, width * 0.28] : [0]
    const levels = floors === 2 ? [1.65, 4.35] : [1.75]
    if (garage) levels.splice(0, 1)
    for (const level of levels) {
      for (const offset of windowOffsets) {
        const wx = facadeX + fx * 0.08 + rx * offset
        const wz = facadeZ + fz * 0.08 + rz * offset
        pushBox(city.frames, facadeX + fx * 0.03 + rx * offset, level, facadeZ + fz * 0.03 + rz * offset, 0.08, 1.5, 1.38, facing, '#f7f4ee')
        pushBox(city.windows, wx, level, wz, 0.12, 1.16, 1.02, facing, level > 3 ? '#9fd4ee' : '#1c4d6e')
        pushBox(city.extras, facadeX + fx * 0.1 + rx * (offset - 0.62), level, facadeZ + fz * 0.1 + rz * (offset - 0.62), 0.08, 1.28, 0.1, facing, shutter)
        pushBox(city.extras, facadeX + fx * 0.1 + rx * (offset + 0.62), level, facadeZ + fz * 0.1 + rz * (offset + 0.62), 0.08, 1.28, 0.1, facing, shutter)
      }
    }

    pushBox(city.windows, cx + rx * (width / 2 + 0.04), 1.7, cz + rz * (width / 2 + 0.04), 1.15, 1.05, 0.08, facing, '#173044')
    pushBox(city.frames, cx + rx * (width / 2 + 0.02), 1.7, cz + rz * (width / 2 + 0.02), 1.32, 1.22, 0.06, facing, '#f7f4ee')
    if (floors === 2) {
      pushBox(city.windows, cx - rx * (width / 2 + 0.04), 4.3, cz - rz * (width / 2 + 0.04), 1.15, 1.05, 0.08, facing, '#173044')
    }

    if (floors === 2 && rng() > 0.55) {
      pushBox(
        city.extras,
        facadeX + fx * 0.7,
        3.22,
        facadeZ + fz * 0.7,
        1.15,
        0.12,
        Math.min(width * 0.62, 4.2),
        facing,
        '#d9d3c8',
      )
    }

    if (rng() > 0.28) {
      pushBox(
        city.tanks,
        cx - rx * width * 0.22,
        height + 0.32 + 0.38,
        cz - rz * width * 0.22,
        0.82,
        0.76,
        0.82,
        0,
        rng() > 0.5 ? '#e7eef3' : '#1f4f86',
      )
    }

    if (rng() > 0.35) {
      pushBox(city.extras, cx + rx * width * 0.28, height + 0.95, cz + rz * width * 0.28, 0.42, 1.15, 0.42, 0, '#8d4e3c')
    }

    if (rng() > 0.72) {
      addTree(city, facadeX + fx * yard * 0.55 + rx * width * 0.28, facadeZ + fz * yard * 0.55 + rz * width * 0.28, 0.85)
    }

    const fenceY = 0.48
    const fenceSpan = width * 0.46
    const gate = 1.35
    const fenceBaseX = ex - fx * 0.4
    const fenceBaseZ = ez - fz * 0.4
    const fenceColor = shade(wall, 0.48)
    pushBox(city.fences, fenceBaseX + rx * (gate / 2 + fenceSpan / 2), fenceY, fenceBaseZ + rz * (gate / 2 + fenceSpan / 2), 0.16, 0.95, fenceSpan, facing, fenceColor)
    pushBox(city.fences, fenceBaseX - rx * (gate / 2 + fenceSpan / 2), fenceY, fenceBaseZ - rz * (gate / 2 + fenceSpan / 2), 0.16, 0.95, fenceSpan, facing, fenceColor)

    if (city.houses.length % 5 === 0) {
      city.flags.push({
        x: facadeX + rx * width * 0.36,
        z: facadeZ + rz * width * 0.36,
        rot: facing,
      })
    }

    const street = edge === 'n' ? H_STREETS[iz + 1] : edge === 's' ? H_STREETS[iz] : edge === 'w' ? V_STREETS[ix] : V_STREETS[ix + 1]
    const number = 20 + Math.floor(rng() * 860)
    city.houses.push({
      address: `${street} #${number}`,
      delivery: { x: ex + fx * 5.3, z: ez + fz * 5.3 },
    })

    city.colliders.push({
      x: cx,
      z: cz,
      hx: depth / 2,
      hz: width / 2,
      fx,
      fz,
      rx,
      rz,
    })
  }
}

function addRestaurant(
  city: City,
  spec: {
    id: Restaurant['id']
    name: string
    url: string
    color: string
    sign: string
    ix: number
    iz: number
    yaw: number
  },
) {
  const rect = blockRect(spec.ix, spec.iz)
  const mid = (rect.x0 + rect.x1) / 2
  const width = 40
  const depth = 26
  const x = mid
  const z = rect.z0 + 4.2 + depth / 2
  const pickup = { x: mid, z: rect.z0 + 2.2 }
  const stall = { x: mid, z: rect.z0 + 2.2 }

  city.restaurants.push({
    id: spec.id,
    name: spec.name,
    url: spec.url,
    color: spec.color,
    sign: spec.sign,
    x,
    z,
    yaw: spec.yaw,
    width,
    depth,
    pickup,
    stall,
  })

  city.asphalt.push({ x0: mid - 20, z0: rect.z0, x1: mid + 20, z1: rect.z0 + 4, y: 0.05 })
  for (let stallIndex = -3; stallIndex <= 3; stallIndex++) {
    const sx = mid + stallIndex * 5.2
    city.marks.push({ x0: sx - 2.15, z0: rect.z0 + 0.35, x1: sx - 2.05, z1: rect.z0 + 3.65, y: 0 })
    city.marks.push({ x0: sx + 2.05, z0: rect.z0 + 0.35, x1: sx + 2.15, z1: rect.z0 + 3.65, y: 0 })
  }

  city.colliders.push({
    id: spec.id,
    x,
    z,
    hx: depth / 2,
    hz: width / 2,
    fx: 0,
    fz: 1,
    rx: 1,
    rz: 0,
  })

  const fenceH = 0.9
  pushBox(city.fences, mid - 21, fenceH / 2, rect.z0 + 2, 0.16, fenceH, 4, 0, '#e4ddd2')
  pushBox(city.fences, mid + 21, fenceH / 2, rect.z0 + 2, 0.16, fenceH, 4, 0, '#e4ddd2')
  city.colliders.push(makeAxes(Math.PI / 2, 4, 0.35, mid - 21, rect.z0 + 2))
  city.colliders.push(makeAxes(Math.PI / 2, 4, 0.35, mid + 21, rect.z0 + 2))

}

function addTreesAndLamps(city: City) {
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const rect = blockRect(ix, iz)
      const isLot = city.restaurants.some((restaurant) => {
        const home = blockRect(
          restaurant.id === 'mcdonalds' ? 1 : restaurant.id === 'kfc' ? 3 : 0,
          restaurant.id === 'mcdonalds' ? 1 : restaurant.id === 'kfc' ? 2 : 3,
        )
        return Math.abs(home.x0 - rect.x0) < 1 && Math.abs(home.z0 - rect.z0) < 1
      })

      placeStreetProps(city, rect.x0 + 6, rect.x1 - 6, rect.z0 - SIDEWALK / 2, true, isLot)
      placeStreetProps(city, rect.x0 + 6, rect.x1 - 6, rect.z1 + SIDEWALK / 2, true, false)
      placeStreetProps(city, rect.z0 + 6, rect.z1 - 6, rect.x0 - SIDEWALK / 2, false, false)
      placeStreetProps(city, rect.z0 + 6, rect.z1 - 6, rect.x1 + SIDEWALK / 2, false, false)
    }
  }
}

function addTree(city: City, x: number, z: number, scale: number) {
  const trunkH = 1.65 * scale
  const bush = 0.82 * scale
  pushBox(city.trunks, x, trunkH * 0.5, z, 0.26 * scale, trunkH, 0.26 * scale, 0, '#6b3f24')
  pushBox(city.crowns, x, trunkH + bush * 0.62, z, bush * 2.15, bush * 1.7, bush * 2.15, 0, '#3d9a46')
}

function placeStreetProps(city: City, from: number, to: number, fixed: number, alongX: boolean, skipMiddle: boolean) {
  const mid = (from + to) / 2
  let index = 0
  for (let cursor = from; cursor <= to; cursor += 16) {
    if (skipMiddle && Math.abs(cursor - mid) < 10) continue
    const x = alongX ? cursor : fixed
    const z = alongX ? fixed : cursor
    if (index % 2 === 0) addTree(city, x, z, 0.9)
    const lampAt = cursor + 9
    if (lampAt <= to) {
      const lx = alongX ? lampAt : fixed
      const lz = alongX ? fixed : lampAt
      pushBox(city.poles, lx, 2.7, lz, 0.1, 5.4, 0.1, 0, '#4d555d')
      pushBox(city.lampHeads, lx, 5.25, lz, 0.55, 0.12, 0.28, 0, '#ffe7b0')
    }
    index += 1
  }
}

function addBusStops(city: City) {
  const push = (x: number, z: number, rot: number) => {
    city.stops.push({ x, z, rot })
    city.colliders.push(makeAxes(rot, 4.2, 1.15, x, z))
  }
  const mids = Array.from({ length: GRID }, (_, block) => {
    const from = toWorld(block * CELL + ROAD)
    const to = toWorld((block + 1) * CELL)
    return (from + to) / 2
  })

  for (const i of [1, 3, 6]) {
    const roadWest = toWorld(i * CELL)
    const roadEast = toWorld(i * CELL + ROAD)
    const east = roadEast - SIDEWALK * 0.38
    const west = roadWest + SIDEWALK * 0.38
    mids.forEach((z, n) => {
      if ((i + n) % 2 === 0) push(east, z, -Math.PI / 2)
      else push(west, z - 8, Math.PI / 2)
    })
  }

  for (const j of [2, 5]) {
    const roadSouth = toWorld(j * CELL)
    const roadNorth = toWorld(j * CELL + ROAD)
    const south = roadSouth + SIDEWALK * 0.38
    const north = roadNorth - SIDEWALK * 0.38
    mids.forEach((x, n) => {
      if ((j + n) % 2 === 0) push(x, south, 0)
      else push(x + 8, north, Math.PI)
    })
  }
}

function addBarriers(city: City) {
  const half = SPAN / 2
  city.colliders.push(makeAxes(0, 1.2, SPAN + 8, -half - 1.2, 0))
  city.colliders.push(makeAxes(0, 1.2, SPAN + 8, half + 1.2, 0))
  city.colliders.push(makeAxes(Math.PI / 2, 1.2, SPAN + 8, 0, -half - 1.2))
  city.colliders.push(makeAxes(Math.PI / 2, 1.2, SPAN + 8, 0, half + 1.2))

  for (let cursor = -half; cursor <= half; cursor += 8) {
    pushBox(city.extras, -half - 0.7, 0.4, cursor, 0.7, 0.8, 2.4, 0, '#c5c8cc')
    pushBox(city.extras, half + 0.7, 0.4, cursor, 0.7, 0.8, 2.4, 0, '#c5c8cc')
    pushBox(city.extras, cursor, 0.4, -half - 0.7, 2.4, 0.8, 0.7, 0, '#c5c8cc')
    pushBox(city.extras, cursor, 0.4, half + 0.7, 2.4, 0.8, 0.7, 0, '#c5c8cc')
  }

  for (let cursor = -half; cursor <= half; cursor += 36) {
    for (const [x, z] of [
      [-half - 8, cursor],
      [half + 8, cursor],
      [cursor, -half - 8],
      [cursor, half + 8],
    ] as const) {
      addTree(city, x, z, 1.15)
    }
  }
}

function buildLanes(city: City) {
  const inset = 12
  const zSouth = toWorld(inset)
  const zNorth = toWorld(SPAN - inset)
  const xWest = toWorld(inset)
  const xEast = toWorld(SPAN - inset)

  for (let i = 0; i <= GRID; i++) {
    const northX = roadCenterX(i) + LANE_OFFSET
    const southX = roadCenterX(i) - LANE_OFFSET
    city.lanes.push({ id: `v${i}n`, x0: northX, z0: zSouth, x1: northX, z1: zNorth, heading: Math.PI / 2, length: zNorth - zSouth })
    city.lanes.push({ id: `v${i}s`, x0: southX, z0: zNorth, x1: southX, z1: zSouth, heading: -Math.PI / 2, length: zNorth - zSouth })
  }
  for (let j = 0; j <= GRID; j++) {
    const eastZ = roadCenterZ(j) - LANE_OFFSET
    const westZ = roadCenterZ(j) + LANE_OFFSET
    city.lanes.push({ id: `h${j}e`, x0: xWest, z0: eastZ, x1: xEast, z1: eastZ, heading: 0, length: xEast - xWest })
    city.lanes.push({ id: `h${j}w`, x0: xEast, z0: westZ, x1: xWest, z1: westZ, heading: Math.PI, length: xEast - xWest })
  }
}

function addParked(city: City, rng: () => number) {
  const models: VehicleKey[] = ['sedan', 'red', 'taxi', 'sedan', 'taxi', 'red', 'sedan', 'taxi']
  const spots: ParkedCar[] = []
  const protectedPoints = [
    city.spawn,
    ...city.restaurants.map((restaurant) => restaurant.pickup),
    ...city.houses.map((house) => house.delivery),
  ]

  for (const lane of city.lanes) {
    const fx = Math.cos(lane.heading)
    const fz = Math.sin(lane.heading)
    const rx = fz
    const rz = -fx
    const parkShift = PARK_OFFSET - LANE_OFFSET
    for (const t of [0.28, 0.52, 0.76]) {
      const x = lane.x0 + (lane.x1 - lane.x0) * t + rx * parkShift
      const z = lane.z0 + (lane.z1 - lane.z0) * t + rz * parkShift
      const blocked = protectedPoints.some((point) => Math.hypot(point.x - x, point.z - z) < 11)
      if (!blocked && rng() > 0.45) spots.push({ x, z, heading: lane.heading, model: 'sedan' })
    }
  }

  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = spots[i]
    spots[i] = spots[j]
    spots[j] = swap
  }

  city.parked = spots.slice(0, 22).map((spot, index) => ({ ...spot, model: models[index % models.length] }))
  for (const car of city.parked) {
    const length = car.model === 'truck' ? 7.5 : 4.5
    city.colliders.push(makeAxes(car.heading, length, 1.85, car.x, car.z))
  }
}

function blockCenter(ix: number, iz: number) {
  const rect = blockRect(ix, iz)
  return { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 }
}

function addSign(city: City, x: number, y: number, z: number, text: string, color: string, accent: string) {
  city.signs.push({ x, y, z, text, color, accent })
}

function addShell(city: City, x: number, z: number, w: number, d: number, h: number, wall: string, roof: string) {
  pushBox(city.walls, x, h / 2, z, w, h, d, 0, wall)
  pushBox(city.extras, x, 0.28, z, w + 0.3, 0.36, d + 0.3, 0, shade(wall, 0.72))
  pushBox(city.roofs, x, h + 0.18, z, w + 0.7, 0.28, d + 0.7, 0, roof)
  pushBox(city.doors, x, 1.25, z - d / 2 - 0.04, 1.5, 2.3, 0.1, 0, '#2c2622')
  city.colliders.push(makeAxes(0, w, d, x, z))
}

function addFrontWindows(city: City, x: number, z: number, w: number, d: number, floors: number) {
  const face = z - d / 2 - 0.05
  const cols = w > 12 ? [-1, 0, 1] : [-1, 1]
  for (let floor = 0; floor < floors; floor++) {
    const y = 1.7 + floor * 2.55
    for (const col of cols) {
      pushBox(city.frames, x + col * w * 0.28, y, face, 1.35, 1.4, 0.08, 0, '#f7f4ee')
      pushBox(city.windows, x + col * w * 0.28, y, face - 0.02, 1.05, 1.1, 0.06, 0, floor > 0 ? '#9fd4ee' : '#1c4d6e')
    }
  }
}

function addTower(
  city: City,
  ix: number,
  iz: number,
  floors = 5,
  wall = '#f4efe6',
  roof = '#6b5344',
) {
  const { x, z } = blockCenter(ix, iz)
  const w = 9 + (floors > 7 ? 3 : floors > 5 ? 2 : 0)
  const d = 8 + (floors > 7 ? 2 : 0)
  const h = 2.55 * floors
  pushBox(city.walls, x, h / 2, z, w, h, d, 0, wall)
  pushBox(city.walls, x, 0.35, z, w + 0.25, 0.5, d + 0.25, 0, '#c4523a')
  pushBox(city.roofs, x, h + 0.16, z, w + 0.5, 0.28, d + 0.5, 0, roof)
  if (floors >= 8) {
    pushBox(city.walls, x, h + 2.4, z, w * 0.55, 4.6, d * 0.55, 0, shade(wall, 0.92))
    pushBox(city.roofs, x, h + 4.85, z, w * 0.58, 0.22, d * 0.58, 0, roof)
    pushBox(city.extras, x, h + 6.2, z, 0.35, 2.4, 0.35, 0, '#d52b1e')
  } else {
    pushBox(city.tanks, x + 2.2, h + 0.7, z - 1.4, 0.85, 0.75, 0.85, 0, '#e7eef3')
  }
  city.colliders.push(makeAxes(0, w, d, x, z))
  for (let floor = 0; floor < floors; floor++) {
    const y = 1.45 + floor * 2.55
    for (const side of [-1, 1]) {
      for (const col of [-1, 0, 1]) {
        const wz = z + side * (d / 2 + 0.04)
        pushBox(city.windows, x + col * (w / 4), y, wz, 1.15, 1.15, 0.06, 0, floor > 2 ? '#9fd4ee' : '#1c4d6e')
        pushBox(city.extras, x + col * (w / 4), y - 0.8, z + side * (d / 2 + 0.28), 1.6, 0.08, 0.45, 0, '#d9d3c8')
      }
    }
  }
  city.flags.push({ x: x - w / 2 - 0.4, z: z - d / 2 - 0.6, rot: 0.3 })
  city.buildingDrops.push({
    address: `Torre ${ix}${iz} · puerta`,
    delivery: { x, z: z - d / 2 - 4.2 },
  })
}

function addChile(city: City) {
  const civic = blockCenter(4, 5)
  addShell(city, civic.x, civic.z, 16, 9, 6.2, '#f7f4ee', '#3d6ea8')
  addFrontWindows(city, civic.x, civic.z, 16, 9, 2)
  for (const col of [-5.2, -1.7, 1.7, 5.2]) {
    pushBox(city.extras, civic.x + col, 2.8, civic.z - 4.7, 0.38, 5.2, 0.38, 0, '#f7f4ee')
  }
  addSign(city, civic.x, 7.3, civic.z - 4.7, 'Municipalidad', '#3d6ea8', '#ffffff')
  city.flags.push({ x: civic.x + 6.4, z: civic.z - 6.2, rot: 0.2 })

  const school = blockCenter(6, 6)
  addShell(city, school.x, school.z + 3, 18, 8, 5.2, '#f6e27a', '#c4523a')
  addFrontWindows(city, school.x, school.z + 3, 18, 8, 1)
  pushBox(city.extras, school.x, 0.12, school.z - 6, 16, 0.08, 7, 0, '#2f9a42')
  addSign(city, school.x, 6.4, school.z - 1.2, 'Escuela', '#c4523a', '#fff8e0')
  city.flags.push({ x: school.x - 8, z: school.z - 8, rot: 0.5 })

  const feria = blockCenter(7, 4)
  const awnings = ['#e23b3b', '#ff8a00', '#3d6ea8', '#5c8a4a', '#7a5cff', '#ffe56a']
  awnings.forEach((color, index) => {
    const sx = feria.x - 7.5 + index * 3
    pushBox(city.extras, sx, 2.15, feria.z, 2.5, 0.1, 3.2, 0, color)
    for (const [dx, dz] of [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]] as const) {
      pushBox(city.poles, sx + dx, 1.05, feria.z + dz, 0.08, 2.1, 0.08, 0, '#f4f4f4')
    }
  })
  addSign(city, feria.x, 3.5, feria.z - 2.6, 'Feria Libre', '#e23b3b', '#ffffff')

  const church = blockCenter(5, 2)
  pushBox(city.walls, church.x + 1.2, 3.1, church.z, 8, 6.2, 13, 0, '#f6f1e6')
  pushBox(city.roofs, church.x + 1.2, 6.45, church.z, 8.5, 0.4, 13.5, 0, '#6b5344')
  pushBox(city.walls, church.x - 4.4, 6.2, church.z - 4, 3.3, 12.4, 3.3, 0, '#f6f1e6')
  pushBox(city.roofs, church.x - 4.4, 12.5, church.z - 4, 3.8, 0.35, 3.8, 0, '#8d4e3c')
  pushBox(city.extras, church.x - 4.4, 13.6, church.z - 4, 0.16, 1.7, 0.16, 0, '#f7f4ee')
  pushBox(city.extras, church.x - 4.4, 14.1, church.z - 4, 0.95, 0.16, 0.16, 0, '#f7f4ee')
  pushBox(city.doors, church.x + 1.2, 1.4, church.z - 6.55, 1.6, 2.6, 0.1, 0, '#4e3528')
  city.colliders.push(makeAxes(0, 12, 14, church.x, church.z))
  addSign(city, church.x + 1.2, 7.2, church.z - 6.6, 'Parroquia', '#8d4e3c', '#fff8e8')

  const fire = blockCenter(5, 7)
  addShell(city, fire.x, fire.z, 14, 8, 5, '#c4523a', '#f4f0e8')
  pushBox(city.doors, fire.x - 2.4, 1.35, fire.z - 4.06, 2.6, 2.5, 0.08, 0, '#f7f4ee')
  pushBox(city.doors, fire.x + 2.4, 1.35, fire.z - 4.06, 2.6, 2.5, 0.08, 0, '#f7f4ee')
  pushBox(city.poles, fire.x + 6.2, 4.2, fire.z, 0.35, 8.4, 0.35, 0, '#c4523a')
  addSign(city, fire.x, 6.1, fire.z - 4.2, 'Bomberos', '#ffffff', '#c4523a')
  city.flags.push({ x: fire.x - 6, z: fire.z - 5.2, rot: -0.2 })

  const clinic = blockCenter(6, 1)
  addShell(city, clinic.x, clinic.z, 15, 8, 5.4, '#f7f7f7', '#3d9a46')
  addFrontWindows(city, clinic.x, clinic.z, 15, 8, 1)
  pushBox(city.extras, clinic.x + 5.2, 3.2, clinic.z - 4.15, 1.5, 0.28, 0.1, 0, '#d52b1e')
  pushBox(city.extras, clinic.x + 5.2, 3.2, clinic.z - 4.15, 0.28, 1.5, 0.1, 0, '#d52b1e')
  addSign(city, clinic.x, 6.5, clinic.z - 4.2, 'Cesfam', '#3d9a46', '#ffffff')

  const store = blockCenter(4, 6)
  addShell(city, store.x, store.z, 11, 8, 4.2, '#f2c1a0', '#6b5344')
  pushBox(city.extras, store.x, 2.5, store.z - 4.15, 8, 0.12, 1.4, 0, '#e23b3b')
  addFrontWindows(city, store.x, store.z, 11, 8, 1)
  addSign(city, store.x, 5.2, store.z - 4.3, 'Almacén', '#6b5344', '#fff4d6')

  const plaza = blockCenter(7, 7)
  pushBox(city.extras, plaza.x, 0.12, plaza.z, 20, 0.08, 16, 0, '#d7d2c8')
  pushBox(city.tanks, plaza.x, 0.45, plaza.z, 2.4, 0.55, 2.4, 0, '#9fd4ee')
  pushBox(city.poles, plaza.x, 4.2, plaza.z, 0.12, 8.2, 0.12, 0, '#f7f4ee')
  city.flags.push({ x: plaza.x + 0.7, z: plaza.z, rot: 0.6 })
  for (const [dx, dz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]] as const) {
    pushBox(city.extras, plaza.x + dx, 0.42, plaza.z + dz, 2.4, 0.4, 0.6, 0, '#6b5344')
    addTree(city, plaza.x + dx * 1.35, plaza.z + dz * 1.5, 1.05)
  }
  addSign(city, plaza.x, 2.4, plaza.z - 7.2, 'Plaza', '#3d6ea8', '#ffffff')

  for (const spot of [
    [5, 5, 6, '#f4efe6', '#6b5344'],
    [7, 2, 9, '#e8eef5', '#4a5d73'],
    [4, 7, 5, '#f4efe6', '#6b5344'],
    [1, 5, 11, '#dfe7f2', '#3d4f66'],
    [3, 6, 7, '#f1ebe3', '#8d4e3c'],
    [0, 7, 8, '#f7f4ee', '#5a6e86'],
    [0, 0, 10, '#ebe4da', '#4e5f74'],
    [2, 0, 6, '#f4efe6', '#6b5344'],
    [3, 5, 12, '#d8e2ef', '#2f4058'],
    [6, 7, 7, '#f0ebe4', '#7a5340'],
    [1, 0, 5, '#f7f4ee', '#6b5344'],
    [5, 6, 8, '#e6edf6', '#45586f'],
    [2, 2, 9, '#eef2f8', '#51667e'],
    [4, 4, 6, '#f4efe6', '#6b5344'],
    [6, 5, 10, '#dce5f0', '#384a60'],
    [7, 7, 8, '#f2ebe3', '#6b5344'],
    [0, 4, 7, '#f7f4ee', '#5a6e86'],
    [3, 3, 11, '#d5e0ee', '#2c3c52'],
  ] as const) {
    addTower(city, spot[0], spot[1], spot[2], spot[3], spot[4])
  }
}

function addProps(city: City) {
  const spots: Array<[PropKind, number, number]> = [
    ['horizon', 0, 2],
    ['horizon', 2, 4],
    ['horizon', 5, 3],
    ['horizon', 7, 3],
    ['panel', 1, 4],
    ['panel', 3, 7],
    ['panel', 6, 2],
    ['pizza', 2, 6],
    ['pizza', 4, 4],
    ['pizza', 6, 5],
    ['horizon', 0, 4],
    ['horizon', 0, 6],
    ['horizon', 3, 4],
    ['horizon', 7, 0],
    ['panel', 1, 0],
    ['panel', 4, 0],
    ['panel', 5, 6],
    ['pizza', 1, 7],
    ['pizza', 3, 3],
    ['pizza', 7, 6],
    ['horizon', 0, 5],
    ['horizon', 2, 1],
    ['horizon', 2, 5],
    ['horizon', 6, 3],
    ['panel', 1, 2],
    ['panel', 3, 0],
    ['panel', 5, 1],
    ['panel', 6, 4],
    ['pizza', 2, 3],
    ['pizza', 4, 1],
    ['horizon', 3, 1],
    ['horizon', 4, 5],
    ['horizon', 6, 6],
    ['panel', 0, 1],
    ['panel', 2, 7],
    ['panel', 5, 2],
    ['pizza', 7, 4],
    ['pizza', 1, 3],
    ['horizon', 1, 6],
    ['horizon', 4, 3],
    ['horizon', 6, 0],
    ['horizon', 7, 5],
    ['panel', 0, 6],
    ['panel', 2, 2],
    ['panel', 3, 5],
    ['panel', 5, 4],
    ['pizza', 0, 2],
    ['pizza', 5, 7],
    ['pizza', 6, 1],
    ['horizon', 3, 7],
    ['panel', 7, 3],
  ]
  const names: Record<PropKind, string> = {
    horizon: 'Horizon Heights',
    panel: 'Panel Tower',
    pizza: 'Pizza Hut',
  }
  spots.forEach(([kind, ix, iz], index) => {
    const center = blockCenter(ix, iz)
    const yaw = kind === 'pizza' ? Math.PI : index % 2 === 0 ? 0 : Math.PI
    city.props.push({
      id: `${kind}-${index}`,
      kind,
      x: center.x,
      z: center.z,
      yaw,
    })
    const depth = kind === 'pizza' ? 14 : kind === 'horizon' ? 14 : 12
    city.buildingDrops.push({
      address: `${names[kind]} · puerta`,
      delivery: {
        x: center.x + Math.sin(yaw) * (depth * 0.5 + 3.8),
        z: center.z + Math.cos(yaw) * (depth * 0.5 + 3.8),
      },
    })
  })
}

function addLandmarks(city: City) {
  const costanera = blockCenter(4, 2)
  const entel = blockCenter(7, 1)
  city.landmarks.push({ id: 'costanera', x: costanera.x, z: costanera.z }, { id: 'entel', x: entel.x, z: entel.z })
  city.buildingDrops.push(
    { address: 'Costanera Center · puerta', delivery: { x: costanera.x, z: costanera.z + 16 } },
    { address: 'Torre Entel · puerta', delivery: { x: entel.x, z: entel.z + 9 } },
  )
}

function addFiesta(city: City) {
  addVenue(city, 2, 0, -7, 0, 'bar-18', 'Bar El 18', '#ff4d8d', '#ffe56a')
  addVenue(city, 2, 0, 7, 0, 'disco-cueca', 'Disco La Cueca', '#7a5cff', '#3dff78')
  addVenue(city, 0, 1, 0, 0, 'schoperia', 'Schopería Condell', '#ff8a00', '#fff4d6')
  addVenue(city, 3, 1, 0, 0, 'pub-vicuna', 'Pub Vicuña', '#e23b3b', '#9fd4ee')
  addVenue(city, 6, 0, -7, 0, 'bar-mapocho', 'Bar Mapocho', '#ff4d6a', '#ffe56a')
  addVenue(city, 6, 0, 7, 0, 'botilleria', 'Botillería', '#ffb703', '#1a1a1a')
  addVenue(city, 4, 3, 0, 0, 'fuente-soda', 'Fuente de Soda', '#3dff78', '#143018')
  addVenue(city, 7, 5, 0, 0, 'pub-vega', 'Pub La Vega', '#7a5cff', '#ffe56a')
  addVenue(city, 2, 7, 0, 0, 'disco-matucana', 'Disco Matucana', '#e23b3b', '#fff4d6')
  addVenue(city, 5, 0, 0, 0, 'schoperia-apoquindo', 'Schopería Apoquindo', '#3d6ea8', '#ffffff')
  addPitch(city, 2, 2)
  addPitch(city, 1, 3)
  addPitch(city, 5, 4)
  addPitch(city, 3, 5)
  addPitch(city, 6, 7)
  addPitch(city, 1, 6)
  addChile(city)
}

function addVenue(
  city: City,
  ix: number,
  iz: number,
  ox: number,
  oz: number,
  id: string,
  name: string,
  color: string,
  accent: string,
) {
  const rect = blockRect(ix, iz)
  const bx = (rect.x0 + rect.x1) / 2 + ox
  const bz = (rect.z0 + rect.z1) / 2 + oz
  const bw = ox === 0 ? 10 : 8.4
  const bd = 6.6
  const yaw = 0
  const door = bd / 2 + 2.5
  city.venues.push({
    id,
    name,
    x: bx - Math.sin(yaw) * door,
    z: bz - Math.cos(yaw) * door,
    yaw,
    color,
    accent,
    bx,
    bz,
    bw,
    bd,
  })
  city.colliders.push(makeAxes(Math.PI / 2 - yaw, bd, bw, bx, bz, id))
}

function addPitch(city: City, ix: number, iz: number) {
  const rect = blockRect(ix, iz)
  const x = (rect.x0 + rect.x1) / 2
  const z = (rect.z0 + rect.z1) / 2
  const length = 20
  const width = 12
  city.pitches.push({ x, z })
  pushBox(city.extras, x, 0.16, z, length, 0.1, width, 0, '#1f8f45')
  pushBox(city.extras, x, 0.24, z, 0.12, 0.04, width, 0, '#f7f7f7')
  pushBox(city.extras, x, 0.24, z - width / 2, length, 0.04, 0.12, 0, '#f7f7f7')
  pushBox(city.extras, x, 0.24, z + width / 2, length, 0.04, 0.12, 0, '#f7f7f7')
  pushBox(city.extras, x - length / 2, 0.24, z, 0.12, 0.04, width, 0, '#f7f7f7')
  pushBox(city.extras, x + length / 2, 0.24, z, 0.12, 0.04, width, 0, '#f7f7f7')
  pushBox(city.extras, x - 4.2, 0.24, z, 0.1, 0.04, 5.2, 0, '#f7f7f7')
  pushBox(city.extras, x + 4.2, 0.24, z, 0.1, 0.04, 5.2, 0, '#f7f7f7')
  for (const end of [-1, 1]) {
    const gx = x + end * (length / 2)
    pushBox(city.poles, gx, 0.85, z - 1.7, 0.08, 1.7, 0.08, 0, '#f4f7fb')
    pushBox(city.poles, gx, 0.85, z + 1.7, 0.08, 1.7, 0.08, 0, '#f4f7fb')
    pushBox(city.extras, gx, 1.68, z, 0.08, 0.08, 3.5, 0, '#f4f7fb')
    city.colliders.push(makeAxes(0, 0.35, 3.6, gx, z))
  }
  city.flags.push({ x: x - length / 2 + 0.8, z: z - width / 2 + 0.8, rot: 0.4 })
  city.flags.push({ x: x + length / 2 - 0.8, z: z + width / 2 - 0.8, rot: -0.6 })
  pushBox(city.extras, x, 0.42, z + width / 2 + 1.3, 3.2, 0.42, 0.7, 0, '#d7d2c8')
  pushBox(city.extras, x + 2.2, 0.42, z + width / 2 + 1.3, 3.2, 0.42, 0.7, 0, '#d7d2c8')
}

export function sampleLane(lane: Lane, distance: number) {
  const length = Math.max(lane.length, 0.001)
  let d = distance % length
  if (d < 0) d += length
  const t = d / length
  return {
    x: lane.x0 + (lane.x1 - lane.x0) * t,
    z: lane.z0 + (lane.z1 - lane.z0) * t,
    heading: lane.heading,
  }
}

export const city = createCity()

addStaticColliders(city.colliders)
