import type { ShelfLayout } from '@where-my-books/shared';
export function rowPath(layout: ShelfLayout, rowId: string) {
  const row = layout.rows.find((value) => value.id === rowId); const section = layout.sections.find((value) => value.id === row?.sectionId); const shelf = layout.shelves.find((value) => value.id === section?.shelfId); const room = layout.rooms.find((value) => value.id === shelf?.roomId);
  return [room?.name, shelf?.name, section?.name, row?.name].filter(Boolean).join(' → ');
}
export function copyLocation(layout: ShelfLayout, id: string) {
  const placement = layout.placements.find((value) => value.copyId === id);
  return placement ? `${rowPath(layout, placement.rowId)} → Книга ${placement.position + 1}` : 'Вне полок';
}
