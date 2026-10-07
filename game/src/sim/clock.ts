// Game time. At 1× a game minute passes every half real second, so a full day takes 12 minutes;
// the time-speed keys multiply that (and the villagers walk faster to keep up).

export const SPEEDS = [1, 4, 16, 64] as const
const GAME_MIN_PER_REAL_SEC = 2

const ZODIAC = [
  ['Rat', '子'],
  ['Ox', '丑'],
  ['Tiger', '寅'],
  ['Rabbit', '卯'],
  ['Dragon', '辰'],
  ['Snake', '巳'],
  ['Horse', '午'],
  ['Sheep', '未'],
  ['Monkey', '申'],
  ['Rooster', '酉'],
  ['Dog', '戌'],
  ['Boar', '亥'],
] as const

export class Clock {
  /** Minutes since midnight, fractional. */
  minutes = 6 * 60 + 40
  day = 1
  speedIdx = 0
  paused = false

  get speed(): number {
    return this.paused ? 0 : SPEEDS[this.speedIdx]
  }

  /** Advance by a real-time delta; returns game minutes elapsed. */
  tick(realDt: number): number {
    const dm = realDt * GAME_MIN_PER_REAL_SEC * this.speed
    this.minutes += dm
    while (this.minutes >= 1440) {
      this.minutes -= 1440
      this.day++
    }
    return dm
  }

  faster(): void {
    this.speedIdx = Math.min(SPEEDS.length - 1, this.speedIdx + 1)
  }
  slower(): void {
    this.speedIdx = Math.max(0, this.speedIdx - 1)
  }
  cycle(): void {
    this.speedIdx = (this.speedIdx + 1) % SPEEDS.length
  }

  get isMarketDay(): boolean {
    return this.day % 3 === 1
  }

  hhmm(): string {
    const m = Math.floor(this.minutes)
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
  }

  /** Traditional two-hour "hour of the …" (the Rat hour is 23:00–01:00). */
  zodiac(): { name: string; kanji: string } {
    const i = Math.floor(((this.minutes + 60) % 1440) / 120)
    return { name: ZODIAC[i][0], kanji: ZODIAC[i][1] }
  }

  /** True between from and to (minutes, wrapping past midnight). */
  between(from: number, to: number): boolean {
    const m = this.minutes
    return from <= to ? m >= from && m < to : m >= from || m < to
  }
}

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
