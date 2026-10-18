import { describe, expect, it } from 'vitest';
import type { ShelfLayout } from './models.js';
import { indexShelfLocations } from './locations.js';
import { insertCopies, parseShelfAction } from './actions.js';
import { shelfDropIndex, shelfNeighborShift } from './geometry.js';
const a = '00000000-0000-4000-8000-000000000001'; const b = '00000000-0000-4000-8000-000000000002';
describe('physical shelf action boundaries', () => {
  it('normalizes keys for replay without changing ordered copy IDs', () => expect(parseShelfAction({ type: 'move', rowId: b.toUpperCase(), copyIds: [a.toUpperCase()] })).toEqual({ type: 'move', rowId: b, copyIds: [a] }));
  it('requires explicit unplacement and accepts explicit null', () => { expect(() => parseShelfAction({ type: 'move', copyIds: [a] })).toThrow(); expect(parseShelfAction({ type: 'move', copyIds: [a], rowId: null })).toMatchObject({ rowId: null }); });
  it.each([null, [], { type: 'constructor' }, { type: 'move', copyIds: [a, a], rowId: b }, { type: 'move', copyIds: Array(51).fill(a), rowId: b }, { type: 'rename', kind: 'user', id: a, name: 'X' }, { type: 'create_room', id: a, name: ' ' }, { type: 'create_room', id: a, name: 'X', userId: b }, { type: 'create_row', id: a, sectionId: b, name: 'R', capacity: 201 }])('rejects malformed or unbounded mutations', (value) => expect(() => parseShelfAction(value)).toThrow());
  it('retains the difference between implicit deletion and explicit book transfer', () => {
    expect(parseShelfAction({ type: 'delete', kind: 'shelf', id: a })).not.toHaveProperty('destinationRowId');
    expect(parseShelfAction({ type: 'delete', kind: 'shelf', id: a, destinationRowId: null })).toHaveProperty('destinationRowId', null);
  });
  it('moves a contiguous group without duplicate copies', () => { expect(insertCopies(['a', 'b', 'c', 'd'], ['b', 'c'], 'a')).toEqual(['b', 'c', 'a', 'd']); expect(insertCopies(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c', 'a']); expect(() => insertCopies(['a'], ['b'], 'gone')).toThrow(); });
});
describe('shelf motion geometry', () => {
  it('chooses positions by real variable-width centers, clamping the row edges', () => {
    expect(shelfDropIndex([25, 90, 170], -100)).toBe(0); expect(shelfDropIndex([25, 90, 170], 145)).toBe(2); expect(shelfDropIndex([25, 90, 170], 1000)).toBe(2); expect(shelfDropIndex([], 5)).toBe(-1);
  });
  it('opens one book-width gap only for neighbors between source and target', () => {
    expect([0, 1, 2, 3].map((i) => shelfNeighborShift(i, 0, 2, 72))).toEqual([0, -72, -72, 0]);
    expect([0, 1, 2, 3].map((i) => shelfNeighborShift(i, 3, 1, 96))).toEqual([0, 96, 96, 0]);
    expect(shelfNeighborShift(1, -1, 2, 72)).toBe(0);
  });
});

describe('indexed physical locations', () => {
  const fixture = (): ShelfLayout => ({ revision: 1, rooms: [{ id: 'room', name: 'Гостиная' }], shelves: [{ id: 'shelf', name: 'Дубовый', roomId: 'room' }], sections: [{ id: 'section', shelfId: 'shelf', name: 'Левая' }], rows: [{ id: 'row', sectionId: 'section', name: 'Полка3' }], placements: [{ id: 'p', copyId: 'copy', rowId: 'row', position: 11 }] } as ShelfLayout);
  it('returns the complete physical path and one-based book label', () => expect(indexShelfLocations(fixture()).copies.get('copy')).toEqual({ roomId: 'room', shelfId: 'shelf', sectionId: 'section', rowId: 'row', position: 11, path: 'Гостиная → Дубовый → Левая → Полка3 → Книга 12' }));
  it('rebuilds after rename/reorder without mutating the previous snapshot', () => {
    const original = fixture(); const first = indexShelfLocations(original);
    const changed = { ...original, placements: original.placements.map((p) => ({ ...p, position: 0 })) };
    expect(indexShelfLocations(changed).copies.get('copy')?.path).toContain('Книга 1'); expect(first.copies.get('copy')?.position).toBe(11);
  });
  it('does not invent a location for an unplaced or missing-parent copy', () => { const data = fixture(); data.rooms = []; const index = indexShelfLocations(data); expect(index.copies.has('copy')).toBe(false); expect(index.copies.has('unplaced')).toBe(false); });
});
