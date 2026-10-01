import { city } from './city'
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
  brand?: BrandId
}

export const BRAND_LOGO: Record<BrandId, string> = {
  mcdonalds: '/brands/mcdonalds.png',
  kfc: '/brands/kfc.png',
  burgerking: '/brands/burgerking.png',
  pizzahut: '/brands/pizzahut.svg',
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

export type SideQuest = {
  id: number
  kind: 'phones' | 'tips' | 'drops' | 'cans'
  emoji: string
  title: string
  hint: string
  goal: number
  progress: number
  reward: number
}

export type StashJob = {
  id: number
  kg: number
  reward: number
  phase: 'pickup' | 'drop'
  pickup: { x: number; z: number }
  drop: { x: number; z: number; address: string }
}

export type StashOffer = {
  id: number
  kg: number
  reward: number
  drop: { x: number; z: number; address: string }
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
  premium: boolean
  deadline: number | null
  contested: boolean
  rivalKind: 'rappi' | 'taxi'
  kitchen: boolean
  holdUntil: number | null
  cancelAt: number | null
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
  cans: 0,
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
  rival: null as { x: number; z: number; toShop: number; toYou: number; dropping: boolean; kph: number; kind: 'rappi' | 'taxi' } | null,
  sideQuest: null as SideQuest | null,
  cartel: false,
  cartelTalk: false,
  stashOffer: null as StashOffer | null,
  stash: null as StashJob | null,
  mapOpen: false,
  waypoint: null as { x: number; z: number } | null,
}

const listeners = new Set<() => void>()
let version = 0
let bannerToken = 0
let floaterToken = 0
let noticeToken = 0
let orderToken = 0
let questToken = 0
let questTimer = 0
let phoneQuestGoal = 10
let tipQuestGoal = 30000
let dropQuestGoal = 5
let canQuestGoal = 8
let lastQuestKind: SideQuest['kind'] | null = null
let kitchenSecond = -1
let stashToken = 0
let stashTimer = 0

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
  if (game.stash || game.mission || game.cartelTalk) return
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
    if (game.offer?.id === id && !game.stash) dismissOffer()
  }, 28000)
}

function nextOfferGap() {
  return 1800 + Math.random() * 2200
}

let offerTimer = 0

function scheduleOffers(delay = nextOfferGap()) {
  window.clearTimeout(offerTimer)
  offerTimer = window.setTimeout(() => {
    if (!game.started) return
    if (game.offer || game.mission || game.stash || game.cartelTalk) {
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
  scheduleOffers(800)
}

export function acceptOffer() {
  const offer = game.offer
  if (!offer || game.carrying || game.stash || game.mission) return
  const mission = offer.mission
  if (mission.premium) mission.deadline = performance.now() + 25000
  mission.contested = Math.random() < (mission.premium ? 0.82 : 0.72)
  mission.rivalKind = mission.contested && Math.random() < 0.2 ? 'taxi' : 'rappi'
  mission.kitchen = Math.random() < 0.32
  mission.holdUntil = null
  mission.cancelAt = Math.random() < 0.05 ? performance.now() + 10000 + Math.random() * 18000 : null
  game.mission = mission
  game.offer = null
  refreshRoute()
  if (mission.contested) {
    const away = Math.hypot(game.x - mission.pickup.x, game.z - mission.pickup.z)
    const place = away >= 1000 ? `${(away / 1000).toFixed(1)} km` : `${Math.round(away)} m`
    if (mission.rivalKind === 'taxi') {
      showNotice(
        '🚕',
        'Tu competidor es un taxista que hace de uber eats???',
        `Se tira del cielo a 75 km/h. El local está a ${place}.`,
        'pop',
        4800,
      )
    } else {
      showNotice('⬇️', '¡Tienes un competidor!', `Un Rappi se tira del cielo y corre a ${mission.brandName}. El local está a ${place}.`, 'pop', 4200, mission.brand)
    }
  }
  emit()
}

export function rejectOffer() {
  dismissOffer()
}

export function snatchMission(reason: string) {
  const mission = game.mission
  if (!mission || mission.phase !== 'pickup') return false
  if (mission.holdUntil) return false
  if (Math.hypot(game.x - mission.pickup.x, game.z - mission.pickup.z) <= 8) return false
  const brand = mission.brand
  const taxi = mission.rivalKind === 'taxi'
  game.mission = null
  game.carrying = false
  game.rival = null
  premiumSecond = -1
  kitchenSecond = -1
  refreshRoute()
  showNotice(taxi ? '🚕' : '🛵', taxi ? 'Te lo quitó un taxista' : 'Te lo quitó un Rappi', reason, 'alert', 3600, taxi ? undefined : brand)
  return true
}

export function tickPremium() {
  const mission = game.mission
  if (!mission?.premium || mission.phase !== 'pickup' || !mission.deadline) return
  const left = Math.ceil((mission.deadline - performance.now()) / 1000)
  if (left !== premiumSecond) {
    premiumSecond = left
    emit()
  }
  if (performance.now() < mission.deadline) return
  mission.deadline = null
  premiumSecond = -1
  emit()
}

let premiumSecond = -1

export function premiumLeft() {
  const mission = game.mission
  if (!mission?.premium || !mission.deadline || mission.phase !== 'pickup') return 0
  return Math.max(0, Math.ceil((mission.deadline - performance.now()) / 1000))
}

export const WAIT_RADIUS = 58

export function kitchenLeft() {
  const mission = game.mission
  if (!mission?.holdUntil || mission.phase !== 'pickup') return 0
  return Math.max(0, Math.ceil((mission.holdUntil - performance.now()) / 1000))
}

export function abortMission(title: string, text: string) {
  const brand = game.mission?.brand
  game.mission = null
  game.carrying = false
  game.rival = null
  premiumSecond = -1
  kitchenSecond = -1
  refreshRoute()
  showNotice('😬', title, text, 'alert', 3800, brand)
}

function finishPickup() {
  const mission = game.mission
  if (!mission || mission.phase !== 'pickup') return
  const beatRival = mission.contested
  mission.phase = 'deliver'
  mission.deadline = null
  mission.contested = false
  mission.holdUntil = null
  mission.cancelAt = null
  premiumSecond = -1
  kitchenSecond = -1
  game.rival = null
  game.carrying = true
  if (beatRival) {
    game.money += 10000
    showFloater(`+ ${formatClp(10000)}`)
    showNotice('🏁', '¡Le ganaste a tu competidor!', `Te dimos ${formatClp(10000)}. Llévalo a la casa.`, 'cash', 3800, mission.brand)
  } else {
    showNotice(
      mission.premium ? '🔥' : '🍔',
      mission.premium ? 'Premium recogido' : 'Recogiste un pedido',
      `${mission.item}. Llévalo a la casa.`,
      'pop',
      3600,
      mission.brand,
    )
  }
  refreshRoute()
}

export function tickKitchen() {
  const mission = game.mission
  if (!mission?.holdUntil || mission.phase !== 'pickup') return
  const dist = Math.hypot(game.x - mission.pickup.x, game.z - mission.pickup.z)
  if (dist > WAIT_RADIUS) {
    abortMission('Te fuiste de la zona', 'El local canceló porque el repartidor se fue.')
    return
  }
  const left = Math.ceil((mission.holdUntil - performance.now()) / 1000)
  if (left !== kitchenSecond) {
    kitchenSecond = left
    emit()
  }
  if (performance.now() < mission.holdUntil) return
  finishPickup()
}

export function tickCancel() {
  const mission = game.mission
  if (!mission?.cancelAt) return
  if (performance.now() < mission.cancelAt) return
  abortMission('El cliente canceló', 'Se cayó el pedido. A esperar otro.')
}

function questGap() {
  return 14000 + Math.random() * 18000
}

function pickQuestKind(): SideQuest['kind'] {
  const pool: SideQuest['kind'][] = ['phones', 'tips', 'drops', 'cans']
  const filtered = lastQuestKind ? pool.filter((kind) => kind !== lastQuestKind) : pool
  return filtered[Math.floor(Math.random() * filtered.length)]
}

function makeSideQuest(kind: SideQuest['kind']): SideQuest {
  if (kind === 'phones') {
    const goal = phoneQuestGoal
    return {
      id: ++questToken,
      kind,
      emoji: '📱',
      title: `Roba ${goal} celulares`,
      hint: 'Sin que te atrape la policía',
      goal,
      progress: 0,
      reward: 8000 + goal * 400,
    }
  }
  if (kind === 'tips') {
    const goal = tipQuestGoal
    return {
      id: ++questToken,
      kind,
      emoji: '💸',
      title: `Junta ${formatClp(goal)} de propina`,
      hint: 'Solo cuenta lo que te dejan en las casas',
      goal,
      progress: 0,
      reward: 6000 + Math.round(goal * 0.12),
    }
  }
  if (kind === 'cans') {
    const goal = canQuestGoal
    return {
      id: ++questToken,
      kind,
      emoji: '🥤',
      title: `Recoge ${goal} tarros de jurel`,
      hint: 'Están tirados en la calle',
      goal,
      progress: 0,
      reward: 4000 + goal * 350,
    }
  }
  const goal = dropQuestGoal
  return {
    id: ++questToken,
    kind: 'drops',
    emoji: '🛵',
    title: `Entrega ${goal} pedidos`,
    hint: 'Opcional, encima de Uber',
    goal,
    progress: 0,
    reward: 5000 + goal * 1500,
  }
}

function openSideQuest() {
  if (!game.started || game.sideQuest) return
  const kind = pickQuestKind()
  lastQuestKind = kind
  game.sideQuest = makeSideQuest(kind)
  emit()
}

function scheduleSideQuest(delay = questGap()) {
  window.clearTimeout(questTimer)
  questTimer = window.setTimeout(() => {
    if (!game.started) return
    if (game.sideQuest) return
    openSideQuest()
  }, delay)
}

function completeSideQuest() {
  const quest = game.sideQuest
  if (!quest) return
  game.sideQuest = null
  game.money += quest.reward
  showFloater(`+ ${formatClp(quest.reward)}`)
  if (quest.kind === 'phones') phoneQuestGoal = Math.min(40, phoneQuestGoal + 10)
  if (quest.kind === 'tips') tipQuestGoal = Math.min(120000, Math.round(tipQuestGoal * 1.6 / 1000) * 1000)
  if (quest.kind === 'drops') dropQuestGoal = Math.min(20, dropQuestGoal + 5)
  if (quest.kind === 'cans') canQuestGoal = Math.min(40, canQuestGoal + 8)
  showNotice(quest.emoji, '¡Misión hecha!', `Bonus ${formatClp(quest.reward)}. Luego sale una más difícil.`, 'cash', 3800)
  scheduleSideQuest(22000 + Math.random() * 14000)
}

export function failSideQuest(_reason: string) {
  const quest = game.sideQuest
  if (!quest || quest.kind !== 'phones') return
  game.sideQuest = null
  emit()
  scheduleSideQuest(16000 + Math.random() * 10000)
}

function bumpSideQuest(kind: SideQuest['kind'], amount: number) {
  const quest = game.sideQuest
  if (!quest || quest.kind !== kind) return
  quest.progress = Math.min(quest.goal, quest.progress + amount)
  if (quest.progress >= quest.goal) completeSideQuest()
  else emit()
}

export function showNotice(emoji: string, title: string, text: string, tone: Notice['tone'], ms = 4400, brand?: BrandId) {
  const id = ++noticeToken
  game.notice = { id, emoji, title, text, tone, brand }
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
  const narco = city.narco
  if (Math.hypot(game.x - narco.talk.x, game.z - narco.talk.z) < 7.2) {
    if (game.cartelTalk || !game.cartel) return null
  }
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

export function eatCan() {
  game.cans += 1
  const tracking = game.sideQuest?.kind === 'cans'
  bumpSideQuest('cans', 1)
  if (!tracking) emit()
}

function pickDrop(origin: { x: number; z: number }, previous?: { address: string }) {
  const useBuilding = Math.random() < 0.4 && city.buildingDrops.length > 0
  const source = useBuilding ? city.buildingDrops : city.houses
  const far = source.filter((spot) => {
    if (previous && spot.address === previous.address) return false
    return Math.hypot(spot.delivery.x - origin.x, spot.delivery.z - origin.z) > 75
  })
  const pool = far.length ? far : source
  return pool[Math.floor(Math.random() * pool.length)]
}

function scheduleStash(delay = 16000 + Math.random() * 14000) {
  window.clearTimeout(stashTimer)
  stashTimer = window.setTimeout(() => {
    if (!game.started || !game.cartel) return
    if (game.stash || game.stashOffer || game.cartelTalk) {
      scheduleStash(5000)
      return
    }
    openStashOffer()
    if (!game.offer && !game.mission && !game.stash) openOffer()
    scheduleStash()
  }, delay)
}

function openStashOffer() {
  if (!game.started || !game.cartel || game.stash || game.stashOffer || game.cartelTalk) return
  const kgPool = [18, 22, 25, 30, 32, 36]
  const kg = kgPool[Math.floor(Math.random() * kgPool.length)]
  const reward = kg * 16500
  const drop = pickDrop(city.narco.stash)
  const id = ++stashToken
  game.stashOffer = {
    id,
    kg,
    reward,
    drop: { x: drop.delivery.x, z: drop.delivery.z, address: drop.address },
  }
  audio.order(game.muted)
  emit()
  window.setTimeout(() => {
    if (game.stashOffer?.id === id && !game.mission && !game.stash) {
      game.stashOffer = null
      emit()
    }
  }, 28000)
}

export function acceptCartel() {
  if (!game.cartelTalk) return
  game.cartelTalk = false
  game.cartel = true
  showNotice('🟢', 'Entraste al Tren de Aragua', 'Te van a mandar encargos. Recolecta y luego dejalo.', 'pop', 4400)
  scheduleStash(2800)
}

export function refuseCartel() {
  if (!game.cartelTalk) return
  game.cartelTalk = false
  emit()
}

export function acceptStash() {
  const offer = game.stashOffer
  if (!offer || game.mission || game.carrying || game.stash) return
  game.stashOffer = null
  game.stash = {
    id: offer.id,
    kg: offer.kg,
    reward: offer.reward,
    phase: 'pickup',
    pickup: { x: city.narco.stash.x, z: city.narco.stash.z },
    drop: offer.drop,
  }
  refreshRoute()
  showNotice('📦', `${offer.kg} kg`, `Recolecta el pedido. Pagan ${formatClp(offer.reward)}.`, 'pop', 4000)
}

export function rejectStash() {
  if (!game.stashOffer) return
  game.stashOffer = null
  emit()
}

function tryDealer() {
  const narco = city.narco
  if (Math.hypot(game.x - narco.talk.x, game.z - narco.talk.z) > 7.2) return false
  if (game.cartelTalk) return true
  if (!game.cartel) {
    game.cartelTalk = true
    emit()
    return true
  }
  return false
}

function tryStash() {
  const job = game.stash
  if (!job) return false
  const target = job.phase === 'pickup' ? job.pickup : job.drop
  if (Math.hypot(game.x - target.x, game.z - target.z) > 6.4) return false
  if (job.phase === 'pickup') {
    job.phase = 'drop'
    game.carrying = true
    refreshRoute()
    showNotice('📦', `Llevas ${job.kg} kg`, 'Llévalo a la casa. Te pagan al dejarlo.', 'pop', 3600)
    return true
  }
  game.money += job.reward
  game.carrying = false
  game.stash = null
  showFloater(`+ ${formatClp(job.reward)}`)
  showNotice('💵', 'Entregaste el paquete', `${job.kg} kg · ${formatClp(job.reward)}.`, 'cash', 4200)
  refreshRoute()
  scheduleStash(12000 + Math.random() * 14000)
  return true
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
  const premium = Math.random() < 0.34
  const bonus = premium ? 2500 : 0
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
    reward: dish.price + deliveryFee + bonus,
    phase: 'pickup',
    premium,
    deadline: null,
    contested: false,
    rivalKind: 'rappi',
    kitchen: false,
    holdUntil: null,
    cancelAt: null,
  }
}

function brandPickup(id: BrandId) {
  if (id === 'pizzahut') {
    const spots = city.props.filter((prop) => prop.kind === 'pizza')
    const spot = spots[Math.floor(Math.random() * spots.length)]
    if (spot) return { x: spot.x + Math.sin(spot.yaw) * 8.4, z: spot.z + Math.cos(spot.yaw) * 8.4 }
  }
  const restaurant = city.restaurants.find((item) => item.id === id) ?? city.restaurants[0]
  return restaurant.pickup
}

export function refreshRoute() {
  const stash = game.stash
  const mission = game.mission
  const food = !!(mission && mission.phase !== 'cooldown')
  if (stash && !food) {
    const target = stash.phase === 'pickup' ? stash.pickup : stash.drop
    game.path = route(game.x, game.z, target.x, target.z)
    game.distance = Math.hypot(game.x - target.x, game.z - target.z)
    const stashPrompt =
      game.distance < 6.4 && stash.phase === 'drop' ? 'E   ·   Entregar el paquete' : null
    applyPrompt(stashPrompt ?? venuePrompt())
    return
  }
  if (!mission || mission.phase === 'cooldown') {
    if (game.waypoint) {
      const away = Math.hypot(game.x - game.waypoint.x, game.z - game.waypoint.z)
      if (away < 8) {
        game.waypoint = null
        game.path = []
        game.distance = 0
        applyPrompt(venuePrompt())
        return
      }
      game.path = route(game.x, game.z, game.waypoint.x, game.waypoint.z)
      game.distance = away
      applyPrompt(venuePrompt())
      return
    }
    game.path = []
    game.distance = 0
    applyPrompt(venuePrompt())
    return
  }
  const target = mission.phase === 'pickup' ? mission.pickup : mission.drop
  game.path = route(game.x, game.z, target.x, target.z)
  game.distance = Math.hypot(game.x - target.x, game.z - target.z)
  const missionPrompt =
    mission.holdUntil && mission.phase === 'pickup'
      ? game.distance <= WAIT_RADIUS
        ? `Espera ${kitchenLeft()}s · no te alejes`
        : '¡Vuelve a la zona o se cancela!'
      : game.distance < 6.4
      ? mission.phase === 'pickup'
        ? mission.kitchen
          ? 'E   ·   Pedir el pedido (hay que esperar)'
          : 'E   ·   Recoger pedido'
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
  failSideQuest('Te pilló la policía. Roba de nuevo, sin que te pesquen.')
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
  const finishing = game.sideQuest?.kind === 'phones' && game.sideQuest.progress + 1 >= game.sideQuest.goal
  if (!finishing) {
    const title = phoneStreak === 1 ? 'Has robado un celular' : `Has robado ${phoneStreak} celulares`
    showNotice('📱', title, 'Corre antes de que llamen a la policía.', 'pop', 3600)
  }
  bumpSideQuest('phones', 1)
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
  if (tryStash()) return
  const mission = game.mission
  const target = mission && mission.phase !== 'cooldown' ? (mission.phase === 'pickup' ? mission.pickup : mission.drop) : null
  if (mission && target && Math.hypot(game.x - target.x, game.z - target.z) <= 6.4) {
    if (mission.phase === 'pickup') {
      if (mission.kitchen && !mission.holdUntil) {
        mission.holdUntil = performance.now() + 25000
        kitchenSecond = 25
        showNotice('⏳', 'El pedido no está listo', 'Quédate cerca 25 segundos. Si te sales del radio, se cancela.', 'pop', 4200, mission.brand)
        refreshRoute()
        emit()
        return
      }
      if (mission.holdUntil && performance.now() < mission.holdUntil) return
      finishPickup()
      return
    }

    const tipPool = mission.premium ? [2000, 3000, 4000, 5000] : [1000, 2000, 3000]
    const tip = mission.premium
      ? tipPool[Math.floor(Math.random() * tipPool.length)]
      : Math.random() < 0.5
        ? 0
        : tipPool[Math.floor(Math.random() * tipPool.length)]
    game.carrying = false
    game.mission = null
    game.rival = null
    premiumSecond = -1
    kitchenSecond = -1
    refreshRoute()
    if (tip > 0) {
      game.money += tip
      showFloater(`+ ${formatClp(tip)}`)
    }
    const quest = game.sideQuest
    const finishing =
      (quest?.kind === 'drops' && quest.progress + 1 >= quest.goal) ||
      (quest?.kind === 'tips' && tip > 0 && quest.progress + tip >= quest.goal)
    if (!finishing) {
      if (tip > 0) showNotice('🏠', 'Entregaste el pedido', `Te dieron propina de ${formatClp(tip)}.`, 'cash', 3600, mission.brand)
      else showNotice('🏠', 'Entregaste el pedido', 'No te dieron propina.', 'pop', 3600, mission.brand)
    }
    if (tip > 0) bumpSideQuest('tips', tip)
    bumpSideQuest('drops', 1)
    return
  }
  if (tryDealer()) return
  tryVenue()
}

export function startShift() {
  if (game.started) return
  game.started = true
  game.mission = null
  game.path = []
  game.sideQuest = null
  game.cartel = false
  game.cartelTalk = false
  game.stashOffer = null
  game.stash = null
  game.mapOpen = false
  game.waypoint = null
  phoneQuestGoal = 10
  tipQuestGoal = 30000
  dropQuestGoal = 5
  canQuestGoal = 8
  lastQuestKind = null
  window.clearTimeout(questTimer)
  window.clearTimeout(stashTimer)
  emit()
  scheduleOffers(2200)
  scheduleSideQuest(9000)
}

export function toggleMap() {
  if (!game.started) return
  game.mapOpen = !game.mapOpen
  emit()
}

export function setWaypoint(x: number, z: number) {
  game.waypoint = { x, z }
  refreshRoute()
}

export function clearWaypoint() {
  game.waypoint = null
  refreshRoute()
}

export function toggleMute() {
  game.muted = !game.muted
  emit()
}
