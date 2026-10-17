/** Helpers are pure and worklet-compatible; the same geometry is tested without native runtime. */
export function shelfDropIndex(centers: number[], center: number): number {
  'worklet';
  if (!centers.length) return -1;
  let closest = 0;
  for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i]! - center) < Math.abs(centers[closest]! - center)) closest = i;
  return closest;
}
export function shelfNeighborShift(index: number, from: number, to: number, slotWidth: number) {
  'worklet';
  if (from < 0 || to < 0 || from === to) return 0;
  if (from < to && index > from && index <= to) return -slotWidth;
  if (from > to && index >= to && index < from) return slotWidth;
  return 0;
}
