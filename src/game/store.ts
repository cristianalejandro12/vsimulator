import { city, type House } from './city'
import { route } from './gps'
import { audio } from './audio'

export type BrandId = 'mcdonalds' | 'kfc' | 'burgerking' | 'pizzahut'
export type Phase = 'pickup' | 'deliver' | 'cooldown'

export type Notice = {
  id: number
  emoji: string
  title: string
  text: string
  tone: 'alert' | 'ok' | 'pop' | 'cash' | 'fire'
}

export type Shakedown = {
  barId: string
  name: string
  deadline: number
  willPay: boolean
  status: 'waiting' | 'unpaid'
}

export type TimeOfDay = 'day' | 'dusk' | 'night'

export type OrderOffer = {
  id: number
  mission: Mission
  rating: string
  exclusive: boolean
  pickupMin: number
  pickupDist: string
  tripMin: number
  tripDist: string
}

export type Pursuit = {
  phase: 'delay' | 'chase' | 'bust'
  until: number
  x: number
  z: number
  heading: number
  speed: number
}

export const QUOTA = 200000
const QUOTA_MS = 40000

export type Mission = {
  id: number
  brand: BrandId
  brandName: string
  color: string
  item: string
  pickup: { x: number; z: number }
  drop: { x: number; z: number; address: string }
  subtotal: number
  deliveryFee: number
  reward: number
  phase: Phase
}

const BRANDS: Array<{ id: BrandId; name: string; color: string; items: Array<{ name: string; price: number }> }> = [
  {
    id: 'mcdonalds',
    name: "McDonald's",
    color: '#da291c',
    items: [
      { name: 'Big Mac', price: 6490 },
      { name: 'McNuggets x10', price: 7290 },
      { name: 'Cuarto de libra', price: 6890 },
      { name: 'McFlurry', price: 3190 },
    ],
  },
  {
    id: 'kfc',
    name: 'KFC',
    color: '#e4002b',
    items: [
      { name: 'Balde de 8 piezas', price: 14990 },
      { name: 'Twister', price: 5490 },
      { name: 'Popcorn chicken', price: 4990 },
      { name: 'Alitas picantes', price: 6790 },
    ],
  },
  {
    id: 'burgerking',
    name: 'Burger King',
    color: '#d62300',
    items: [
      { name: 'Whopper', price: 6990 },
      { name: 'King de pollo', price: 5790 },
      { name: 'Papas supremas', price: 3490 },
      { name: 'Stacker doble', price: 7490 },
    ],
  },
  {
    id: 'pizzahut',
    name: 'Pizza Hut',
    color: '#ee3d23',
    items: [
      { name: 'Pizza mediana', price: 8990 },
      { name: 'Pizza familiar', price: 12990 },
      { name: 'Pan de ajo', price: 3490 },
      { name: 'Alitas BBQ', price: 5990 },
    ],
  },
]

const DELIVERY_FEES = [990, 1290, 1490, 1690, 1990, 2290, 2490]

export const game = {
  x: city.spawn.x,
  z: city.spawn.z,
  heading: city.spawn.heading,
  camHeading: city.spawn.heading,
  speed: 0,
  distance: 0,
  money: 0,
  started: false,
  muted: false,
  carrying: false,
  prompt: null as string | null,
  banner: null as string | null,
  floater: null as string | null,
  path: [] as { x: number; z: number }[],
  mission: null as Mission | null,
  phone: null as { x: number; z: number; phase: 'mark' | 'flee'; fromX: number; fromZ: number } | null,
  wanted: false,
  time: 'day' as TimeOfDay,
  clock: 16 * 3600,
  pursuit: null as Pursuit | null,
  notice: null as Notice | null,
  offer: null as OrderOffer | null,
  shakedown: null as Shakedown | null,
  burned: [] as string[],
  burnFx: null as { id: string; until: number } | null,
}

const listeners = new Set<() => void>()
let version = 0
let bannerToken = 0
let floaterToken = 0
let noticeToken = 0
let orderToken = 0

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVersion() {
  return version
}

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

export function poke() {
  emit()
}

function showBanner(text: string, ms: number) {
  game.banner = text
  const token = ++bannerToken
  emit()
  window.setTimeout(() => {
    if (token === bannerToken) {
      game.banner = null
      emit()
    }
  }, ms)
}

function formatMeters(meters: number) {
  const rounded = Math.max(40, Math.round(meters))
  if (rounded >= 1000) return `${(rounded / 1000).toFixed(1)} km`
  return `${rounded} m`
}

function tripMinutes(meters: number) {
  return Math.max(2, Math.round(Math.max(40, meters) / 90))
}

function openOffer() {
  if (!game.started || game.offer) return
  const mission = makeMission(game.mission)
  const away = Math.hypot(game.x - mission.pickup.x, game.z - mission.pickup.z)
  const trip = Math.hypot(mission.pickup.x - mission.drop.x, mission.pickup.z - mission.drop.z)
  const id = ++orderToken
  game.offer = {
    id,
    mission,
    rating: (4.72 + Math.random() * 0.27).toFixed(2),
    exclusive: Math.random() < 0.45,
    pickupMin: tripMinutes(away),
    pickupDist: formatMeters(away),
    tripMin: tripMinutes(trip),
    tripDist: formatMeters(trip),
  }
  audio.order(game.muted)
  emit()
  window.setTimeout(() => {
    if (game.offer?.id === id) dismissOffer()
  }, 22000)
}

function nextOfferGap() {
  return 15000 + Math.random() * 15000
}

let offerTimer = 0

function scheduleOffers(delay = nextOfferGap()) {
  window.clearTimeout(offerTimer)
  offerTimer = window.setTimeout(() => {
    if (!game.started) return
    if (game.offer) {
      scheduleOffers(4000)
      return
    }
    openOffer()
    scheduleOffers()
  }, delay)
}

function dismissOffer() {
  if (!game.offer) return
  game.offer = null
  emit()
}

export function acceptOffer() {
  const offer = game.offer
  if (!offer || game.carrying) return
  game.mission = offer.mission
  game.offer = null
  refreshRoute()
  emit()
}

export function rejectOffer() {
  dismissOffer()
}

export function showNotice(emoji: string, title: string, text: string, tone: Notice['tone'], ms = 4400) {
  const id = ++noticeToken
  game.notice = { id, emoji, title, text, tone }
  emit()
  window.setTimeout(() => {
    if (id === noticeToken) {
      game.notice = null
      emit()
    }
  }, ms)
}

function venuePrompt() {
  if (!game.started) return null
  let closest: (typeof city.venues)[number] | null = null
  let best = 8
  for (const venue of city.venues) {
    const dist = Math.hypot(game.x - venue.x, game.z - venue.z)
    if (dist < best) {
      best = dist
      closest = venue
    }
  }
  if (!closest || game.burned.includes(closest.id)) return null
  const job = game.shakedown
  if (job?.barId === closest.id && job.status === 'unpaid') return 'E   ·   Quemar el local'
  if (job?.barId === closest.id && job.status === 'waiting') return 'Esperando el depósito…'
  if (job) return null
  return 'E   ·   Extorsionar'
}

function applyPrompt(next: string | null) {
  if (next !== game.prompt) {
    game.prompt = next
    emit()
  }
}

let quotaSecond = -1

export function tickExtortion() {
  const job = game.shakedown
  if (!job || job.status !== 'waiting') return
  const left = Math.ceil((job.deadline - performance.now()) / 1000)
  if (left !== quotaSecond) {
    quotaSecond = left
    emit()
  }
  if (performance.now() < job.deadline) return
  quotaSecond = -1
  if (job.willPay) {
    game.money += QUOTA
    game.shakedown = null
    showFloater(`+ ${formatClp(QUOTA)}`)
    showNotice('💸', 'Te pagaron en depósito', `${job.name} depositó ${formatClp(QUOTA)}.`, 'cash', 3600)
    return
  }
  job.status = 'unpaid'
  showNotice('🔥', 'No pagaron la cuota', `Ve a ${job.name} y aprieta E para quemarlo.`, 'fire', 4200)
}

function tryVenue() {
  let closest: (typeof city.venues)[number] | null = null
  let best = 8
  for (const venue of city.venues) {
    const dist = Math.hypot(game.x - venue.x, game.z - venue.z)
    if (dist < best) {
      best = dist
      closest = venue
    }
  }
  if (!closest || game.burned.includes(closest.id)) return
  const job = game.shakedown
  if (job?.barId === closest.id && job.status === 'unpaid') {
    game.burned = [...game.burned, closest.id]
    game.burnFx = { id: closest.id, until: performance.now() + 7000 }
    game.shakedown = null
    quotaSecond = -1
    showNotice('🔥', 'Quemaste el local', `${closest.name} quedó en llamas.`, 'fire', 3600)
    refreshRoute()
    return
  }
  if (job) return
  const willPay = Math.random() < 0.5
  game.shakedown = {
    barId: closest.id,
    name: closest.name,
    deadline: performance.now() + QUOTA_MS,
    willPay,
    status: 'waiting',
  }
  quotaSecond = -1
  showNotice('💰', 'Extorsionaste el local', `Cuota de ${formatClp(QUOTA)}. Tienen 40 segundos.`, 'pop', 3600)
  refreshRoute()
}

function showFloater(text: string) {
  game.floater = text
  const token = ++floaterToken
  emit()
  window.setTimeout(() => {
    if (token === floaterToken) {
      game.floater = null
      emit()
    }
  }, 1700)
}

function pickDrop(origin: { x: number; z: number }, previous?: House) {
  const far = city.houses.filter((house) => {
    if (previous && house.address === previous.address) return false
    return Math.hypot(house.delivery.x - origin.x, house.delivery.z - origin.z) > 75
  })
  const pool = far.length ? far : city.houses
  return pool[Math.floor(Math.random() * pool.length)]
}

export function makeMission(previous?: Mission | null): Mission {
  let brand = BRANDS[Math.floor(Math.random() * BRANDS.length)]
  if (previous && Math.random() < 0.75) {
    const others = BRANDS.filter((item) => item.id !== previous.brand)
    brand = others[Math.floor(Math.random() * others.length)]
  }
  const pickup = brandPickup(brand.id)
  const drop = pickDrop(pickup)
  const dish = brand.items[Math.floor(Math.random() * brand.items.length)]
  const dist = Math.hypot(pickup.x - drop.delivery.x, pickup.z - drop.delivery.z)
  const deliveryFee = DELIVERY_FEES[Math.min(DELIVERY_FEES.length - 1, Math.round(dist / 70))]
  return {
    id: (previous?.id ?? 0) + 1,
    brand: brand.id,
    brandName: brand.name,
    color: brand.color,
    item: dish.name,
    pickup,
    drop: { x: drop.delivery.x, z: drop.delivery.z, address: drop.address },
    subtotal: dish.price,
    deliveryFee,
    reward: dish.price + deliveryFee,
    phase: 'pickup',
  }
}

function brandPickup(id: BrandId) {
  if (id === 'pizzahut') {
    const spots = city.props.filter((prop) => prop.kind === 'pizza')
    const spot = spots[Math.floor(Math.random() * spots.length)]
    if (spot) return { x: spot.x + Math.sin(spot.yaw) * 10, z: spot.z + Math.cos(spot.yaw) * 10 }
  }
  const restaurant = city.restaurants.find((item) => item.id === id) ?? city.restaurants[0]
  return restaurant.pickup
}

export function refreshRoute() {
  const mission = game.mission
  if (!mission || mission.phase === 'cooldown') {
    game.path = []
    game.distance = 0
    applyPrompt(venuePrompt())
    return
  }
  const target = mission.phase === 'pickup' ? mission.pickup : mission.drop
  game.path = route(game.x, game.z, target.x, target.z)
  game.distance = Math.hypot(game.x - target.x, game.z - target.z)
  const missionPrompt =
    game.distance < 6.4
      ? mission.phase === 'pickup'
        ? 'E   ·   Recoger pedido'
        : 'E   ·   Entregar en la casa'
      : null
  applyPrompt(missionPrompt ?? venuePrompt())
}

export function formatClp(value: number) {
  return `$${Math.round(value).toLocaleString('es-CL')}`
}

let phoneStreak = 0
let phoneStreakAt = 0
let stolenCash = 0

export function confiscateStolen() {
  const phones = Math.round(stolenCash / 400000)
  const taken = Math.min(Math.max(0, game.money), stolenCash)
  game.money -= taken
  stolenCash = 0
  phoneStreak = 0
  phoneStreakAt = 0
  if (taken > 0) showFloater(`- ${formatClp(taken)}`)
  else emit()
  return { taken, phones }
}

export function stealPhone() {
  if (!game.started) return false
  const now = performance.now()
  phoneStreak = now - phoneStreakAt < 9000 ? phoneStreak + 1 : 1
  phoneStreakAt = now
  game.money += 400000
  stolenCash += 400000
  showFloater(`+ ${formatClp(400000)}`)
  const title = phoneStreak === 1 ? 'Has robado un celular' : `Has robado ${phoneStreak} celulares`
  showNotice('📱', title, 'Corre antes de que llamen a la policía.', 'pop', 3600)
  if (!game.pursuit) {
    game.pursuit = {
      phase: 'delay',
      until: now + 5000,
      x: game.x,
      z: game.z,
      heading: game.heading,
      speed: 0,
    }
    emit()
  }
  return true
}

const DAY_SECONDS = 24 * 3600
const CLOCK_SCALE = 120

export function clockLabel() {
  const total = ((Math.floor(game.clock) % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS
  const hour = Math.floor(total / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const second = total % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function lookFromClock(): TimeOfDay {
  const hour = (((game.clock % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / 3600
  if (hour >= 20 || hour < 6) return 'night'
  if (hour >= 18) return 'dusk'
  return 'day'
}

export function tickClock(dt: number) {
  if (!game.started) return
  game.clock += dt * CLOCK_SCALE
  if (game.clock >= DAY_SECONDS) game.clock -= DAY_SECONDS
  const next = lookFromClock()
  if (next !== game.time) {
    game.time = next
    emit()
  }
}

export function cycleTime() {
  const hour = (((game.clock % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / 3600
  if (hour >= 20 || hour < 6) game.clock = 8 * 3600
  else if (hour >= 18) game.clock = 20 * 3600
  else game.clock = 18 * 3600
  game.time = lookFromClock()
  emit()
}

export function tryInteract() {
  if (!game.started) return
  const mission = game.mission
  const target = mission && mission.phase !== 'cooldown' ? (mission.phase === 'pickup' ? mission.pickup : mission.drop) : null
  if (mission && target && Math.hypot(game.x - target.x, game.z - target.z) <= 6.4) {
    if (mission.phase === 'pickup') {
      mission.phase = 'deliver'
      game.carrying = true
      showNotice('🍔', 'Recogiste un pedido', `${mission.item}. Llévalo a la casa.`, 'pop', 3600)
      refreshRoute()
      return
    }

    const tip = Math.random() < 0.5 ? 0 : [1000, 2000, 3000][Math.floor(Math.random() * 3)]
    game.carrying = false
    game.mission = null
    refreshRoute()
    if (tip > 0) {
      game.money += tip
      showFloater(`+ ${formatClp(tip)}`)
      showNotice('🏠', 'Entregaste el pedido', `Te dieron propina de ${formatClp(tip)}.`, 'cash', 3600)
    } else {
      showNotice('🏠', 'Entregaste el pedido', 'No te dieron propina.', 'pop', 3600)
    }
    return
  }
  tryVenue()
}

export function startShift() {
  if (game.started) return
  game.started = true
  game.mission = null
  game.path = []
  emit()
  scheduleOffers(2200)
}

export function toggleMute() {
  game.muted = !game.muted
  emit()
}
