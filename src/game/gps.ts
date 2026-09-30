import { CELL, nodesAt, SPAN, toWorld } from './city'

type GraphNode = { i: number; j: number; x: number; z: number }

const nodes: GraphNode[] = []

function buildNodes() {
  if (nodes.length) return
  const count = nodesAt()
  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      nodes.push({
        i,
        j,
        x: toWorld(i * CELL + 7),
        z: toWorld(j * CELL + 7),
      })
    }
  }
}

function nodeIndex(i: number, j: number) {
  return j * nodesAt() + i
}

type Projection = {
  x: number
  z: number
  a: number
  b: number
  dist: number
}

function nearestProjection(x: number, z: number): Projection {
  buildNodes()
  const count = nodesAt()
  let best: Projection = { x, z, a: 0, b: 0, dist: Infinity }

  const consider = (ax: number, az: number, bx: number, bz: number, ia: number, ib: number) => {
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz
    if (len2 < 0.001) return
    let t = ((x - ax) * dx + (z - az) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    const px = ax + dx * t
    const pz = az + dz * t
    const dist = (px - x) ** 2 + (pz - z) ** 2
    if (dist < best.dist) best = { x: px, z: pz, a: ia, b: ib, dist }
  }

  for (let j = 0; j < count; j++) {
    for (let i = 0; i < count; i++) {
      const current = nodes[nodeIndex(i, j)]
      if (i + 1 < count) {
        const next = nodes[nodeIndex(i + 1, j)]
        consider(current.x, current.z, next.x, next.z, nodeIndex(i, j), nodeIndex(i + 1, j))
      }
      if (j + 1 < count) {
        const next = nodes[nodeIndex(i, j + 1)]
        consider(current.x, current.z, next.x, next.z, nodeIndex(i, j), nodeIndex(i, j + 1))
      }
    }
  }
  return best
}

function heuristic(a: number, b: number) {
  const na = nodes[a]
  const nb = nodes[b]
  return Math.abs(na.x - nb.x) + Math.abs(na.z - nb.z)
}

function astar(start: number, goal: number) {
  buildNodes()
  if (start === goal) return [start]
  const count = nodes.length
  const open: number[] = [start]
  const came = new Map<number, number>()
  const g = new Map<number, number>([[start, 0]])
  const f = new Map<number, number>([[start, heuristic(start, goal)]])
  const closed = new Set<number>()
  const n = nodesAt()

  while (open.length) {
    open.sort((a, b) => (f.get(a) ?? Infinity) - (f.get(b) ?? Infinity))
    const current = open.shift()!
    if (current === goal) {
      const path = [current]
      let cursor = current
      while (came.has(cursor)) {
        cursor = came.get(cursor)!
        path.push(cursor)
      }
      path.reverse()
      return path
    }
    closed.add(current)
    const node = nodes[current]
    const neighbors = [
      [node.i + 1, node.j],
      [node.i - 1, node.j],
      [node.i, node.j + 1],
      [node.i, node.j - 1],
    ]
    for (const [ni, nj] of neighbors) {
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue
      const next = nodeIndex(ni, nj)
      if (closed.has(next)) continue
      const cost = (g.get(current) ?? Infinity) + CELL
      if (cost < (g.get(next) ?? Infinity)) {
        came.set(next, current)
        g.set(next, cost)
        f.set(next, cost + heuristic(next, goal))
        if (!open.includes(next)) open.push(next)
      }
    }
  }
  return [start]
}

function dedupe(points: { x: number; z: number }[]) {
  const out: { x: number; z: number }[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(last.x - point.x, last.z - point.z) > 1.2) out.push(point)
  }
  return out
}

export function route(fromX: number, fromZ: number, toX: number, toZ: number) {
  buildNodes()
  const start = nearestProjection(fromX, fromZ)
  const end = nearestProjection(toX, toZ)
  const sameEdge =
    (start.a === end.a && start.b === end.b) || (start.a === end.b && start.b === end.a)

  if (sameEdge) {
    return dedupe([
      { x: fromX, z: fromZ },
      { x: start.x, z: start.z },
      { x: end.x, z: end.z },
      { x: toX, z: toZ },
    ])
  }

  const options = [
    [start.a, end.a],
    [start.a, end.b],
    [start.b, end.a],
    [start.b, end.b],
  ]
  let bestPath: number[] = []
  let bestScore = Infinity
  for (const [a, b] of options) {
    const path = astar(a, b)
    const score =
      path.length * CELL +
      Math.hypot(nodes[a].x - start.x, nodes[a].z - start.z) +
      Math.hypot(nodes[b].x - end.x, nodes[b].z - end.z)
    if (score < bestScore) {
      bestScore = score
      bestPath = path
    }
  }

  const points = [{ x: fromX, z: fromZ }, { x: start.x, z: start.z }]
  const first = bestPath[0]
  const anchor =
    Math.hypot(nodes[first].x - start.x, nodes[first].z - start.z) <
    Math.hypot(nodes[bestPath[bestPath.length - 1]].x - start.x, nodes[bestPath[bestPath.length - 1]].z - start.z)
      ? bestPath
      : [...bestPath].reverse()

  for (const index of anchor) points.push({ x: nodes[index].x, z: nodes[index].z })
  points.push({ x: end.x, z: end.z }, { x: toX, z: toZ })
  return dedupe(points)
}

export const MAP_SPAN = SPAN
