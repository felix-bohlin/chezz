// Keyboard plus a minimal touch scheme: drag anywhere to walk (virtual stick from where the finger
// landed), tap to talk/inspect, double-tap to hide in the shell. UI hit areas get first claim on taps.

const held = new Set<string>()
const pressed = new Set<string>()
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'])

let stick: { id: number; x0: number; y0: number; x: number; y: number; t0: number; moved: boolean } | null = null
let lastTap = 0
type TapHandler = (x: number, y: number) => boolean
let tapHandler: TapHandler | null = null

export function installInput(el: HTMLElement): void {
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    if (!e.repeat) pressed.add(e.code)
    held.add(e.code)
  })
  window.addEventListener('keyup', (e) => held.delete(e.code))
  window.addEventListener('blur', () => held.clear())

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (tapHandler?.(e.clientX, e.clientY)) return
      pressed.add('Click')
      return
    }
    if (stick) return
    stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: false }
  })
  el.addEventListener('pointermove', (e) => {
    if (!stick || e.pointerId !== stick.id) return
    stick.x = e.clientX
    stick.y = e.clientY
    if (Math.hypot(stick.x - stick.x0, stick.y - stick.y0) > 12) stick.moved = true
  })
  const end = (e: PointerEvent) => {
    if (!stick || e.pointerId !== stick.id) return
    const quick = performance.now() - stick.t0 < 300
    if (!stick.moved && quick) {
      if (!tapHandler?.(stick.x, stick.y)) {
        const now = performance.now()
        if (now - lastTap < 320) pressed.add('Space')
        else pressed.add('KeyE')
        lastTap = now
      }
    }
    stick = null
  }
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

/** UI gets a look at every tap/click first (screen CSS coords); return true to swallow it. */
export function onTap(handler: TapHandler): void {
  tapHandler = handler
}

export const input = {
  down(...codes: string[]): boolean {
    return codes.some((c) => held.has(c))
  },
  pressed(...codes: string[]): boolean {
    return codes.some((c) => pressed.has(c))
  },
  anyPressed(): boolean {
    return pressed.size > 0
  },
  /** Movement vector, length ≤ 1. */
  axis(): { x: number; y: number } {
    let x = 0
    let y = 0
    if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1
    if (held.has('KeyD') || held.has('ArrowRight')) x += 1
    if (held.has('KeyW') || held.has('ArrowUp')) y -= 1
    if (held.has('KeyS') || held.has('ArrowDown')) y += 1
    if (stick && stick.moved) {
      const dx = stick.x - stick.x0
      const dy = stick.y - stick.y0
      const len = Math.hypot(dx, dy)
      if (len > 10) {
        x = dx / len
        y = dy / len
      }
    }
    const len = Math.hypot(x, y)
    return len > 1 ? { x: x / len, y: y / len } : { x, y }
  },
  /** Touch drag in progress (for drawing the virtual stick). */
  stick(): { x0: number; y0: number; x: number; y: number } | null {
    return stick && stick.moved ? stick : null
  },
  endFrame(): void {
    pressed.clear()
  },
}
