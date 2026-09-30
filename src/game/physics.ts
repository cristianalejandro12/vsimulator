export type Collider = {
  id?: string
  x: number
  z: number
  hx: number
  hz: number
  fx: number
  fz: number
  rx: number
  rz: number
}

export const staticColliders: Collider[] = []
export const moverColliders: Collider[] = []

let housesLoaded = false

export function addStaticColliders(list: Collider[]) {
  if (housesLoaded) return
  housesLoaded = true
  staticColliders.push(...list)
}

export function upsertCollider(collider: Collider) {
  const index = staticColliders.findIndex((item) => item.id && item.id === collider.id)
  if (index >= 0) staticColliders[index] = collider
  else staticColliders.push(collider)
}

export function circleHits(x: number, z: number, radius: number, box: Collider) {
  const dx = x - box.x
  const dz = z - box.z
  const along = dx * box.fx + dz * box.fz
  const side = dx * box.rx + dz * box.rz
  const closestAlong = clamp(along, -box.hx, box.hx)
  const closestSide = clamp(side, -box.hz, box.hz)
  const ddx = along - closestAlong
  const ddz = side - closestSide
  return ddx * ddx + ddz * ddz < radius * radius
}

export function overlaps(x: number, z: number, radius: number) {
  for (let i = 0; i < staticColliders.length; i++) {
    if (circleHits(x, z, radius, staticColliders[i])) return true
  }
  for (let i = 0; i < moverColliders.length; i++) {
    if (circleHits(x, z, radius, moverColliders[i])) return true
  }
  return false
}

export function resolveCircle(x: number, z: number, radius: number) {
  let cx = x
  let cz = z
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < staticColliders.length; i++) pushOut(staticColliders[i])
    for (let i = 0; i < moverColliders.length; i++) pushOut(moverColliders[i])
  }
  return { x: cx, z: cz }

  function pushOut(box: Collider) {
    const dx = cx - box.x
    const dz = cz - box.z
    const along = dx * box.fx + dz * box.fz
    const side = dx * box.rx + dz * box.rz
    const closestAlong = clamp(along, -box.hx, box.hx)
    const closestSide = clamp(side, -box.hz, box.hz)
    let outAlong = along - closestAlong
    let outSide = side - closestSide
    const distSq = outAlong * outAlong + outSide * outSide
    if (distSq >= radius * radius) return
    if (distSq < 1e-8) {
      const penAlong = box.hx - Math.abs(along)
      const penSide = box.hz - Math.abs(side)
      if (penAlong < penSide) {
        outAlong = Math.sign(along || 1) * (radius + penAlong)
        outSide = 0
      } else {
        outSide = Math.sign(side || 1) * (radius + penSide)
        outAlong = 0
      }
    } else {
      const dist = Math.sqrt(distSq)
      const push = (radius - dist) / dist
      outAlong *= push
      outSide *= push
    }
    cx += box.fx * outAlong + box.rx * outSide
    cz += box.fz * outAlong + box.rz * outSide
  }
}

export function makeAxes(heading: number, length: number, width: number, x: number, z: number, id?: string): Collider {
  const fx = Math.cos(heading)
  const fz = Math.sin(heading)
  return {
    id,
    x,
    z,
    hx: length / 2,
    hz: width / 2,
    fx,
    fz,
    rx: fz,
    rz: -fx,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
