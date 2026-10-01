import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { city } from './city'
import { game } from './store'

function wordTexture(text: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 512, 256)
  ctx.fillStyle = '#ffffff'
  ctx.font = text.length > 2 ? '900 120px Arial Black, Impact, sans-serif' : '900 230px Arial Black, Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 138)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function WorldMark({
  text,
  width = 1.15,
  height = 1.15,
  y = 2.85,
  show,
}: {
  text: string
  width?: number
  height?: number
  y?: number
  show: () => boolean
}) {
  const root = useRef<THREE.Group>(null)
  const map = useMemo(() => wordTexture(text), [text])
  useFrame(({ clock }) => {
    const mark = root.current
    if (!mark) return
    mark.visible = show()
    mark.position.y = y + Math.sin(clock.elapsedTime * 3.4) * 0.08
  })
  return (
    <group ref={root} visible={false} position={[0, y, 0]}>
      <Billboard follow>
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={map} transparent depthTest={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

function TalkMark() {
  return (
    <WorldMark
      text="?"
      show={() => {
        const talk = city.narco.talk
        return (
          game.started &&
          !game.cartel &&
          !game.cartelTalk &&
          !game.mapOpen &&
          Math.hypot(game.x - talk.x, game.z - talk.z) < 7.2
        )
      }}
    />
  )
}

function canvasTex(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function dirtMap() {
  return canvasTex((ctx, size) => {
    ctx.fillStyle = '#2a241c'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = i % 5 === 0 ? '#1a1610' : i % 3 === 0 ? '#3a3228' : '#221c16'
      ctx.globalAlpha = 0.2 + Math.random() * 0.45
      ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 18, 1 + Math.random() * 8)
    }
    ctx.globalAlpha = 0.35
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#0d0c08' : '#1c1810'
      ctx.beginPath()
      ctx.ellipse(Math.random() * size, Math.random() * size, 18 + Math.random() * 40, 10 + Math.random() * 22, Math.random(), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = '#0a0a08'
    for (let i = 0; i < 40; i++) {
      ctx.beginPath()
      ctx.moveTo(Math.random() * size, Math.random() * size)
      ctx.lineTo(Math.random() * size, Math.random() * size)
      ctx.lineWidth = 0.6
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  })
}

function metalMap() {
  return canvasTex((ctx, size) => {
    ctx.fillStyle = '#3a3530'
    ctx.fillRect(0, 0, size, size)
    for (let x = 0; x < size; x += 10) {
      ctx.fillStyle = x % 20 === 0 ? '#2e2a26' : '#45403a'
      ctx.fillRect(x, 0, 5, size)
    }
    ctx.globalAlpha = 0.25
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = '#6b5344'
      ctx.fillRect(Math.random() * size, Math.random() * size, 8, 2 + Math.random() * 6)
    }
    ctx.globalAlpha = 1
  }, 256)
}

function grafMap(tag: string, fill: string) {
  return canvasTex((ctx, size) => {
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = fill
    ctx.font = '900 92px Impact, Arial Black, sans-serif'
    ctx.rotate(-0.12)
    ctx.fillText(tag, 24, 210)
    ctx.rotate(0.12)
    ctx.fillStyle = '#111'
    ctx.font = '700 28px Arial'
    ctx.fillText('x x x', 40, 300)
  }, 256)
}

function Hood({
  x,
  z,
  yaw,
  shirt,
  pants,
  skin,
  hat,
  hair = '#1a120e',
  ask,
  bulky,
}: {
  x: number
  z: number
  yaw: number
  shirt: string
  pants: string
  skin: string
  hat?: string
  hair?: string
  ask?: boolean
  bulky?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const wide = bulky ? 1.12 : 1
  useFrame(({ clock }) => {
    const root = group.current
    if (!root) return
    root.position.y = Math.sin(clock.elapsedTime * 1.5 + x) * 0.012
    const dx = game.x - x
    const dz = game.z - z
    if (Math.hypot(dx, dz) < 16) root.rotation.y = Math.atan2(dx, dz)
  })
  return (
    <group ref={group} position={[x, 0, z]} rotation={[0, yaw, 0]} scale={[wide, bulky ? 1.04 : 1, wide]}>
      <mesh position={[-0.12, 0.055, 0.06]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.34]} />
        <meshStandardMaterial color="#14110e" roughness={0.95} />
      </mesh>
      <mesh position={[0.12, 0.055, 0.06]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.34]} />
        <meshStandardMaterial color="#14110e" roughness={0.95} />
      </mesh>
      <mesh position={[-0.11, 0.38, 0.02]} castShadow>
        <capsuleGeometry args={[0.085, 0.38, 4, 8]} />
        <meshStandardMaterial color={pants} roughness={0.9} />
      </mesh>
      <mesh position={[0.11, 0.38, 0.02]} castShadow>
        <capsuleGeometry args={[0.085, 0.38, 4, 8]} />
        <meshStandardMaterial color={pants} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <boxGeometry args={[0.38, 0.16, 0.22]} />
        <meshStandardMaterial color={pants} roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.18, 0.02]} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 4, 10]} />
        <meshStandardMaterial color={shirt} roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.22, 0.12]}>
        <boxGeometry args={[0.28, 0.22, 0.08]} />
        <meshStandardMaterial color="#ece6dc" roughness={0.72} />
      </mesh>
      <mesh position={[-0.24, 1.12, 0.02]} rotation={[0.2, 0, 0.35]} castShadow>
        <capsuleGeometry args={[0.055, 0.42, 3, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.86} />
      </mesh>
      <mesh position={[0.24, 1.08, 0.08]} rotation={[0.55, 0, -0.45]} castShadow>
        <capsuleGeometry args={[0.055, 0.4, 3, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.86} />
      </mesh>
      <mesh position={[-0.34, 0.86, 0.08]} castShadow>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0.32, 0.86, 0.22]} castShadow>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.48, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.1, 8]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.66, 0.02]} castShadow>
        <sphereGeometry args={[0.145, 12, 12]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>
      <mesh position={[-0.14, 1.66, 0.02]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0.14, 1.66, 0.02]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[-0.05, 1.68, 0.12]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshStandardMaterial color="#1a120e" roughness={0.4} />
      </mesh>
      <mesh position={[0.05, 1.68, 0.12]}>
        <sphereGeometry args={[0.022, 6, 6]} />
        <meshStandardMaterial color="#1a120e" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.62, 0.14]}>
        <sphereGeometry args={[0.028, 6, 6]} />
        <meshStandardMaterial color={skin} roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.74, -0.02]} scale={[1.05, 0.55, 1.05]}>
        <sphereGeometry args={[0.14, 10, 10]} />
        <meshStandardMaterial color={hair} roughness={1} />
      </mesh>
      {hat && (
        <mesh position={[0, 1.8, 0.01]} castShadow>
          <cylinderGeometry args={[0.16, 0.17, 0.1, 10]} />
          <meshStandardMaterial color={hat} roughness={1} />
        </mesh>
      )}
      {hat && (
        <mesh position={[0, 1.76, 0.1]} rotation={[-0.15, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 10]} />
          <meshStandardMaterial color={hat} roughness={1} />
        </mesh>
      )}
      <mesh position={[0, 1.32, 0.16]} rotation={[0.4, 0, 0]}>
        <torusGeometry args={[0.09, 0.012, 6, 12]} />
        <meshStandardMaterial color="#c9a227" metalness={0.65} roughness={0.28} />
      </mesh>
      {ask && <TalkMark />}
    </group>
  )
}

function Drum({ x, z, y = 0.42, rot = 0, color = '#2a3d28' }: { x: number; z: number; y?: number; rot?: number; color?: string }) {
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.84, 0.62]} />
        <meshStandardMaterial color={color} roughness={0.82} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.66, 0.05, 0.66]} />
        <meshStandardMaterial color="#1a1a16" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[0.66, 0.05, 0.66]} />
        <meshStandardMaterial color="#1a1a16" roughness={0.7} />
      </mesh>
    </group>
  )
}

function Crate({ x, y, z, sx, sy, sz, rot, color }: { x: number; y: number; z: number; sx: number; sy: number; sz: number; rot: number; color: string }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, rot, 0]} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  )
}

export function Narco() {
  const zone = city.narco
  const dirt = useMemo(dirtMap, [])
  dirt.repeat.set(6, 6)
  const metal = useMemo(metalMap, [])
  metal.repeat.set(4, 2)
  const grafA = useMemo(() => grafMap('PISTA', '#c4ff4a'), [])
  const grafB = useMemo(() => grafMap('TDA', '#ff4d6a'), [])
  const packs = useMemo(
    () =>
      [
        [0, 0, 0],
        [0.52, 0, 0.18],
        [-0.48, 0, 0.32],
        [0.12, 0.4, 0.06],
        [-0.22, 0.4, 0.26],
        [0.04, 0.8, 0.1],
      ] as Array<[number, number, number]>,
    [],
  )
  const packRoot = useRef<THREE.Group>(null)
  const neon = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const root = packRoot.current
    if (root) {
      root.visible = game.stash?.phase === 'pickup'
      root.position.y = 0.18 + Math.sin(clock.elapsedTime * 2) * 0.04
    }
    if (neon.current) neon.current.emissiveIntensity = 0.55 + Math.sin(clock.elapsedTime * 3.2) * 0.35
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[zone.x, 0.12, zone.z]} receiveShadow>
        <planeGeometry args={[52, 52]} />
        <meshStandardMaterial map={dirt} color="#ffffff" roughness={1} />
      </mesh>

      <mesh position={[zone.x - 4.2, 1.55, zone.z + 7.6]} rotation={[0, 0.4, 0]}>
        <planeGeometry args={[3.4, 2.1]} />
        <meshBasicMaterial map={grafA} transparent depthWrite={false} />
      </mesh>
      <mesh position={[zone.x + 6.8, 1.7, zone.z + 4.2]} rotation={[0, -0.8, 0]}>
        <planeGeometry args={[3.1, 2]} />
        <meshBasicMaterial map={grafB} transparent depthWrite={false} />
      </mesh>

      <mesh position={[zone.x + 3.4, 1.35, zone.z - 8.8]} rotation={[0.55, 0.2, 0.08]} receiveShadow>
        <boxGeometry args={[4.8, 0.06, 2.6]} />
        <meshStandardMaterial map={metal} roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[zone.x - 7.2, 1.15, zone.z + 3.2]} rotation={[0.4, -0.5, 0.1]} receiveShadow>
        <boxGeometry args={[3.6, 0.05, 2.1]} />
        <meshStandardMaterial map={metal} roughness={0.75} metalness={0.2} />
      </mesh>

      <Crate x={zone.x - 1.2} y={0.38} z={zone.z + 3.1} sx={1.15} sy={0.7} sz={0.9} rot={0.3} color="#6b5344" />
      <Crate x={zone.x - 0.5} y={0.92} z={zone.z + 3.25} sx={0.95} sy={0.42} sz={0.72} rot={-0.2} color="#5a4638" />
      <Crate x={zone.x + 2.4} y={0.28} z={zone.z - 1.6} sx={1.6} sy={0.22} sz={1.15} rot={0.1} color="#3a3228" />
      <Crate x={zone.x + 2.5} y={0.62} z={zone.z - 1.5} sx={0.7} sy={0.48} sz={0.55} rot={0.4} color="#4a4036" />
      <Crate x={zone.x - 5.4} y={0.22} z={zone.z - 2.2} sx={0.85} sy={0.35} sz={0.5} rot={-0.5} color="#2a2420" />
      <Crate x={zone.x + 0.8} y={0.18} z={zone.z + 5.4} sx={0.55} sy={0.28} sz={0.7} rot={0.9} color="#1a1a16" />

      <Drum x={zone.stash.x - 1.4} z={zone.stash.z + 1.1} rot={0.2} />
      <Drum x={zone.stash.x - 2.05} z={zone.stash.z + 0.55} y={0.42} rot={-0.3} color="#3a2a18" />
      <Drum x={zone.stash.x + 1.6} z={zone.stash.z + 0.4} color="#243028" />
      <Drum x={zone.x - 6.8} z={zone.z + 1.2} rot={0.5} color="#2c2418" />

      <group position={[zone.x + 4.8, 0.55, zone.z + 2.6]} rotation={[0, 0.7, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.4, 0.9, 1.55]} />
          <meshStandardMaterial color="#4a3024" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[3.5, 0.55, 1.65]} />
          <meshStandardMaterial color="#3a241c" roughness={0.9} />
        </mesh>
        <mesh position={[-1.1, 0.15, 0.9]}>
          <boxGeometry args={[0.55, 0.55, 0.12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
        <mesh position={[1.1, 0.15, 0.9]}>
          <boxGeometry args={[0.55, 0.55, 0.12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </group>

      <mesh position={[zone.x - 1.8, 3.15, zone.z + 0.4]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[3.4, 0.7, 0.12]} />
        <meshStandardMaterial ref={neon} color="#1a1a1a" emissive="#5a8f3a" emissiveIntensity={0.7} />
      </mesh>

      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[zone.x - 8 + i * 2.4, 3.35, zone.z - 1.2 + Math.sin(i) * 1.4]}>
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color="#d9b56a" emissive="#c9a050" emissiveIntensity={0.55} />
        </mesh>
      ))}

      <pointLight position={[zone.x - 2, 3.4, zone.z]} color="#c9a050" intensity={2.1} distance={22} />
      <pointLight position={[zone.x + 6, 2.8, zone.z - 4]} color="#6a8f4a" intensity={1.4} distance={16} />

      <Hood x={zone.talk.x} z={zone.talk.z} yaw={0.4} shirt="#1c1c1c" pants="#243044" skin="#c68642" hat="#111111" hair="#0d0d0d" ask />
      <Hood x={zone.talk.x - 2.1} z={zone.talk.z + 1.7} yaw={-0.6} shirt="#3a2a18" pants="#1a1a1a" skin="#8d5524" hat="#2a1a10" hair="#1a120c" ask bulky />
      <Hood x={zone.talk.x + 1.8} z={zone.talk.z + 2.4} yaw={2.4} shirt="#2a3344" pants="#1e2a3a" skin="#a56b3c" hair="#2a1a12" ask />
      <Hood x={zone.talk.x - 3.6} z={zone.talk.z - 0.8} yaw={1.1} shirt="#4a2018" pants="#2a2a28" skin="#6b3e26" hat="#111" hair="#0a0a0a" ask />
      <Hood x={zone.x + 6.2} z={zone.z - 2.4} yaw={-1.8} shirt="#1a1a1a" pants="#243044" skin="#d9a066" hair="#3a2418" />

      {[-9, -5, -1, 3, 7, 11].map((ox, i) => (
        <group key={`post-${i}`} position={[zone.x + ox, 0, zone.z + 19.4]}>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.12, 2.1, 0.12]} />
            <meshStandardMaterial color="#2a2a28" roughness={0.85} metalness={0.2} />
          </mesh>
          <mesh position={[2, 1.55, 0]}>
            <boxGeometry args={[4.05, 0.04, 0.04]} />
            <meshStandardMaterial color="#3a3a36" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[2, 0.7, 0]}>
            <boxGeometry args={[4.05, 0.04, 0.04]} />
            <meshStandardMaterial color="#3a3a36" metalness={0.3} roughness={0.6} />
          </mesh>
        </group>
      ))}

      <mesh position={[zone.x - 2.8, 2.05, zone.z - 4.2]} rotation={[0, 0.3, 0.02]}>
        <boxGeometry args={[5.4, 0.03, 0.03]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[zone.x - 4.4, 1.55, zone.z - 4.35]} rotation={[0.1, 0.3, 0.2]}>
        <boxGeometry args={[0.7, 0.95, 0.08]} />
        <meshStandardMaterial color="#2a4060" roughness={0.9} />
      </mesh>
      <mesh position={[zone.x - 3.2, 1.45, zone.z - 4.15]} rotation={[-0.15, 0.3, -0.1]}>
        <boxGeometry args={[0.55, 0.8, 0.07]} />
        <meshStandardMaterial color="#8a2a2a" roughness={0.9} />
      </mesh>
      <mesh position={[zone.x - 1.6, 1.5, zone.z - 4]} rotation={[0.05, 0.25, 0.15]}>
        <boxGeometry args={[0.62, 0.85, 0.07]} />
        <meshStandardMaterial color="#d8d0c4" roughness={0.88} />
      </mesh>

      <mesh position={[zone.x + 1.2, 0.12, zone.z + 4.6]} rotation={[0, 0.4, 0]} receiveShadow>
        <boxGeometry args={[1.8, 0.14, 0.95]} />
        <meshStandardMaterial color="#5a4638" roughness={1} />
      </mesh>
      <group position={[zone.x - 4.8, 0.38, zone.z + 6.2]} rotation={[0, 0.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.05, 0.55, 0.7]} />
          <meshStandardMaterial color="#6a6a68" metalness={0.35} roughness={0.55} />
        </mesh>
        <mesh position={[0.38, 0.28, 0.28]}>
          <boxGeometry args={[0.18, 0.18, 0.08]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.38, 0.28, 0.28]}>
          <boxGeometry args={[0.18, 0.18, 0.08]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      <group position={[zone.stash.x + 2.4, 0.55, zone.stash.z - 1.2]}>
        <Drum x={0} z={0} y={0} color="#3a2818" />
        <pointLight position={[0, 1.1, 0]} color="#ff7a32" intensity={2.4} distance={10} />
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.2, 0.35, 0.2]} />
          <meshStandardMaterial color="#ff5a1a" emissive="#ff4a10" emissiveIntensity={1.4} />
        </mesh>
      </group>

      <Crate x={zone.x + 5.1} y={0.22} z={zone.z + 7.2} sx={1.05} sy={0.32} sz={0.8} rot={-0.4} color="#3a3228" />
      <Crate x={zone.x + 5.3} y={0.52} z={zone.z + 7.1} sx={0.7} sy={0.28} sz={0.55} rot={0.2} color="#5a4030" />
      <Crate x={zone.x - 8.2} y={0.35} z={zone.z - 6.4} sx={1.4} sy={0.55} sz={0.85} rot={0.7} color="#2c241c" />
      <Drum x={zone.x + 8.4} z={zone.z + 5.2} rot={0.8} color="#2a2018" />
      <Drum x={zone.x + 8.95} z={zone.z + 4.7} rot={-0.2} color="#243022" />
      <mesh position={[zone.x + 9.2, 0.22, zone.z + 8.1]} rotation={[0.1, 0.4, 0.05]}>
        <boxGeometry args={[0.95, 0.22, 0.95]} />
        <meshStandardMaterial color="#1a1a18" roughness={1} />
      </mesh>
      <mesh position={[zone.x + 9.15, 0.42, zone.z + 8.05]} rotation={[0.1, 0.5, 0.04]}>
        <boxGeometry args={[0.9, 0.18, 0.9]} />
        <meshStandardMaterial color="#222220" roughness={1} />
      </mesh>

      <mesh position={[zone.x + 10.4, 3.6, zone.z + 10.2]} rotation={[0.6, 0.2, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.9]} />
        <meshStandardMaterial color="#8a8a88" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[zone.x + 10.4, 3.15, zone.z + 10.2]}>
        <boxGeometry args={[0.08, 0.7, 0.08]} />
        <meshStandardMaterial color="#4a4a48" />
      </mesh>

      <mesh position={[zone.x + 0.4, 1.85, zone.z + 8.8]} rotation={[0, -1.1, 0]}>
        <planeGeometry args={[2.8, 1.7]} />
        <meshBasicMaterial map={grafA} transparent depthWrite={false} />
      </mesh>
      <mesh position={[zone.x - 10.2, 1.9, zone.z + 7.8]} rotation={[0, 0.85, 0]}>
        <planeGeometry args={[2.4, 1.5]} />
        <meshBasicMaterial map={grafB} transparent depthWrite={false} />
      </mesh>

      {[
        [zone.x - 3.4, zone.z + 1.2, 2.4],
        [zone.x + 4.2, zone.z + 6.8, 1.8],
        [zone.x - 6.8, zone.z - 4.2, 2.1],
        [zone.x + 2.2, zone.z - 6.6, 1.5],
      ].map(([px, pz, s], i) => (
        <mesh key={`pit-${i}`} rotation-x={-Math.PI / 2} position={[px, 0.13, pz]} receiveShadow>
          <circleGeometry args={[s * 0.5, 10]} />
          <meshStandardMaterial color="#14110d" roughness={1} />
        </mesh>
      ))}

      <mesh position={[zone.x - 0.4, 2.9, zone.z + 1.6]} rotation={[0.08, 0.4, 0.12]}>
        <boxGeometry args={[18, 0.035, 0.035]} />
        <meshStandardMaterial color="#1a1a18" />
      </mesh>
      <mesh position={[zone.x + 1.8, 2.45, zone.z - 0.6]} rotation={[-0.12, -0.5, -0.08]}>
        <boxGeometry args={[14, 0.03, 0.03]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[zone.x + 3.2, 3.2, zone.z + 3.4]} rotation={[0.2, 0.15, 0.05]}>
        <boxGeometry args={[11, 0.025, 0.025]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      <group position={[zone.x - 7.4, 0.22, zone.z + 8.8]} rotation={[0, 0.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.55, 0.22, 0.85]} />
          <meshStandardMaterial color="#3a2c22" roughness={1} />
        </mesh>
        <mesh position={[0, 0.28, 0]} rotation={[0.15, 0.2, 0]}>
          <boxGeometry args={[1.35, 0.12, 0.7]} />
          <meshStandardMaterial color="#4a3428" roughness={1} />
        </mesh>
      </group>
      <pointLight position={[zone.x - 10, 2.2, zone.z + 12]} color="#ff9a40" intensity={1.1} distance={14} />
      <pointLight position={[zone.x + 8, 1.6, zone.z + 10]} color="#6a6a88" intensity={0.7} distance={12} />

      <group ref={packRoot} position={[zone.stash.x, 0.2, zone.stash.z]} visible={false}>
        {packs.map(([px, py, pz], index) => (
          <mesh key={index} position={[px, py + 0.2, pz]} rotation={[0, index * 0.2, 0]} castShadow>
            <boxGeometry args={[0.7, 0.38, 0.48]} />
            <meshStandardMaterial color="#efe8dc" roughness={0.7} />
          </mesh>
        ))}
        <WorldMark
          text="Recoger"
          width={2.6}
          height={1.15}
          y={1.55}
          show={() => game.stash?.phase === 'pickup'}
        />
      </group>
    </group>
  )
}
