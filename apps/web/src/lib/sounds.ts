/** Lightweight Web Audio sound effects (no external assets). */

export type SoundId = 'play' | 'capture' | 'flip' | 'go' | 'stop' | 'win' | 'bomb' | 'bright' | 'tap';

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function setSoundMuted(value: boolean): void {
  muted = value;
}

export function isSoundMuted(): boolean {
  return muted;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.12): void {
  if (muted) return;
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') void ac.resume();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch {
    /* ignore autoplay restrictions */
  }
}

function noiseBurst(duration: number): void {
  if (muted) return;
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') void ac.resume();
    const bufferSize = ac.sampleRate * duration;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const g = ac.createGain();
    g.gain.value = 0.08;
    src.connect(g);
    g.connect(ac.destination);
    src.start();
  } catch {
    /* ignore */
  }
}

export function playSound(id: SoundId): void {
  switch (id) {
    case 'tap':
      tone(520, 0.06, 'triangle', 0.08);
      break;
    case 'play':
      tone(380, 0.08, 'triangle');
      tone(520, 0.1, 'triangle', 0.08);
      break;
    case 'capture':
      tone(660, 0.12, 'sine');
      tone(880, 0.15, 'sine', 0.1);
      break;
    case 'flip':
      tone(440, 0.07, 'square', 0.06);
      break;
    case 'go':
      tone(523, 0.1);
      setTimeout(() => tone(784, 0.15, 'sine', 0.14), 80);
      setTimeout(() => tone(988, 0.2, 'sine', 0.12), 160);
      break;
    case 'stop':
      tone(392, 0.2, 'sine', 0.14);
      tone(294, 0.35, 'sine', 0.1);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.1), i * 120));
      break;
    case 'bomb':
      noiseBurst(0.35);
      tone(120, 0.4, 'sawtooth', 0.15);
      break;
    case 'bright':
      tone(880, 0.15, 'sine', 0.12);
      tone(1175, 0.25, 'sine', 0.1);
      break;
  }
}
