import { describe, expect, it } from 'vitest';
import { coverCrop } from './crop.js';
describe('cover crop geometry', () => {
  it('centers a book crop within a landscape photo', () => expect(coverCrop(1200, 800, 2 / 3)).toEqual({ originX: 334, originY: 1, width: 533, height: 799 }));
  it('preserves the full image when no aspect ratio is selected', () => expect(coverCrop(600, 900, null)).toEqual({ originX: 0, originY: 0, width: 600, height: 900 }));
  it('keeps all zoomed and shifted crops inside integer pixel bounds', () => {
    for (const [w, h] of [[1, 1], [4032, 3024], [3024, 4032], [7, 11]]) for (const aspect of [null, 1, 2 / 3]) for (const zoom of [1, 1.25, 4]) for (const position of [-1, 0, 0.5, 1, 2]) {
      const crop = coverCrop(w!, h!, aspect, zoom, position, position);
      expect(Object.values(crop).every(Number.isInteger)).toBe(true);
      expect(crop.width).toBeGreaterThan(0); expect(crop.height).toBeGreaterThan(0);
      expect(crop.originX).toBeGreaterThanOrEqual(0); expect(crop.originY).toBeGreaterThanOrEqual(0);
      expect(crop.originX + crop.width).toBeLessThanOrEqual(w!); expect(crop.originY + crop.height).toBeLessThanOrEqual(h!);
    }
  });
  it.each([[0, 2, null], [2, 0, null], [NaN, 2, 1], [2, 2, 0], [2, 2, Infinity]])('rejects invalid geometry', (w, h, aspect) => expect(() => coverCrop(w as number, h as number, aspect)).toThrow());
});
