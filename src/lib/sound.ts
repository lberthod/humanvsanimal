// Petits effets sonores synthétisés (aucun fichier audio) via Web Audio API.
// Activés par défaut, préférence mémorisée dans localStorage.

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem('hva-sound') !== 'off';
}
export function setSoundEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('hva-sound', on ? 'on' : 'off');
}

function tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay = 0, sweep?: number) {
  if (!isSoundEnabled()) return;
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t0); osc.stop(t0 + duration + 0.02);
}

function noiseThud(duration: number, gainPeak: number, delay = 0) {
  if (!isSoundEnabled()) return;
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + delay;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource(); src.buffer = buffer;
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(400, t0);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter); filter.connect(gain); gain.connect(c.destination);
  src.start(t0);
}

export const sfx = {
  hitLight: () => noiseThud(0.12, 0.18),
  hitSevere: () => { noiseThud(0.18, 0.28); tone(120, 0.15, 'sawtooth', 0.1, 0.02, 60); },
  hitDead: () => { noiseThud(0.22, 0.32); tone(90, 0.25, 'sawtooth', 0.14, 0.02, 40); },
  shot: () => noiseThud(0.06, 0.14),
  victory: () => { tone(523, 0.12, 'square', 0.12, 0); tone(659, 0.12, 'square', 0.12, 0.1); tone(784, 0.28, 'square', 0.14, 0.2); },
  defeat: () => { tone(220, 0.35, 'sawtooth', 0.12, 0, 90); },
};
