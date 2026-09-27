// Tiny synthesized sound kit (Web Audio, no files). Call unlock() from a user gesture.

let ctx = null;
let bus = null;

function c() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    bus = ctx.createGain();
    bus.gain.value = 0.35;
    bus.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function unlock() {
  c();
}

function tone(type, f0, f1, dur, peak, delay = 0) {
  const a = c();
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(bus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur, freq, peak, delay = 0) {
  const a = c();
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(60, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t0);
}

export const shot = (role) =>
  role === "chill" ? tone("sine", 1400, 900, 0.09, 0.12) : tone("square", 1800, 1100, 0.04, 0.05);
export const lob = () => tone("sine", 160, 70, 0.18, 0.3);
export const boom = () => {
  noise(0.45, 900, 0.5);
  tone("sine", 110, 35, 0.35, 0.5);
};
export const pop = () => tone("triangle", 520, 900, 0.07, 0.12);
export const leak = () => tone("sawtooth", 220, 90, 0.3, 0.2);
export const place = () => {
  tone("triangle", 660, 660, 0.06, 0.2);
  tone("triangle", 990, 990, 0.08, 0.2, 0.05);
};
export const remove = () => tone("triangle", 700, 350, 0.1, 0.15);
export const nope = () => tone("square", 180, 150, 0.12, 0.1);
export const click = () => tone("triangle", 800, 800, 0.03, 0.1);
export const start = () => [523, 659, 784].forEach((f, i) => tone("triangle", f, f, 0.12, 0.2, i * 0.07));
export const buy = () => [880, 1320].forEach((f, i) => tone("triangle", f, f, 0.08, 0.2, i * 0.06));
export const win = () => [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, f, 0.2, 0.22, i * 0.1));
export const lose = () => [392, 330, 262].forEach((f, i) => tone("sawtooth", f, f * 0.98, 0.25, 0.12, i * 0.15));
export const coin = () => [1320, 1760].forEach((f, i) => tone("triangle", f, f, 0.07, 0.15, i * 0.05));
// Big and bright: achievements are a big deal.
export const fanfare = () => {
  [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone("triangle", f, f, 0.22, 0.24, i * 0.09));
  [262, 392, 523].forEach((f) => tone("sine", f, f, 0.9, 0.12, 0.3));
};
