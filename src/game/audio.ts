let ctx: AudioContext | null = null
let engine: OscillatorNode | null = null
let engineGain: GainNode | null = null
let filter: BiquadFilterNode | null = null
let started = false

export const audio = {
  start() {
    if (started) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctx()
    engine = ctx.createOscillator()
    engine.type = 'sawtooth'
    filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 240
    engineGain = ctx.createGain()
    engineGain.gain.value = 0
    engine.connect(filter)
    filter.connect(engineGain)
    engineGain.connect(ctx.destination)
    engine.start()
    started = true
    void ctx.resume()
  },
  update(speed: number, muted: boolean) {
    if (!ctx || !engine || !engineGain || !filter) return
    const kph = Math.abs(speed)
    engine.frequency.value = 48 + kph * 3.1
    filter.frequency.value = 180 + kph * 8
    engineGain.gain.value = muted ? 0 : 0.012 + Math.min(0.03, kph * 0.0011)
  },
  horn(muted: boolean) {
    if (!ctx || muted) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 420
    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  },
  order(muted: boolean) {
    if (!ctx || muted) return
    const now = ctx.currentTime
    ;[784, 1046].forEach((freq, index) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const at = now + index * 0.08
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.05, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
      osc.connect(gain)
      gain.connect(ctx!.destination)
      osc.start(at)
      osc.stop(at + 0.18)
    })
  },
  bump(muted: boolean) {
    if (!ctx || muted) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(140, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  },
}
