import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { city, type PropKind, type Quad, type Restaurant, type Xform } from './city'
import { Fiesta, Flags } from './Fiesta'
import { Landmarks } from './Landmarks'
import { prepareBuilding } from './models'
import { upsertCollider } from './physics'

const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
const BALL = new THREE.SphereGeometry(0.5, 16, 12)

function paint(base: string, speck: string, amount: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    ctx.fillStyle = speck
    ctx.globalAlpha = 0.15 + Math.random() * 0.35
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function quadsGeometry(quads: Quad[], uvScale: number) {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  for (const quad of quads) {
    const y = quad.y
    const corners = [
      [quad.x0, y, quad.z0],
      [quad.x1, y, quad.z0],
      [quad.x1, y, quad.z1],
      [quad.x0, y, quad.z0],
      [quad.x1, y, quad.z1],
      [quad.x0, y, quad.z1],
    ]
    const uvCorners = [
      [quad.x0, quad.z0],
      [quad.x1, quad.z0],
      [quad.x1, quad.z1],
      [quad.x0, quad.z0],
      [quad.x1, quad.z1],
      [quad.x0, quad.z1],
    ]
    for (const corner of corners) {
      positions.push(corner[0], corner[1], corner[2])
      normals.push(0, 1, 0)
    }
    for (const uv of uvCorners) uvs.push(uv[0] * uvScale, uv[1] * uvScale)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}

function sidewalkGeometry(quads: Quad[]) {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const topY = 0.5
  const baseY = 0.2
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    positions.push(x, y, z)
    normals.push(nx, ny, nz)
    uvs.push(x * 0.12, z * 0.12)
  }
  const face = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    nx: number, ny: number, nz: number,
  ) => {
    push(ax, ay, az, nx, ny, nz)
    push(bx, by, bz, nx, ny, nz)
    push(cx, cy, cz, nx, ny, nz)
    push(ax, ay, az, nx, ny, nz)
    push(cx, cy, cz, nx, ny, nz)
    push(dx, dy, dz, nx, ny, nz)
  }
  for (const quad of quads) {
    const { x0, z0, x1, z1 } = quad
    face(x0, topY, z0, x1, topY, z0, x1, topY, z1, x0, topY, z1, 0, 1, 0)
    face(x0, baseY, z0, x0, topY, z0, x0, topY, z1, x0, baseY, z1, -1, 0, 0)
    face(x1, baseY, z1, x1, topY, z1, x1, topY, z0, x1, baseY, z0, 1, 0, 0)
    face(x0, baseY, z1, x0, topY, z1, x1, topY, z1, x1, baseY, z1, 0, 0, 1)
    face(x1, baseY, z0, x1, topY, z0, x0, topY, z0, x0, baseY, z0, 0, 0, -1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}

function Parts({
  items,
  geometry,
  roughness = 0.9,
  metalness = 0,
  emissive,
  cast = false,
}: {
  items: Xform[]
  geometry: THREE.BufferGeometry
  roughness?: number
  metalness?: number
  emissive?: string
  cast?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness,
        metalness,
        emissive: new THREE.Color(emissive ?? '#000000'),
        emissiveIntensity: emissive ? 0.85 : 0,
      }),
    [emissive, metalness, roughness],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || items.length === 0) return
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    const euler = new THREE.Euler()
    const color = new THREE.Color()
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      position.set(item.x, item.y, item.z)
      scale.set(item.sx, item.sy, item.sz)
      euler.set(0, item.rot, 0)
      quaternion.setFromEuler(euler)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
      mesh.setColorAt(index, color.set(item.color))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.frustumCulled = false
  }, [items])

  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow />
}

function Ground() {
  const textures = useMemo(
    () => ({
      grass: paint('#43a84d', '#2f8a3a', 500),
      asphalt: paint('#3a3f46', '#2a2e34', 1100),
      walk: paint('#e4dfd4', '#cfc8ba', 280),
    }),
    [],
  )
  const walk = useMemo(() => sidewalkGeometry(city.sidewalk), [])
  const marks = useMemo(() => quadsGeometry(city.marks, 1), [])
  const yellow = useMemo(() => quadsGeometry(city.yellow, 1), [])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.4, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600]} />
        <meshBasicMaterial color="#2f9a42" />
      </mesh>
      {city.grass.map((quad, index) => (
        <mesh
          key={`g${index}`}
          rotation-x={-Math.PI / 2}
          position={[(quad.x0 + quad.x1) / 2, 0.05, (quad.z0 + quad.z1) / 2]}
          receiveShadow
        >
          <planeGeometry args={[Math.abs(quad.x1 - quad.x0), Math.abs(quad.z1 - quad.z0)]} />
          <meshBasicMaterial map={textures.grass} color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {city.asphalt.map((quad, index) => (
        <mesh
          key={`a${index}`}
          rotation-x={-Math.PI / 2}
          position={[(quad.x0 + quad.x1) / 2, 0.2, (quad.z0 + quad.z1) / 2]}
          receiveShadow
        >
          <planeGeometry args={[Math.abs(quad.x1 - quad.x0), Math.abs(quad.z1 - quad.z0)]} />
          <meshBasicMaterial color="#5c656f" side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={walk} renderOrder={3} receiveShadow>
        <meshBasicMaterial map={textures.walk} color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={marks} position={[0, 0.36, 0]} renderOrder={6}>
        <meshBasicMaterial color="#f4f4f4" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={yellow} position={[0, 0.38, 0]} renderOrder={7}>
        <meshBasicMaterial color="#ffd000" side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
      </mesh>
    </group>
  )
}

export function CityWorld() {
  return (
    <group>
      <Ground />
      <Parts items={city.walls} geometry={BOX} cast />
      <Parts items={city.roofs} geometry={BOX} roughness={0.82} cast />
      <Parts items={city.doors} geometry={BOX} roughness={0.7} />
      <Parts items={city.frames} geometry={BOX} roughness={0.55} />
      <Parts items={city.windows} geometry={BOX} roughness={0.12} metalness={0.65} />
      <Parts items={city.fences} geometry={BOX} />
      <Parts items={city.extras} geometry={BOX} cast />
      <Parts items={city.tanks} geometry={CYL} roughness={0.45} metalness={0.15} />
      <Parts items={city.trunks} geometry={CYL} roughness={1} />
      <Parts items={city.crowns} geometry={BALL} roughness={1} />
      <Parts items={city.poles} geometry={CYL} metalness={0.4} roughness={0.45} />
      <Parts items={city.lampHeads} geometry={BOX} emissive="#ffe3a3" roughness={0.4} />
      <Suspense fallback={null}>
        <BusStops />
        <CityProps />
      </Suspense>
      <Landmarks />
      <Flags />
      <Fiesta />
    </group>
  )
}

useGLTF.preload('/models/bus-stop.glb')
useGLTF.preload('/models/horizon.glb')
useGLTF.preload('/models/panel-tower.glb')
useGLTF.preload('/models/pizza-hut.glb')

const PROP_FIT: Record<PropKind, { url: string; width: number; depth: number; height: number }> = {
  horizon: { url: '/models/horizon.glb', width: 16, depth: 14, height: 26 },
  panel: { url: '/models/panel-tower.glb', width: 14, depth: 12, height: 24 },
  pizza: { url: '/models/pizza-hut.glb', width: 18, depth: 14, height: 8 },
}

function CityProps() {
  const horizon = useGLTF(PROP_FIT.horizon.url, false, true)
  const panel = useGLTF(PROP_FIT.panel.url, false, true)
  const pizza = useGLTF(PROP_FIT.pizza.url, false, true)
  const fitted = useMemo(() => {
    const built = {
      horizon: prepareBuilding(horizon.scene, PROP_FIT.horizon.width, PROP_FIT.horizon.depth, PROP_FIT.horizon.height),
      panel: prepareBuilding(panel.scene, PROP_FIT.panel.width, PROP_FIT.panel.depth, PROP_FIT.panel.height),
      pizza: prepareBuilding(pizza.scene, PROP_FIT.pizza.width, PROP_FIT.pizza.depth, PROP_FIT.pizza.height),
    }
    for (const item of Object.values(built)) {
      item.object.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (!mesh.isMesh) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials) {
          const standard = material as THREE.MeshStandardMaterial
          standard.metalness = 0.08
          standard.roughness = 0.62
          if (standard.emissive) {
            standard.emissive.set('#000000')
            standard.emissiveIntensity = 0
          }
        }
      })
    }
    return built
  }, [horizon.scene, panel.scene, pizza.scene])
  const clones = useMemo(() => city.props.map((prop) => fitted[prop.kind].object.clone(true)), [fitted])

  useLayoutEffect(() => {
    for (const prop of city.props) {
      const size = fitted[prop.kind]
      upsertCollider({
        id: prop.id,
        x: prop.x,
        z: prop.z,
        hx: size.depth / 2,
        hz: size.width / 2,
        fx: 0,
        fz: 1,
        rx: 1,
        rz: 0,
      })
    }
  }, [fitted])

  return (
    <group>
      {city.props.map((prop, index) => (
        <group key={prop.id} position={[prop.x, 0, prop.z]} rotation={[0, prop.yaw, 0]}>
          <primitive object={clones[index]} />
        </group>
      ))}
    </group>
  )
}

function BusStops() {
  const gltf = useGLTF('/models/bus-stop.glb')
  const fitted = useMemo(() => prepareBuilding(gltf.scene, 4.6, 1.8, 3.2), [gltf.scene])
  const clones = useMemo(() => city.stops.map(() => fitted.object.clone(true)), [fitted.object])
  return (
    <group>
      {city.stops.map((stop, index) => (
        <group key={`${stop.x}:${stop.z}`} position={[stop.x, 0.5, stop.z]} rotation={[0, stop.rot, 0]}>
          <primitive object={clones[index]} />
        </group>
      ))}
    </group>
  )
}

export function RestaurantModel({ restaurant }: { restaurant: Restaurant }) {
  const gltf = useGLTF(restaurant.url, false, true)
  const fitted = useMemo(
    () => prepareBuilding(gltf.scene, restaurant.width, restaurant.depth, 18),
    [gltf.scene, restaurant.depth, restaurant.width],
  )

  useLayoutEffect(() => {
    upsertCollider({
      id: restaurant.id,
      x: restaurant.x,
      z: restaurant.z,
      hx: fitted.depth / 2,
      hz: fitted.width / 2,
      fx: 0,
      fz: 1,
      rx: 1,
      rz: 0,
    })
  }, [fitted.depth, fitted.width, restaurant.id, restaurant.x, restaurant.z])

  return (
    <group position={[restaurant.x, 0, restaurant.z]} rotation={[0, restaurant.yaw, 0]}>
      <primitive object={fitted.object} />
    </group>
  )
}

export function RestaurantFallback({ restaurant }: { restaurant: Restaurant }) {
  return (
    <group position={[restaurant.x, 0, restaurant.z]}>
      <mesh position={[0, 3.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[restaurant.width, 6.6, restaurant.depth]} />
        <meshStandardMaterial color="#f3f0e8" />
      </mesh>
      <mesh position={[0, 5.4, -restaurant.depth / 2 + 0.05]}>
        <boxGeometry args={[restaurant.width * 0.7, 1.35, 0.25]} />
        <meshStandardMaterial color={restaurant.color} />
      </mesh>
      <mesh position={[0, 1.3, -restaurant.depth / 2 - 0.02]}>
        <boxGeometry args={[2.4, 2.5, 0.16]} />
        <meshStandardMaterial color="#1c2c3a" metalness={0.4} roughness={0.2} />
      </mesh>
    </group>
  )
}
