import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, extend, useFrame, type ThreeElement } from '@react-three/fiber'
import { Effects, useTexture } from '@react-three/drei'
import { UnrealBloomPass } from 'three-stdlib'
import * as THREE from 'three'
import { city } from './game/city'
import { blendedLook } from './game/day'
import { CityWorld, RestaurantFallback, RestaurantModel } from './game/CityWorld'
import { HUD, Loader, QuietLoad } from './game/HUD'
import { Markers } from './game/Markers'
import { Phones } from './game/Phones'
import { Player } from './game/Player'
import { Police } from './game/Police'
import { game } from './game/store'
import { Traffic } from './game/Traffic'

extend({ UnrealBloomPass })

declare module '@react-three/fiber' {
  interface ThreeElements {
    unrealBloomPass: ThreeElement<typeof UnrealBloomPass>
  }
}

const BLOOM_RES = new THREE.Vector2(256, 256)

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}

function SkyDome() {
  const texture = useTexture('/cieloreal2.webp')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 16
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  const sky = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ scene }) => {
    const look = blendedLook(game.clock)
    if (sky.current) sky.current.color.set(look.sky)
    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      fog.color.set(look.fog)
      fog.near = look.near
      fog.far = look.far
    }
    if (scene.background instanceof THREE.Color) scene.background.set(look.bg)
  })
  return (
    <mesh frustumCulled={false} renderOrder={-1} rotation={[0, Math.PI * 0.15, 0]}>
      <sphereGeometry args={[980, 96, 48]} />
      <meshBasicMaterial ref={sky} map={texture} side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function Clouds() {
  const group = useRef<THREE.Group>(null)
  const mats = useRef<THREE.MeshBasicMaterial[]>([])
  const clouds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const angle = (index / 14) * Math.PI * 2 + index * 0.35
        const radius = 90 + (index % 5) * 38
        return {
          x: Math.cos(angle) * radius,
          y: 48 + (index % 4) * 9,
          z: Math.sin(angle) * radius,
          sx: 28 + (index % 5) * 7,
          sy: 8 + (index % 3) * 2.5,
          sz: 16 + (index % 4) * 5,
          drift: 2.2 + (index % 4) * 0.7,
          spin: 0.02 + (index % 3) * 0.01,
        }
      }),
    [],
  )
  useFrame((_, dt) => {
    const look = blendedLook(game.clock)
    const tint = look.label === 'Noche' ? '#8fa3c8' : look.label === 'Atardecer' ? '#ffe0c0' : '#ffffff'
    const opacity = look.label === 'Noche' ? 0.28 : look.label === 'Atardecer' ? 0.42 : 0.55
    mats.current.forEach((mat) => {
      if (!mat) return
      mat.color.set(tint)
      mat.opacity = opacity
    })
    const root = group.current
    if (!root) return
    root.position.x = game.x
    root.position.z = game.z
    root.children.forEach((child, index) => {
      const cloud = clouds[index]
      if (!cloud || !(child instanceof THREE.Group)) return
      child.position.x += cloud.drift * dt * 0.35
      if (child.position.x > 220) child.position.x = -220
      child.rotation.y += cloud.spin * dt
    })
  })
  return (
    <group ref={group}>
      {clouds.map((cloud, index) => (
        <group key={index} position={[cloud.x, cloud.y, cloud.z]}>
          {[
            [0, 0, 0, 1],
            [0.45, 0.08, 0.1, 0.72],
            [-0.4, 0.05, -0.15, 0.68],
            [0.1, 0.18, -0.35, 0.55],
          ].map(([ox, oy, oz, scale], puff) => (
            <mesh key={puff} position={[ox * cloud.sx, oy * cloud.sy, oz * cloud.sz]} scale={[scale, scale * 0.7, scale]}>
              <sphereGeometry args={[cloud.sx * 0.42, 12, 10]} />
              <meshBasicMaterial
                ref={(node) => {
                  if (node) mats.current[index * 4 + puff] = node
                }}
                color="#ffffff"
                transparent
                opacity={0.5}
                depthWrite={false}
                fog={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function World({ onReady }: { onReady: () => void }) {
  return (
    <>
      <color attach="background" args={['#2ea8f0']} />
      <fog attach="fog" args={['#5ec4f8', 240, 780]} />
      <SkyDome />
      <Clouds />
      <CityWorld />
      <Suspense fallback={null}>
        <Player />
        <Traffic />
        <Police />
        <Ready onReady={onReady} />
      </Suspense>
      {city.restaurants.map((restaurant) => (
        <Suspense key={restaurant.id} fallback={<RestaurantFallback restaurant={restaurant} />}>
          <RestaurantModel restaurant={restaurant} />
        </Suspense>
      ))}
      <Markers />
      <Effects disableGamma multisamping={0}>
        <unrealBloomPass args={[BLOOM_RES, 0.30, 0.42, 0.82]} />
      </Effects>
      <Suspense fallback={null}>
        <Phones />
      </Suspense>
    </>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  return (
    <div className="app">
      <Canvas
        shadows
        dpr={[1, 1.25]}
        camera={{ fov: 62, near: 0.25, far: 1700, position: [12, 8, 12] }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          <World onReady={() => setReady(true)} />
        </Suspense>
      </Canvas>
      {ready ? <HUD /> : <Loader />}
      {ready && <QuietLoad />}
    </div>
  )
}
