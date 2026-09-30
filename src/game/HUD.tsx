import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useProgress } from '@react-three/drei'
import { city } from './city'
import { nearbyPhones } from './Phones'
import { bootAudioAndShift } from './Player'
import { acceptOffer, clockLabel, formatClp, game, getVersion, rejectOffer, subscribe, tickExtortion } from './store'

export function HUD() {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion)
  void version
  const speedRef = useRef<HTMLSpanElement>(null)
  const distRef = useRef<HTMLSpanElement>(null)
  const etaRef = useRef<HTMLSpanElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Enter') {
        if (!game.started) bootAudioAndShift()
        else if (game.offer) acceptOffer()
      }
      if (event.code === 'Escape' && game.offer) rejectOffer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const canvas = mapRef.current
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const size = 272
    canvas.width = size * ratio
    canvas.height = size * ratio
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      const kph = Math.round(Math.abs(game.speed) * 3.6)
      if (speedRef.current) speedRef.current.textContent = String(kph)
      if (distRef.current) {
        const distance = game.distance
        distRef.current.textContent = distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`
      }
      if (etaRef.current) etaRef.current.textContent = `${Math.max(4, Math.round(game.distance / 22))} min`
      if (clockRef.current) clockRef.current.textContent = clockLabel()
      tickExtortion()
      drawMap(ctx, canvas.width, canvas.height)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  const mission = game.mission
  const objective = mission?.phase === 'deliver' ? 'Entrega el pedido' : mission?.phase === 'pickup' ? 'Recoge el pedido' : 'Buscando pedido'

  return (
    <div className="hud">
      <div className="top-left">
        <div className="cash">
          <span>CLP</span>
          <strong>{formatClp(game.money)}</strong>
        </div>
        {game.banner && <div className="banner">{game.banner}</div>}
        <div className="daychip"><span ref={clockRef}>16:00:00</span></div>
      </div>

      {mission && mission.phase !== 'cooldown' && (
        <div className="offer ticket">
          <div className="offer-head">
            <div className="offer-mark" style={{ background: mission.color }}>{mission.brandName.slice(0, 1)}</div>
            <div>
              <div className="offer-name">{mission.brandName}</div>
              <p>1 × {mission.item}</p>
            </div>
            <strong className="offer-price">{formatClp(mission.reward)}</strong>
          </div>
          <div className="offer-meta">
            <span>{objective}</span>
            <span ref={etaRef}>8 min</span>
            <span ref={distRef}>0 m</span>
          </div>
          <div className="offer-route">
            <div className={`offer-stop${mission.phase === 'pickup' ? '' : ' offer-dim'}`}>
              <i />
              <div>
                <strong>{mission.phase === 'pickup' ? 'Ahora' : 'Recogido'}</strong>
                <p>{mission.brandName}</p>
              </div>
            </div>
            <div className={`offer-stop${mission.phase === 'deliver' ? '' : ' offer-dim'}`}>
              <i className="sq" />
              <div>
                <strong>{mission.phase === 'deliver' ? 'Ahora' : 'Después'}</strong>
                <p>{mission.drop.address}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="speedo">
        <span ref={speedRef}>0</span>
        <small>km/h</small>
      </div>

      <canvas ref={mapRef} className="minimap" />
      {game.offer && (
        <div key={game.offer.id} className="offer">
          <div className="offer-head">
            <div className="offer-mark" style={{ background: game.offer.mission.color }}>
              {game.offer.mission.brandName.slice(0, 1)}
            </div>
            <div>
              <div className="offer-name">{game.offer.mission.brandName}</div>
              <p>1 × {game.offer.mission.item}</p>
            </div>
            <strong className="offer-price">{formatClp(game.offer.mission.reward)}</strong>
          </div>
          <div className="offer-meta">
            <span>★ {game.offer.rating}</span>
            <span>✓ Verificado</span>
          </div>
          <div className="offer-route">
            <div className="offer-stop">
              <i />
              <div>
                <strong>{game.offer.pickupMin} min ({game.offer.pickupDist})</strong>
                <p>{game.offer.mission.brandName}</p>
              </div>
            </div>
            <div className="offer-stop">
              <i className="sq" />
              <div>
                <strong>{game.offer.tripMin} min ({game.offer.tripDist}) de viaje</strong>
                <p>{game.offer.mission.drop.address}</p>
              </div>
            </div>
          </div>
          <button type="button" className="offer-accept" disabled={game.carrying} onClick={acceptOffer}>
            {game.carrying ? 'Termina este pedido' : 'Aceptar'}
            {!game.carrying && <small>Enter</small>}
          </button>
          <button type="button" className="offer-reject" onClick={rejectOffer}>Rechazar <small>Esc</small></button>
        </div>
      )}

      {game.notice && (
        <div key={game.notice.id} className={`notice notice-${game.notice.tone}`}>
          <span>{game.notice.emoji}</span>
          <div>
            <strong>{game.notice.title}</strong>
            <p>{game.notice.text}</p>
          </div>
        </div>
      )}

      {game.pursuit && (
        <div className={`quota ${game.pursuit.phase === 'chase' ? 'quota-hot' : ''} ${game.shakedown ? 'quota-lower' : ''}`}>
          <small>
            {game.pursuit.phase === 'bust'
              ? 'Te pillaron'
              : game.pursuit.phase === 'delay'
                ? 'Policía en camino'
                : performance.now() >= game.pursuit.until
                  ? '¡Aléjate!'
                  : 'Policía'}
          </small>
          <strong>
            {game.pursuit.phase === 'bust'
              ? '¡Alto!'
              : game.pursuit.phase === 'chase' && performance.now() >= game.pursuit.until
                ? '¡Corre!'
                : quotaClock(game.pursuit.until)}
          </strong>
          {game.pursuit.phase === 'chase' && <p>Piérdelos lejos</p>}
          {game.pursuit.phase === 'bust' && <p>¡Alto ahí!</p>}
        </div>
      )}

      {game.shakedown && (
        <div className={`quota ${game.shakedown.status === 'unpaid' ? 'quota-hot' : ''}`}>
          <small>{game.shakedown.name}</small>
          <strong>{game.shakedown.status === 'waiting' ? quotaClock(game.shakedown.deadline) : 'NO PAGARON'}</strong>
          <p>{game.shakedown.status === 'waiting' ? `Cuota ${formatClp(200000)}` : 'Vuelve al local y aprieta E'}</p>
        </div>
      )}

      {game.prompt && <div className="prompt">{game.prompt}</div>}
      {game.floater && <div className="floater">{game.floater}</div>}

      {!game.started && (
        <div className="menu">
          <div className="menu-card">
            <p className="eyebrow">Turno de reparto</p>
            <h1>Venezuela Simulator</h1>
            <ul>
              <li><kbd>W</kbd> acelera · <kbd>S</kbd> frena</li>
              <li><kbd>A</kbd> y <kbd>D</kbd> giran la moto</li>
              <li>El mouse solo mueve la cámara</li>
              <li><kbd>Shift</kbd> acelerar</li>
              <li><kbd>Enter</kbd> acepta un pedido · <kbd>Esc</kbd> lo rechaza</li>
              <li><kbd>E</kbd> recoger y entregar</li>
              <li>En el paradero, roza a la persona y corre</li>
              <li>En un bar, <kbd>E</kbd> para extorsionar</li>
              <li><kbd>R</kbd> volver a la avenida</li>
              <li><kbd>H</kbd> bocina · <kbd>M</kbd> silencio</li>
              <li><kbd>T</kbd> día, atardecer y noche</li>
            </ul>
            <p className="menu-copy">
              El círculo marca dónde dejar la moto. Recoges el pedido y lo llevas a la casa.
            </p>
            <p className="menu-start">Pulsa Enter para empezar</p>
          </div>
        </div>
      )}
    </div>
  )
}

function quotaClock(deadline: number) {
  const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
  const seconds = left % 60
  return `${Math.floor(left / 60)}:${seconds.toString().padStart(2, '0')}`
}

function project(wx: number, wz: number, width: number, height: number, scale: number) {
  const dx = wx - game.x
  const dz = wz - game.z
  const heading = game.camHeading
  const forward = dx * Math.cos(heading) + dz * Math.sin(heading)
  const right = dx * Math.sin(heading) - dz * Math.cos(heading)
  return {
    x: width / 2 + right * scale,
    y: height / 2 - forward * scale,
  }
}

function drawMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const scale = (width / 2 - 18) / 62
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.beginPath()
  ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#4c7832'
  ctx.fillRect(0, 0, width, height)

  const corner = Math.max(14, width * 0.055)
  ctx.fillStyle = '#5d8c3c'
  for (const quad of city.grass) fillQuad(ctx, quad, width, height, scale, corner * 0.85)
  for (const roof of city.roofs) {
    if (roof.sx < 2.4 || roof.sz < 2.4) continue
    ctx.fillStyle = roof.color
    fillFootprint(ctx, roof, width, height, scale, corner * 0.35)
  }
  for (const crown of city.crowns) {
    const projected = project(crown.x, crown.z, width, height, scale)
    ctx.fillStyle = '#2f6a28'
    fillDot(ctx, projected.x, projected.y, 3.5)
  }
  ctx.fillStyle = '#8f897c'
  for (const quad of city.sidewalk) fillQuad(ctx, quad, width, height, scale, corner * 0.55)
  ctx.fillStyle = '#ffffff'
  for (const quad of city.asphalt) fillQuad(ctx, quad, width, height, scale, corner)

  ctx.strokeStyle = '#276ef1'
  ctx.lineWidth = Math.max(5, width / 48)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  game.path.forEach((point, index) => {
    const projected = project(point.x, point.z, width, height, scale)
    if (index === 0) ctx.moveTo(projected.x, projected.y)
    else ctx.lineTo(projected.x, projected.y)
  })
  ctx.stroke()

  for (const pitch of city.pitches) {
    const projected = project(pitch.x, pitch.z, width, height, scale)
    ctx.fillStyle = '#8fd18a'
    fillDot(ctx, projected.x, projected.y, 7)
  }

  for (const venue of city.venues) {
    const burned = game.burned.includes(venue.id)
    const projected = clampIcon(project(venue.x, venue.z, width, height, scale), width, height)
    ctx.fillStyle = burned ? '#5a4638' : venue.color
    fillDot(ctx, projected.x, projected.y, 6)
  }

  for (const spot of city.landmarks) {
    const projected = clampIcon(project(spot.x, spot.z, width, height, scale), width, height)
    ctx.fillStyle = spot.id === 'costanera' ? '#7ecbdc' : '#0b3f86'
    fillDot(ctx, projected.x, projected.y, 7)
  }

  for (const prop of city.props) {
    const projected = clampIcon(project(prop.x, prop.z, width, height, scale), width, height)
    ctx.fillStyle = prop.kind === 'pizza' ? '#ee3d23' : prop.kind === 'horizon' ? '#7eb6e8' : '#c9b6f2'
    fillDot(ctx, projected.x, projected.y, 5)
  }

  for (const restaurant of city.restaurants) {
    const projected = clampIcon(project(restaurant.pickup.x, restaurant.pickup.z, width, height, scale), width, height)
    ctx.fillStyle = restaurant.color
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 7, 0, Math.PI * 2)
    ctx.fill()
  }

  const mission = game.mission
  if (mission && mission.phase !== 'cooldown') {
    const target = mission.phase === 'pickup' ? mission.pickup : mission.drop
    const projected = clampIcon(project(target.x, target.z, width, height, scale), width, height)
    ctx.strokeStyle = mission.phase === 'deliver' ? '#37d67a' : '#ffe14a'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 12, 0, Math.PI * 2)
    ctx.stroke()
  }

  const northForward = Math.sin(game.camHeading)
  const northRight = -Math.cos(game.camHeading)
  const rim = width / 2 - 16
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#173018'
  ctx.lineWidth = Math.max(3, width / 80)
  ctx.font = `700 ${Math.round(width / 16)}px Fredoka, Trebuchet MS, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText('N', width / 2 + northRight * rim, height / 2 - northForward * rim)
  ctx.fillText('N', width / 2 + northRight * rim, height / 2 - northForward * rim)

  const emoji = Math.round(width / 10)
  ctx.font = `${emoji}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const phone of nearbyPhones(110)) {
    const spot = clampIcon(project(phone.x, phone.z, width, height, scale), width, height)
    drawOutlinedEmoji(ctx, '📱', spot.x, spot.y, Math.max(3, width / 90))
  }

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(game.heading - game.camHeading)
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(-7, 9)
  ctx.lineTo(7, 9)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = Math.max(3, width / 70)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()

  if (game.pursuit && game.pursuit.phase !== 'delay') {
    const cop = clampIcon(project(game.pursuit.x, game.pursuit.z, width, height, scale), width, height)
    ctx.font = `${Math.round(width / 8)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
    drawOutlinedEmoji(ctx, '🚓', cop.x, cop.y, Math.max(3, width / 80))
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(width / 2, height / 2, width / 2 - 4, 0, Math.PI * 2)
  ctx.stroke()
}

function drawOutlinedEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, ring: number) {
  ctx.save()
  ctx.shadowColor = '#111111'
  ctx.shadowBlur = 0
  for (let step = 0; step < 8; step++) {
    const angle = (step / 8) * Math.PI * 2
    ctx.shadowOffsetX = Math.cos(angle) * ring
    ctx.shadowOffsetY = Math.sin(angle) * ring
    ctx.fillText(emoji, x, y)
  }
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillText(emoji, x, y)
  ctx.restore()
}

function fillDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function fillFootprint(
  ctx: CanvasRenderingContext2D,
  box: { x: number; z: number; sx: number; sz: number; rot: number },
  width: number,
  height: number,
  scale: number,
  radius: number,
) {
  const hx = box.sx / 2
  const hz = box.sz / 2
  const cos = Math.cos(box.rot)
  const sin = Math.sin(box.rot)
  const corners = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ].map(([lx, lz]) => project(box.x + lx * cos + lz * sin, box.z - lx * sin + lz * cos, width, height, scale))
  fillCorners(ctx, corners, radius)
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  quad: { x0: number; z0: number; x1: number; z1: number },
  width: number,
  height: number,
  scale: number,
  radius = 0,
) {
  const corners = [
    project(quad.x0, quad.z0, width, height, scale),
    project(quad.x1, quad.z0, width, height, scale),
    project(quad.x1, quad.z1, width, height, scale),
    project(quad.x0, quad.z1, width, height, scale),
  ]
  fillCorners(ctx, corners, radius)
}

function fillCorners(ctx: CanvasRenderingContext2D, corners: { x: number; y: number }[], radius: number) {
  ctx.beginPath()
  const count = corners.length
  for (let index = 0; index < count; index++) {
    const prev = corners[(index + count - 1) % count]
    const curr = corners[index]
    const next = corners[(index + 1) % count]
    const inX = curr.x - prev.x
    const inY = curr.y - prev.y
    const outX = next.x - curr.x
    const outY = next.y - curr.y
    const inLen = Math.hypot(inX, inY) || 1
    const outLen = Math.hypot(outX, outY) || 1
    const bend = Math.min(radius, inLen * 0.46, outLen * 0.46)
    const fromX = curr.x - (inX / inLen) * bend
    const fromY = curr.y - (inY / inLen) * bend
    const toX = curr.x + (outX / outLen) * bend
    const toY = curr.y + (outY / outLen) * bend
    if (index === 0) ctx.moveTo(fromX, fromY)
    else ctx.lineTo(fromX, fromY)
    ctx.quadraticCurveTo(curr.x, curr.y, toX, toY)
  }
  ctx.closePath()
  ctx.fill()
}

function clampIcon(point: { x: number; y: number }, width: number, height: number) {
  const dx = point.x - width / 2
  const dy = point.y - height / 2
  const radius = width / 2 - 18
  const dist = Math.hypot(dx, dy)
  if (dist <= radius) return point
  return { x: width / 2 + (dx / dist) * radius, y: height / 2 + (dy / dist) * radius }
}

export function Loader() {
  const { progress } = useProgress()
  return (
    <div className="loader">
      <div>
        <p className="eyebrow">Venezuela Simulator</p>
        <h1>Preparando la ciudad</h1>
        <div className="bar">
          <div style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  )
}

export function QuietLoad() {
  const { active, item, progress } = useProgress()
  if (!active || !game.started) return null
  const lower = item.toLowerCase()
  const name = lower.includes('mcdonald') ? "McDonald's" : lower.includes('kfc') ? 'KFC' : lower.includes('burger') ? 'Burger King' : ''
  if (!name) return null
  return <div className="quiet-load">Cargando {name}… {Math.round(progress)}%</div>
}
