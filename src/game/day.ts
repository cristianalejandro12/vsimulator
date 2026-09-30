import type { TimeOfDay } from './store'

export type SkyLook = (typeof TIME_LOOK)['day']

export const TIME_LOOK: Record<
  TimeOfDay,
  {
    sky: string
    bg: string
    fog: string
    near: number
    far: number
    hemiSky: string
    hemiGround: string
    hemi: number
    amb: number
    sun: string
    sunI: number
    elev: number
    az: number
    label: string
  }
> = {
  day: {
    sky: '#ffffff',
    bg: '#2ea8f0',
    fog: '#5ec4f8',
    near: 240,
    far: 780,
    hemiSky: '#b9dcff',
    hemiGround: '#c6b496',
    hemi: 0.78,
    amb: 0.28,
    sun: '#fff1dc',
    sunI: 1.65,
    elev: 38,
    az: 26,
    label: 'Día',
  },
  dusk: {
    sky: '#ffc090',
    bg: '#e89458',
    fog: '#f0b48a',
    near: 220,
    far: 740,
    hemiSky: '#ffd2a8',
    hemiGround: '#d7b48a',
    hemi: 0.72,
    amb: 0.32,
    sun: '#ffc27a',
    sunI: 1.35,
    elev: 20,
    az: 36,
    label: 'Atardecer',
  },
  night: {
    sky: '#6e86b8',
    bg: '#24385c',
    fog: '#7d94b8',
    near: 200,
    far: 700,
    hemiSky: '#b9c9ea',
    hemiGround: '#8d7d68',
    hemi: 0.62,
    amb: 0.38,
    sun: '#e7eefc',
    sunI: 0.95,
    elev: 28,
    az: -8,
    label: 'Noche',
  },
}

function mixChannel(from: number, to: number, t: number) {
  return Math.round(from + (to - from) * t)
}

function mixHex(from: string, to: string, t: number) {
  const read = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16))
  const a = read(from)
  const b = read(to)
  const mixed = a.map((channel, index) => mixChannel(channel, b[index], t))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function mixLook(from: SkyLook, to: SkyLook, amount: number): SkyLook {
  const t = amount * amount * (3 - 2 * amount)
  return {
    sky: mixHex(from.sky, to.sky, t),
    bg: mixHex(from.bg, to.bg, t),
    fog: mixHex(from.fog, to.fog, t),
    near: from.near + (to.near - from.near) * t,
    far: from.far + (to.far - from.far) * t,
    hemiSky: mixHex(from.hemiSky, to.hemiSky, t),
    hemiGround: mixHex(from.hemiGround, to.hemiGround, t),
    hemi: from.hemi + (to.hemi - from.hemi) * t,
    amb: from.amb + (to.amb - from.amb) * t,
    sun: mixHex(from.sun, to.sun, t),
    sunI: from.sunI + (to.sunI - from.sunI) * t,
    elev: from.elev + (to.elev - from.elev) * t,
    az: from.az + (to.az - from.az) * t,
    label: t < 0.5 ? from.label : to.label,
  }
}

export function blendedLook(clock: number): SkyLook {
  const hour = (((clock % 86400) + 86400) % 86400) / 3600
  if (hour >= 16.5 && hour < 19) return mixLook(TIME_LOOK.day, TIME_LOOK.dusk, (hour - 16.5) / 2.5)
  if (hour >= 19 && hour < 21.5) return mixLook(TIME_LOOK.dusk, TIME_LOOK.night, (hour - 19) / 2.5)
  if (hour >= 5 && hour < 7.5) return mixLook(TIME_LOOK.night, TIME_LOOK.day, (hour - 5) / 2.5)
  if (hour >= 21.5 || hour < 5) return TIME_LOOK.night
  return TIME_LOOK.day
}
