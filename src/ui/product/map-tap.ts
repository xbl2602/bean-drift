export interface MapTap { x: number; y: number; timeMs: number; pointerType: string; }
/** Two deliberate primary taps at the same spot; pans and pinches clear the sequence. */
export function isDoubleMapTap(previous: MapTap | null, current: MapTap): boolean {
 return previous !== null && previous.pointerType === current.pointerType && current.timeMs >= previous.timeMs && current.timeMs - previous.timeMs <= 450 && Math.hypot(current.x-previous.x,current.y-previous.y) <= 20;
}
