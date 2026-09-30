import { Suspense, useEffect, useRef, useState } from 'react'
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
  const texture = useTexture('/sky.jpg')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
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
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[900, 48, 32]} />
      <meshBasicMaterial ref={sky} map={texture} side={THREE.BackSide} fog={false} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

function World({ onReady }: { onReady: () => void }) {
  return (
    <>
      <color attach="background" args={['#2ea8f0']} />
      <fog attach="fog" args={['#5ec4f8', 240, 780]} />
      <SkyDome />
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
        <unrealBloomPass args={[BLOOM_RES, 0.16, 0.4, 0.84]} />
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
          toneMappingExposure: 1.05,
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
