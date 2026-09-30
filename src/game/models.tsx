import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Object3D } from 'three'

export function prepareVehicle(source: Object3D, targetLength: number, shadows = false, yaw = 0) {
  const root = source.clone(true)
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = shadows
    mesh.receiveShadow = true
    mesh.frustumCulled = false
  })
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.scale.setScalar(1)
  root.updateMatrixWorld(true)

  let measured = new THREE.Box3().setFromObject(root)
  let size = measured.getSize(new THREE.Vector3())
  if (size.z > size.x) {
    root.rotation.y = Math.PI / 2
    root.updateMatrixWorld(true)
    measured = new THREE.Box3().setFromObject(root)
    size = measured.getSize(new THREE.Vector3())
  }
  root.rotation.y += yaw
  const longest = Math.max(size.x, size.z, 0.001)
  root.scale.setScalar(targetLength / longest)
  root.updateMatrixWorld(true)

  const fitted = new THREE.Box3().setFromObject(root)
  const center = fitted.getCenter(new THREE.Vector3())
  const fittedSize = fitted.getSize(new THREE.Vector3())
  root.position.set(-center.x, -fitted.min.y, -center.z)
  return {
    object: root,
    length: Math.max(fittedSize.x, fittedSize.z),
    height: fittedSize.y,
    width: Math.min(fittedSize.x, fittedSize.z),
  }
}

export function prepareBuilding(source: Object3D, targetWidth: number, targetDepth: number, maxHeight: number) {
  const root = source.clone(true)
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = false
      mesh.receiveShadow = true
    }
  })
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.scale.setScalar(1)
  root.updateMatrixWorld(true)

  let box = new THREE.Box3().setFromObject(root)
  let size = box.getSize(new THREE.Vector3())
  if (size.z > size.x) {
    root.rotation.y = Math.PI / 2
    root.updateMatrixWorld(true)
    box = new THREE.Box3().setFromObject(root)
    size = box.getSize(new THREE.Vector3())
  }

  const scale = Math.min(targetWidth / Math.max(size.x, 0.001), targetDepth / Math.max(size.z, 0.001), maxHeight / Math.max(size.y, 0.001))
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(root)
  const center = box.getCenter(new THREE.Vector3())
  root.position.set(-center.x, -box.min.y, -center.z)
  const fitted = box.getSize(new THREE.Vector3())
  return { object: root, width: fitted.x, depth: fitted.z, height: fitted.y }
}

export function VehicleModel({ url, length, yaw = 0 }: { url: string; length: number; yaw?: number }) {
  const { scene } = useGLTF(url, false, true)
  const prepared = useMemo(() => prepareVehicle(scene, length, false, yaw), [scene, length, yaw])
  return <primitive object={prepared.object} />
}
