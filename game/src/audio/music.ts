// Generative background score: a drone, a wandering koto melody in the in-scale, and taiko
// that joins in as tension rises. Never loops audibly because every phrase is chosen live.

import { getGraph, type Graph } from "./engine";
import { drone, koto, scaleHz, taiko, type Drone } from "./instruments";

/** 0 = calm night march, 1 = contact with the enemy, 2 = the lord is in danger. */
export type Tension = 0 | 1 | 2;

interface Profile {
  bpm: number;
  noteChance: number; // per eighth note
  droneLevel: number;
  taiko: (step: number) => number; // step 0..15 in a 2-bar loop → volume (0 = silent)
}

const PROFILES: Record<Tension, Profile> = {
  0: { bpm: 66, noteChance: 0.22, droneLevel: 0.35, taiko: () => 0 },
  1: {
    bpm: 80,
    noteChance: 0.35,
    droneLevel: 0.4,
    taiko: (s) => (s === 0 ? 0.45 : s === 8 ? 0.3 : 0),
  },
  2: {
    bpm: 100,
    noteChance: 0.45,
    droneLevel: 0.5,
    taiko: (s) => (s % 4 === 0 ? 0.55 : s === 14 || s === 15 ? 0.35 : 0),
  },
};

const LOOKAHEAD_S = 0.15;
const TICK_MS = 30;

let timer: ReturnType<typeof setInterval> | null = null;
let pad: Drone | null = null;
let tension: Tension = 0;
let nextTime = 0;
let step = 0;
let degree = 5; // melody position in scale degrees (5 = D4)

function scheduleStep(g: Graph, when: number): void {
  const p = PROFILES[tension];

  // Melody: random walk, weighted toward small steps, resting on phrase ends.
  const phraseEnd = step % 8 === 7;
  if (!phraseEnd && Math.random() < p.noteChance) {
    const move = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
    degree = Math.max(2, Math.min(11, degree + move));
    koto(g, g.music, scaleHz(degree), when, 0.28 + Math.random() * 0.1);
    // Occasional octave-below grace note, a common koto gesture.
    if (Math.random() < 0.12) koto(g, g.music, scaleHz(degree - 5), when + 0.04, 0.18);
  }

  // Bass anchor on the downbeat of each bar.
  if (step % 8 === 0 && Math.random() < 0.7) koto(g, g.music, scaleHz(0), when, 0.25);

  const drum = p.taiko(step);
  if (drum > 0) taiko(g, g.music, when, drum, step % 4 === 0 ? 1 : 1.3);

  step = (step + 1) % 16;
}

function tick(): void {
  const g = getGraph();
  if (!g || g.ctx.state !== "running") return;
  const eighth = 30 / PROFILES[tension].bpm;
  if (nextTime < g.ctx.currentTime) nextTime = g.ctx.currentTime + 0.05;
  while (nextTime < g.ctx.currentTime + LOOKAHEAD_S) {
    scheduleStep(g, nextTime);
    nextTime += eighth;
  }
}

export function startMusic(): void {
  const g = getGraph();
  if (!g || timer) return;
  pad = drone(g, g.music);
  pad.setLevel(PROFILES[tension].droneLevel, g.ctx.currentTime);
  step = 0;
  nextTime = 0;
  timer = setInterval(tick, TICK_MS);
}

export function stopMusic(): void {
  const g = getGraph();
  if (timer) clearInterval(timer);
  timer = null;
  if (g && pad) pad.stop(g.ctx.currentTime);
  pad = null;
}

export function isMusicPlaying(): boolean {
  return timer !== null;
}

export function setTension(next: Tension): void {
  if (next === tension) return;
  tension = next;
  const g = getGraph();
  if (g && pad) pad.setLevel(PROFILES[next].droneLevel, g.ctx.currentTime);
}

export function getTension(): Tension {
  return tension;
}
