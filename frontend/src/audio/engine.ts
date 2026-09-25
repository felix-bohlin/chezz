// Shared Web Audio graph: one context, three buses (music, sfx) into a master with a reverb send.
// Everything is synthesized — there are no audio assets to load.

export interface AudioSettings {
  master: number; // 0..1
  music: number;
  sfx: number;
  muted: boolean;
}

const STORAGE_KEY = "chezz.audio";
const DEFAULTS: AudioSettings = { master: 0.8, music: 0.5, sfx: 0.8, muted: false };

export interface Graph {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
  reverb: GainNode; // send: connect a voice here as well as to its bus for room sound
}

let graph: Graph | null = null;
let master: GainNode | null = null;
let settings: AudioSettings = loadSettings();

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // storage unavailable (private mode, blocked) — fall through
  }
  return { ...DEFAULTS };
}

function saveSettings(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // non-essential
  }
}

/** Synthetic hall impulse: decaying stereo noise. */
function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function applySettings(): void {
  if (!graph || !master) return;
  const t = graph.ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : settings.master, t, 0.05);
  graph.music.gain.setTargetAtTime(settings.music, t, 0.05);
  graph.sfx.gain.setTargetAtTime(settings.sfx, t, 0.05);
}

/** Lazily builds the graph. Returns null where Web Audio is unavailable (SSR, old browsers). */
export function getGraph(): Graph | null {
  if (graph) return graph;
  const Ctor = typeof window !== "undefined" ? window.AudioContext : undefined;
  if (!Ctor) return null;

  const ctx = new Ctor();
  master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 12;
  master.connect(limiter).connect(ctx.destination);

  const music = ctx.createGain();
  const sfx = ctx.createGain();
  music.connect(master);
  sfx.connect(master);

  const reverb = ctx.createGain();
  reverb.gain.value = 0.35;
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx, 2.8, 2.5);
  reverb.connect(convolver).connect(master);

  graph = { ctx, music, sfx, reverb };
  applySettings();
  return graph;
}

/**
 * Browsers keep audio suspended until a user gesture. Call this from the first click
 * (e.g. "Start game"); `installUnlock` does it automatically on the first pointer/key event.
 */
export async function unlockAudio(): Promise<void> {
  const g = getGraph();
  if (g && g.ctx.state !== "running") await g.ctx.resume();
}

export function installUnlock(): void {
  if (typeof window === "undefined") return;
  const handler = () => {
    void unlockAudio();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
}

export function getSettings(): AudioSettings {
  return { ...settings };
}

export function setSettings(patch: Partial<AudioSettings>): void {
  settings = { ...settings, ...patch };
  saveSettings();
  applySettings();
}

export function isRunning(): boolean {
  return graph?.ctx.state === "running";
}
