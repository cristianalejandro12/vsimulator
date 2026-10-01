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
    hemi: 1.05,
    amb: 0.46,
    sun: '#fff1dc',
    sunI: 2.05,
    elev: 38,
    az: 26,
    label: 'Día',
  },
  dusk: {
    sky: '#ffd0a8',
    bg: '#e89458',
    fog: '#f0b48a',
    near: 220,
    far: 740,
    hemiSky: '#ffd2a8',
    hemiGround: '#d7b48a',
    hemi: 0.98,
    amb: 0.5,
    sun: '#ffc27a',
    sunI: 1.75,
    elev: 20,
    az: 36,
    label: 'Atardecer',
  },
  night: {
    sky: '#3d4d72',
    bg: '#0d1524',
    fog: '#2a3854',
    near: 120,
    far: 560,
    hemiSky: '#6d7fa0',
    hemiGround: '#4a4036',
    hemi: 0.42,
    amb: 0.22,
    sun: '#a8b8d8',
    sunI: 0.45,
    elev: 18,
    az: -12,
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
