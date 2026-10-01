import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useProgress } from '@react-three/drei'
import { city, SPAN } from './city'
import { nearbyCans } from './Cans'
import { nearbyPhones } from './Phones'
import { bootAudioAndShift } from './Player'
import { acceptCartel, acceptOffer, acceptStash, BRAND_LOGO, clearWaypoint, clockLabel, formatClp, game, getVersion, kitchenLeft, poke, premiumLeft, refuseCartel, rejectOffer, rejectStash, setWaypoint, subscribe, tickCancel, tickExtortion, tickKitchen, tickPremium, toggleMap, WAIT_RADIUS, type BrandId } from './store'

export function HUD() {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion)
  void version
  const speedRef = useRef<HTMLSpanElement>(null)
  const distRef = useRef<HTMLSpanElement>(null)
  const etaRef = useRef<HTMLSpanElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const atlasRef = useRef<HTMLCanvasElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const waitClockRef = useRef<HTMLSpanElement>(null)
  const waitFillRef = useRef<HTMLDivElement>(null)
  const rivalShopRef = useRef<HTMLSpanElement>(null)
  const rivalYouRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'KeyM' && game.started) {
        event.preventDefault()
        event.stopPropagation()
        toggleMap()
        return
      }
      if (event.code === 'Enter') {
        if (!game.started) bootAudioAndShift()
        else if (game.cartelTalk) acceptCartel()
        else if (game.stashOffer && game.offer) return
        else if (game.stashOffer) acceptStash()
        else if (game.offer) acceptOffer()
      }
      if (event.code === 'Escape' || event.key === 'Escape') {
        if (game.mapOpen) {
          event.preventDefault()
          event.stopPropagation()
          game.mapOpen = false
          poke()
          return
        }
        if (game.cartelTalk) {
          event.preventDefault()
          event.stopPropagation()
          refuseCartel()
        } else if (game.stashOffer && game.offer) {
          return
        } else if (game.stashOffer) {
          event.preventDefault()
          event.stopPropagation()
          rejectStash()
        } else if (game.offer) {
          event.preventDefault()
          event.stopPropagation()
          rejectOffer()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
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
      if (timerRef.current) {
        const left = premiumLeft()
        timerRef.current.textContent = left > 0 ? `0:${String(left).padStart(2, '0')}` : ''
      }
      if (waitClockRef.current) {
        const hold = kitchenLeft()
        waitClockRef.current.textContent = hold > 0 ? `0:${String(hold).padStart(2, '0')}` : ''
      }
      if (waitFillRef.current) {
        const hold = kitchenLeft()
        waitFillRef.current.style.setProperty('--wait', `${(hold / 25) * 360}deg`)
      }
      if (game.rival) {
        const shop = game.rival.toShop >= 1000 ? `${(game.rival.toShop / 1000).toFixed(1)} km` : `${Math.round(game.rival.toShop)} m`
        const you = game.rival.toYou >= 1000 ? `${(game.rival.toYou / 1000).toFixed(1)} km` : `${Math.round(game.rival.toYou)} m`
        if (rivalShopRef.current) rivalShopRef.current.textContent = shop
        if (rivalYouRef.current) rivalYouRef.current.textContent = you
      }
      tickExtortion()
      tickPremium()
      tickKitchen()
      tickCancel()
      drawMap(ctx, canvas.width, canvas.height, 'mini')
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const canvas = atlasRef.current
    if (!canvas || !game.mapOpen) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const css = Math.min(window.innerWidth, window.innerHeight) * 0.86
    canvas.width = css * ratio
    canvas.height = css * ratio
    canvas.style.width = `${css}px`
    canvas.style.height = `${css}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      drawMap(ctx, canvas.width, canvas.height, 'world')
    }
    const onClick = (event: MouseEvent) => {
      const box = canvas.getBoundingClientRect()
      const sx = ((event.clientX - box.left) / box.width) * canvas.width
      const sy = ((event.clientY - box.top) / box.height) * canvas.height
      const scale = (Math.min(canvas.width, canvas.height) - 56) / SPAN
      setWaypoint((sx - canvas.width / 2) / scale, (sy - canvas.height / 2) / scale)
    }
    const onContext = (event: MouseEvent) => {
      event.preventDefault()
      clearWaypoint()
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('contextmenu', onContext)
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('contextmenu', onContext)
    }
  }, [game.mapOpen])

  const mission = game.mission
  const stash = game.stash
  const waiting = !!(mission?.holdUntil && mission.phase === 'pickup')
  const objective = waiting
    ? 'Espera el pedido, no te alejes'
    : mission?.phase === 'deliver'
      ? 'Entrega el pedido'
      : mission?.phase === 'pickup'
        ? mission.kitchen
          ? 'Llega y espera el pedido'
          : 'Recoge el pedido'
        : 'Buscando pedido'

  return (
    <div className="hud">
      <div className="top-right">
        <div className="wallet">
          <div className="cash">
            <span>CLP</span>
            <strong>{formatClp(game.money)}</strong>
          </div>
          <div className="cash cans-chip">
            <span>TARROS</span>
            <strong>🥤 {game.cans}</strong>
          </div>
        </div>
        {game.banner && <div className="banner">{game.banner}</div>}
        <div className="daychip"><span ref={clockRef}>16:00:00</span></div>
      </div>

      {stash ? (
        <div className="offer ticket ticket-narco">
          <div className="offer-head">
            <div className="offer-mark" style={{ background: '#143018', color: '#7cff6a' }}>📦</div>
            <div>
              <div className="offer-name">
                Encargo
                <em>{stash.kg} kg</em>
              </div>
              <p className="offer-tiny">Recolecta el pedido y luego dejalo</p>
            </div>
            <strong className="offer-price">{formatClp(stash.reward)}</strong>
          </div>
          <div className="offer-meta">
            <span>{stash.phase === 'pickup' ? 'Recoger' : 'Dejarlo'}</span>
            <span ref={etaRef}>8 min</span>
            <span ref={distRef}>0 m</span>
          </div>
          <div className="offer-route">
            <div className={`offer-stop${stash.phase === 'pickup' ? '' : ' offer-dim'}`}>
              <i />
              <div>
                <strong>{stash.phase === 'pickup' ? 'Ahora' : 'Recogido'}</strong>
                <p>Pedido</p>
              </div>
            </div>
            <div className={`offer-stop${stash.phase === 'drop' ? '' : ' offer-dim'}`}>
              <i className="sq" />
              <div>
                <strong>{stash.phase === 'drop' ? 'Ahora' : 'Después'}</strong>
                <p>{stash.drop.address}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
      mission && mission.phase !== 'cooldown' && (
        <div className={`offer ticket${mission.premium ? ' ticket-hot' : ''}${waiting ? ' ticket-wait' : ''}`}>
          <div className="offer-head">
            <div className="offer-mark">
              <BrandMark brand={mission.brand} />
            </div>
            <div>
              <div className="offer-name">
                {mission.brandName}
                {mission.premium && <em className="premium-tag">Premium</em>}
              </div>
              <p>1 × {mission.item}</p>
            </div>
            <strong className="offer-price">{formatClp(mission.reward)}</strong>
          </div>
          <div className="offer-meta">
            <span>{objective}</span>
            <span ref={etaRef}>8 min</span>
            <span ref={distRef}>0 m</span>
            {mission.premium && mission.phase === 'pickup' && !waiting && (
              <span className="premium-clock" ref={timerRef}>0:25</span>
            )}
          </div>
          {waiting && (
            <div className="wait-uber">
              <div className="wait-uber-ring" ref={waitFillRef}>
                <span ref={waitClockRef}>0:25</span>
              </div>
              <div>
                <strong>Preparando tu pedido</strong>
                <p>Quédate en la zona · {WAIT_RADIUS} m</p>
              </div>
            </div>
          )}
          <div className="offer-route">
            <div className={`offer-stop${mission.phase === 'pickup' ? '' : ' offer-dim'}`}>
              <i />
              <div>
                  <strong>
                    {waiting
                      ? 'No te alejes'
                      : mission.phase === 'pickup'
                        ? mission.kitchen
                          ? 'Llega y espera'
                          : mission.premium
                            ? '¡Corre al local!'
                            : 'Ahora'
                        : 'Recogido'}
                  </strong>
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
      )
      )}

      <div className="speedo">
        <span ref={speedRef}>0</span>
        <small>km/h</small>
      </div>

      <canvas ref={mapRef} className="minimap" />
      {game.cartelTalk && (
        <div className="narco-ask">
          <div className="narco-ask-card">
            <span className="narco-ask-ico">💀</span>
            <h2>¿Quieres ser del Tren de Aragua?</h2>
            <p>Si entras, te van a mandar encargos. Si no, sigues normal.</p>
            <button type="button" className="offer-accept narco-yes" onClick={acceptCartel}>
              Aceptar <small>Enter</small>
            </button>
            <button
              type="button"
              className="offer-reject narco-no"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                refuseCartel()
              }}
            >
              Cancelar <small>Esc</small>
            </button>
          </div>
        </div>
      )}
      <div className="job-stack">
        {game.sideQuest && (
          <div className="offer">
            <div className="offer-head">
              <div className="offer-mark" style={{ background: '#111', color: '#fff' }}>{game.sideQuest.emoji}</div>
              <div>
                <div className="offer-name">
                  Opcional
                  <em>Misión</em>
                </div>
                <p>{game.sideQuest.hint}</p>
              </div>
              <strong className="offer-price">{formatClp(game.sideQuest.reward)}</strong>
            </div>
            <div className="offer-meta">
              <span>{game.sideQuest.title}</span>
            </div>
            <div className="offer-route">
              <div className="offer-stop">
                <i />
                <div>
                  <strong>
                    {game.sideQuest.kind === 'tips'
                      ? formatClp(game.sideQuest.progress)
                      : game.sideQuest.progress}
                  </strong>
                  <p>Vas aquí</p>
                </div>
              </div>
              <div className="offer-stop">
                <i className="sq" />
                <div>
                  <strong>
                    {game.sideQuest.kind === 'tips'
                      ? formatClp(game.sideQuest.goal)
                      : game.sideQuest.goal}
                  </strong>
                  <p>Meta</p>
                </div>
              </div>
            </div>
            <div className="side-bar">
              <i style={{ width: `${Math.round((game.sideQuest.progress / Math.max(1, game.sideQuest.goal)) * 100)}%` }} />
            </div>
          </div>
        )}
        {game.offer && (
          <div key={game.offer.id} className="offer">
            <div className="offer-head">
              <div className="offer-mark">
                <BrandMark brand={game.offer.mission.brand} />
              </div>
              <div>
                <div className="offer-name">
                  {game.offer.mission.brandName}
                  {game.offer.mission.premium && <em className="premium-tag">Premium</em>}
                </div>
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
            <button
              type="button"
              className="offer-accept"
              disabled={!!(game.carrying || game.stash || game.mission)}
              onClick={acceptOffer}
            >
              {game.stash || game.mission || game.carrying ? 'Termina este pedido' : 'Aceptar'}
              {!(game.stashOffer || game.carrying || game.stash || game.mission) && <small>Enter</small>}
            </button>
            <button
              type="button"
              className="offer-reject"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                rejectOffer()
              }}
            >
              Rechazar <small>Esc</small>
            </button>
          </div>
        )}
        {game.stashOffer && (
          <div key={game.stashOffer.id} className="offer narco">
            <div className="offer-head">
              <div className="offer-mark" style={{ background: '#143018', color: '#7cff6a' }}>📦</div>
              <div>
                <div className="offer-name">
                  Encargo
                  <em>{game.stashOffer.kg} kg</em>
                </div>
                <p className="offer-tiny">Recolecta el pedido y luego dejalo</p>
              </div>
              <strong className="offer-price">{formatClp(game.stashOffer.reward)}</strong>
            </div>
            <div className="offer-route">
              <div className="offer-stop">
                <i />
                <div>
                  <strong>Pedido</strong>
                  <p>Recolectar</p>
                </div>
              </div>
              <div className="offer-stop">
                <i className="sq" />
                <div>
                  <strong>{game.stashOffer.drop.address}</strong>
                  <p>Entrega</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="offer-accept narco-yes"
              disabled={!!(game.carrying || game.mission || game.stash)}
              onClick={acceptStash}
            >
              {game.mission || game.stash || game.carrying ? 'Termina este pedido' : 'Aceptar'}
              {!(game.offer || game.carrying || game.mission || game.stash) && <small>Enter</small>}
            </button>
            <button
              type="button"
              className="offer-reject"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
                rejectStash()
              }}
            >
              Rechazar <small>Esc</small>
            </button>
          </div>
        )}
        {game.mission && game.mission.contested && game.mission.phase === 'pickup' && (
          <div className={`rival-card ${game.rival?.dropping ? 'rival-drop' : ''}`}>
            <div className="rival-pop">
              {game.mission.rivalKind === 'taxi'
                ? '🚕 Tu competidor es un taxista que hace de uber eats???'
                : game.rival?.dropping
                  ? '⬇️ ¡Cayó adelante tuyo!'
                  : '🛵 Tienes un competidor'}
            </div>
            <div className="offer-head">
              <div className="offer-mark" style={{ background: game.mission.rivalKind === 'taxi' ? '#ffe56a' : '#ff4d1a', color: '#1a1a1a' }}>
                {game.mission.rivalKind === 'taxi' ? '🚕' : 'R'}
              </div>
              <div>
                <div className="offer-name">{game.mission.rivalKind === 'taxi' ? 'Taxista' : 'Rappi'}</div>
                <p>
                  {game.rival?.dropping
                    ? 'Se tira del cielo, adelante'
                    : `Va a ${game.mission.brandName} a ${game.rival?.kph ?? (game.mission.rivalKind === 'taxi' ? 75 : 60)} km/h`}
                </p>
              </div>
            </div>
            <div className="offer-route">
              <div className="offer-stop">
                <i />
                <div>
                  <strong>Del local <span ref={rivalShopRef}>—</span></strong>
                  <p>Si llega antes, se lleva el pedido</p>
                </div>
              </div>
              <div className="offer-stop">
                <i className="sq" />
                <div>
                  <strong>De ti <span ref={rivalYouRef}>—</span></strong>
                  <p>Sigue el GPS 🛵</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {game.notice && (
        <div key={game.notice.id} className={`notice notice-${game.notice.tone}`}>
          {game.notice.brand ? (
            <img className="notice-logo" src={BRAND_LOGO[game.notice.brand]} alt="" />
          ) : (
            <span>{game.notice.emoji}</span>
          )}
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

      {game.prompt && !game.mapOpen && <div className="prompt">{game.prompt}</div>}
      {game.floater && <div className="floater">{game.floater}</div>}

      {game.mapOpen && (
        <div className="big-map">
          <canvas ref={atlasRef} />
          <p>Click pone la marca · derecho la quita · M cierra</p>
        </div>
      )}

      {!game.started && (
        <div className="menu" onPointerDown={() => bootAudioAndShift()}>
          <div className="ve-flag" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>★★★★★★★★</span>
          </div>
          <div className="menu-pop">
            <h1>Yonaiker<br />Simulator</h1>
            <p className="menu-start">Pulsa Enter</p>
          </div>
        </div>
      )}
    </div>
  )
}

function BrandMark({ brand }: { brand: BrandId }) {
  return <img src={BRAND_LOGO[brand]} alt="" />
}

function quotaClock(deadline: number) {
  const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
  const seconds = left % 60
  return `${Math.floor(left / 60)}:${seconds.toString().padStart(2, '0')}`
}

function project(wx: number, wz: number, width: number, height: number, scale: number, cam: { ox: number; oz: number; heading: number }) {
  const dx = wx - cam.ox
  const dz = wz - cam.oz
  const heading = cam.heading
  const forward = dx * Math.cos(heading) + dz * Math.sin(heading)
  const right = -dx * Math.sin(heading) + dz * Math.cos(heading)
  return {
    x: width / 2 + right * scale,
    y: height / 2 - forward * scale,
  }
}

function drawMap(ctx: CanvasRenderingContext2D, width: number, height: number, mode: 'mini' | 'world') {
  const cam = mode === 'world'
    ? { ox: 0, oz: 0, heading: -Math.PI / 2 }
    : { ox: game.x, oz: game.z, heading: game.camHeading }
  const scale = mode === 'world' ? (Math.min(width, height) - 56) / SPAN : (width / 2 - 18) / 62
  const pin = (wx: number, wz: number) =>
    mode === 'world' ? project(wx, wz, width, height, scale, cam) : clampIcon(project(wx, wz, width, height, scale, cam), width, height)

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  if (mode === 'mini') {
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.fillStyle = '#4c7832'
  ctx.fillRect(0, 0, width, height)

  const corner = Math.max(14, width * 0.055)
  ctx.fillStyle = '#5d8c3c'
  for (const quad of city.grass) fillQuad(ctx, quad, width, height, scale, corner * 0.85, cam)
  ctx.fillStyle = '#1a1410'
  fillQuad(ctx, city.narco.rect, width, height, scale, corner * 0.85, cam)
  for (const roof of city.roofs) {
    if (roof.sx < 2.4 || roof.sz < 2.4) continue
    ctx.fillStyle = roof.color
    fillFootprint(ctx, roof, width, height, scale, corner * 0.35, cam)
  }
  for (const crown of city.crowns) {
    const projected = project(crown.x, crown.z, width, height, scale, cam)
    ctx.fillStyle = '#2f6a28'
    fillDot(ctx, projected.x, projected.y, mode === 'world' ? 2 : 3.5)
  }
  ctx.fillStyle = '#8f897c'
  for (const quad of city.sidewalk) fillQuad(ctx, quad, width, height, scale, corner * 0.55, cam)
  ctx.fillStyle = '#ffffff'
  for (const quad of city.asphalt) fillQuad(ctx, quad, width, height, scale, corner, cam)

  ctx.strokeStyle = '#276ef1'
  ctx.lineWidth = Math.max(5, width / 48)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  game.path.forEach((point, index) => {
    const projected = project(point.x, point.z, width, height, scale, cam)
    if (index === 0) ctx.moveTo(projected.x, projected.y)
    else ctx.lineTo(projected.x, projected.y)
  })
  ctx.stroke()

  for (const pitch of city.pitches) {
    const projected = project(pitch.x, pitch.z, width, height, scale, cam)
    ctx.fillStyle = '#8fd18a'
    fillDot(ctx, projected.x, projected.y, mode === 'world' ? 4 : 7)
  }

  for (const venue of city.venues) {
    const burned = game.burned.includes(venue.id)
    const projected = pin(venue.x, venue.z)
    ctx.fillStyle = burned ? '#5a4638' : venue.color
    fillDot(ctx, projected.x, projected.y, mode === 'world' ? 4 : 6)
  }

  for (const spot of city.landmarks) {
    const projected = pin(spot.x, spot.z)
    ctx.fillStyle = spot.id === 'costanera' ? '#7ecbdc' : '#0b3f86'
    fillDot(ctx, projected.x, projected.y, mode === 'world' ? 5 : 7)
  }

  for (const prop of city.props) {
    const projected = pin(prop.x, prop.z)
    ctx.fillStyle = prop.kind === 'pizza' ? '#ee3d23' : prop.kind === 'horizon' ? '#7eb6e8' : '#c9b6f2'
    fillDot(ctx, projected.x, projected.y, mode === 'world' ? 3 : 5)
  }

  for (const restaurant of city.restaurants) {
    const projected = pin(restaurant.pickup.x, restaurant.pickup.z)
    ctx.fillStyle = restaurant.color
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, mode === 'world' ? 5 : 7, 0, Math.PI * 2)
    ctx.fill()
  }

  const mission = game.mission
  if (mission && mission.phase !== 'cooldown') {
    const target = mission.phase === 'pickup' ? mission.pickup : mission.drop
    const projected = pin(target.x, target.z)
    if (mission.holdUntil && mission.phase === 'pickup') {
      const zone = project(mission.pickup.x, mission.pickup.z, width, height, scale, cam)
      ctx.fillStyle = 'rgba(255, 225, 74, 0.16)'
      ctx.strokeStyle = 'rgba(255, 225, 74, 0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(zone.x, zone.y, WAIT_RADIUS * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    ctx.strokeStyle = mission.phase === 'deliver' ? '#37d67a' : '#ffe14a'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 12, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (game.waypoint) {
    const mark = pin(game.waypoint.x, game.waypoint.z)
    ctx.fillStyle = '#ff4d8d'
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(mark.x, mark.y - 16)
    ctx.lineTo(mark.x + 11, mark.y + 8)
    ctx.lineTo(mark.x - 11, mark.y + 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  if (mode === 'mini') {
    const north = project(game.x, game.z - 80, width, height, scale, cam)
    const cx = width / 2
    const cy = height / 2
    const ndx = north.x - cx
    const ndy = north.y - cy
    const nlen = Math.hypot(ndx, ndy) || 1
    const rim = width / 2 - 16
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#173018'
    ctx.lineWidth = Math.max(3, width / 80)
    ctx.font = `700 ${Math.round(width / 16)}px Fredoka, Trebuchet MS, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText('N', cx + (ndx / nlen) * rim, cy + (ndy / nlen) * rim)
    ctx.fillText('N', cx + (ndx / nlen) * rim, cy + (ndy / nlen) * rim)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 6
    ctx.font = `800 ${Math.round(width / 22)}px Fredoka, Trebuchet MS, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText('N', width / 2, 28)
    ctx.fillText('N', width / 2, 28)
  }

  const emoji = Math.round(mode === 'world' ? width / 28 : width / 10)
  ctx.font = `${emoji}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const scan = mode === 'world' ? SPAN : 110
  const ring = Math.max(3, width / (mode === 'world' ? 140 : 90))
  for (const phone of nearbyPhones(scan)) {
    const spot = pin(phone.x, phone.z)
    drawOutlinedEmoji(ctx, '📱', spot.x, spot.y, ring)
  }
  for (const can of nearbyCans(scan)) {
    const spot = pin(can.x, can.z)
    drawOutlinedEmoji(ctx, '🥤', spot.x, spot.y, ring)
  }
  {
    const pista = pin(city.narco.talk.x, city.narco.talk.z)
    const gap = mode === 'world' ? width / 42 : width / 16
    drawOutlinedEmoji(ctx, '💀', pista.x - gap * 0.45, pista.y, Math.max(ring, width / (mode === 'world' ? 90 : 70)))
    drawOutlinedEmoji(ctx, '💰', pista.x + gap * 0.55, pista.y, Math.max(ring, width / (mode === 'world' ? 90 : 70)))
  }
  if (game.stash?.phase === 'pickup') {
    const pack = pin(city.narco.stash.x, city.narco.stash.z)
    drawOutlinedEmoji(ctx, '📦', pack.x, pack.y, Math.max(ring, width / 80))
  }

  const you = mode === 'world' ? project(game.x, game.z, width, height, scale, cam) : { x: width / 2, y: height / 2 }
  ctx.save()
  ctx.translate(you.x, you.y)
  ctx.rotate(game.heading - cam.heading)
  const nose = mode === 'world' ? 18 : 12
  ctx.beginPath()
  ctx.moveTo(0, -nose)
  ctx.lineTo(-nose * 0.58, nose * 0.75)
  ctx.lineTo(nose * 0.58, nose * 0.75)
  ctx.closePath()
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = Math.max(3, width / 70)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.restore()

  if (game.pursuit && game.pursuit.phase !== 'delay') {
    const cop = pin(game.pursuit.x, game.pursuit.z)
    ctx.font = `${Math.round(width / (mode === 'world' ? 24 : 8))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
    drawOutlinedEmoji(ctx, '🚓', cop.x, cop.y, Math.max(3, width / 80))
  }
  if (game.rival) {
    const rival = pin(game.rival.x, game.rival.z)
    ctx.font = `${Math.round(width / (mode === 'world' ? 26 : 9))}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
    drawOutlinedEmoji(ctx, '🛵', rival.x, rival.y, Math.max(3, width / 80))
  }
  ctx.restore()

  if (mode === 'mini') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(width / 2, height / 2, width / 2 - 4, 0, Math.PI * 2)
    ctx.stroke()
  }
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
  cam: { ox: number; oz: number; heading: number },
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
  ].map(([lx, lz]) => project(box.x + lx * cos + lz * sin, box.z - lx * sin + lz * cos, width, height, scale, cam))
  fillCorners(ctx, corners, radius)
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  quad: { x0: number; z0: number; x1: number; z1: number },
  width: number,
  height: number,
  scale: number,
  radius = 0,
  cam: { ox: number; oz: number; heading: number },
) {
  const corners = [
    project(quad.x0, quad.z0, width, height, scale, cam),
    project(quad.x1, quad.z0, width, height, scale, cam),
    project(quad.x1, quad.z1, width, height, scale, cam),
    project(quad.x0, quad.z1, width, height, scale, cam),
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
        <p className="eyebrow">Yonaiker</p>
        <h1>Simulator</h1>
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
