import type { PhysicalLocation, ShelfLayout } from './models.js';
/** Build once per layout snapshot; searching thousands of books must not rescan all placements per book. */
export function indexShelfLocations(layout: ShelfLayout) {
  const rooms = new Map(layout.rooms.map((room) => [room.id, room]));
  const shelves = new Map(layout.shelves.map((shelf) => [shelf.id, shelf]));
  const sections = new Map(layout.sections.map((section) => [section.id, section]));
  const rows = new Map<string, string>(); const rowIds = new Map<string, Omit<PhysicalLocation, 'position' | 'path'>>();
  for (const row of layout.rows) {
    const section = sections.get(row.sectionId); const shelf = section ? shelves.get(section.shelfId) : undefined; const room = shelf ? rooms.get(shelf.roomId) : undefined;
    if (!section || !shelf || !room) continue;
    rows.set(row.id, [room.name, shelf.name, section.name, row.name].join(' → '));
    rowIds.set(row.id, { rowId: row.id, sectionId: section.id, shelfId: shelf.id, roomId: room.id });
  }
  const copies = new Map<string, PhysicalLocation>();
  for (const placement of layout.placements) {
    const ids = rowIds.get(placement.rowId); const path = rows.get(placement.rowId);
    if (ids && path) copies.set(placement.copyId, { ...ids, position: placement.position, path: `${path} → Книга ${placement.position + 1}` });
  }
  return { rows, copies };
}
