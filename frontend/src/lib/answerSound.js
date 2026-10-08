// Âm thanh phản hồi (port từ hệ thống làm bài cũ): đúng = "Ting", sai = "Ét è". Tổng hợp bằng Web Audio, không cần file.
let audioCtx = null

function getAudioCtx() {
  const Ctx = typeof window === 'undefined' ? null : window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) { try { audioCtx = new Ctx() } catch { return null } }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

function playTone(ctx, { type, freq, freqEnd, start, duration, gain, lowpass }) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  let last = osc
  if (lowpass) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = lowpass
    osc.connect(filter)
    last = filter
  }
  last.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

export function playAnswerSound(kind) {
  try {
    const ctx = getAudioCtx()
    if (!ctx) return
    const t = ctx.currentTime + 0.01
    if (kind === 'correct') {
      playTone(ctx, { type: 'sine', freq: 1760, start: t, duration: 0.75, gain: 0.22 })
      playTone(ctx, { type: 'sine', freq: 3520, start: t, duration: 0.4, gain: 0.07 })
      playTone(ctx, { type: 'sine', freq: 2637, start: t, duration: 0.55, gain: 0.05 })
      return
    }
    playTone(ctx, { type: 'sawtooth', freq: 260, freqEnd: 210, start: t, duration: 0.16, gain: 0.16, lowpass: 900 })
    playTone(ctx, { type: 'sawtooth', freq: 200, freqEnd: 130, start: t + 0.2, duration: 0.3, gain: 0.16, lowpass: 800 })
  } catch { /* trình duyệt chặn âm thanh: bỏ qua */ }
}
