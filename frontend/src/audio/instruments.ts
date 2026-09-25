// Synthesized instruments. Each takes the destination bus and a start time (AudioContext seconds).

import type { Graph } from "./engine";

/** Miyako-bushi (in) scale on D: D Eb G A Bb — the classic koto sakura mode. */
export const IN_SCALE = [0, 1, 5, 7, 8];
export const ROOT_HZ = 146.83; // D3

export function scaleHz(degree: number, rootHz = ROOT_HZ): number {
  const n = IN_SCALE.length;
  const octave = Math.floor(degree / n);
  const step = IN_SCALE[((degree % n) + n) % n];
  return rootHz * Math.pow(2, octave + step / 12);
}

// --- koto: Karplus–Strong plucked string, rendered once per pitch and cached ---

const kotoCache = new Map<string, AudioBuffer>();

function kotoBuffer(ctx: BaseAudioContext, hz: number): AudioBuffer {
  const key = hz.toFixed(2);
  const cached = kotoCache.get(key);
  if (cached) return cached;

  const seconds = 2.5;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buf.getChannelData(0);
  const period = Math.max(2, Math.round(ctx.sampleRate / hz));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let idx = 0;
  const damping = 0.996;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % period;
    const v = ring[idx];
    ring[idx] = damping * 0.5 * (v + ring[next]);
    out[i] = v;
    idx = next;
  }
  kotoCache.set(key, buf);
  return buf;
}

export function koto(g: Graph, bus: AudioNode, hz: number, when: number, vol = 0.5): void {
  const { ctx } = g;
  const src = ctx.createBufferSource();
  src.buffer = kotoBuffer(ctx, hz);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = Math.min(6000, hz * 12);
  const amp = ctx.createGain();
  amp.gain.value = vol;
  src.connect(tone).connect(amp);
  amp.connect(bus);
  amp.connect(g.reverb);
  src.start(when);
}

// --- taiko: pitched sine drop + skin noise ---

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

export function taiko(g: Graph, bus: AudioNode, when: number, vol = 0.8, pitch = 1): void {
  const { ctx } = g;
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(120 * pitch, when);
  osc.frequency.exponentialRampToValueAtTime(48 * pitch, when + 0.35);
  const body = ctx.createGain();
  body.gain.setValueAtTime(0.0001, when);
  body.gain.exponentialRampToValueAtTime(vol, when + 0.005);
  body.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
  osc.connect(body);

  const skin = ctx.createBufferSource();
  skin.buffer = noise(ctx);
  const skinFilter = ctx.createBiquadFilter();
  skinFilter.type = "lowpass";
  skinFilter.frequency.value = 900;
  const skinAmp = ctx.createGain();
  skinAmp.gain.setValueAtTime(vol * 0.5, when);
  skinAmp.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
  skin.connect(skinFilter).connect(skinAmp);

  for (const n of [body, skinAmp]) {
    n.connect(bus);
    n.connect(g.reverb);
  }
  osc.start(when);
  osc.stop(when + 1);
  skin.start(when, Math.random() * 0.5, 0.15);
}

// --- wood click (hyoshigi): the sound of a piece being set down ---

export function woodClick(g: Graph, bus: AudioNode, when: number, vol = 0.5, hz = 1800): void {
  const { ctx } = g;
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = hz * (0.95 + Math.random() * 0.1);
  bp.Q.value = 8;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(vol, when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  src.connect(bp).connect(amp);
  amp.connect(bus);
  amp.connect(g.reverb);
  src.start(when, Math.random() * 0.5, 0.08);
}

// --- temple gong / bell: inharmonic partials with long decays ---

export function gong(g: Graph, bus: AudioNode, when: number, vol = 0.5, hz = 80, length = 6): void {
  const { ctx } = g;
  const partials = [1, 1.47, 2.09, 2.56, 3.22, 4.18];
  partials.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = hz * ratio;
    const amp = ctx.createGain();
    const peak = vol / (i + 1.5);
    const decay = length / (1 + i * 0.6);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(peak, when + 0.02 + i * 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    osc.connect(amp);
    amp.connect(bus);
    amp.connect(g.reverb);
    osc.start(when);
    osc.stop(when + decay + 0.1);
  });
}

// --- drone: sustained low fifth with slow filter swell (used by music) ---

export interface Drone {
  setLevel(level: number, when: number): void;
  stop(when: number): void;
}

export function drone(g: Graph, bus: AudioNode, rootHz = ROOT_HZ / 2): Drone {
  const { ctx } = g;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 400;
  lp.connect(out);
  out.connect(bus);
  out.connect(g.reverb);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 250;
  lfo.connect(lfoDepth).connect(lp.frequency);
  lfo.start(now);

  const oscs = [rootHz, rootHz * 1.5, rootHz * 2.003].map((hz, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? "sawtooth" : "triangle";
    o.frequency.value = hz;
    const a = ctx.createGain();
    a.gain.value = i === 0 ? 0.08 : 0.12;
    o.connect(a).connect(lp);
    o.start(now);
    return o;
  });

  return {
    setLevel(level, when) {
      out.gain.setTargetAtTime(level, when, 1.5);
    },
    stop(when) {
      out.gain.setTargetAtTime(0, when, 0.8);
      for (const o of [...oscs, lfo]) o.stop(when + 4);
    },
  };
}
