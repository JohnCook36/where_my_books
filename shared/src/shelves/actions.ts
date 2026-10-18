import type { ShelfAction } from './models.js';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** Strict action allowlist; DB ownership/capacity/revision checks remain authoritative. */
export function parseShelfAction(input: unknown): ShelfAction {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Некорректное действие с полкой');
  const value = input as Record<string, unknown>;
  const keys: Record<string, string[]> = {
    create_room: ['type', 'id', 'name'], create_shelf: ['type', 'id', 'roomId', 'name', 'theme', 'sections', 'rows', 'capacity'],
    create_section: ['type', 'id', 'shelfId', 'name'], create_row: ['type', 'id', 'sectionId', 'name', 'capacity'], rename: ['type', 'kind', 'id', 'name'],
    delete: ['type', 'kind', 'id', 'destinationRowId'], move: ['type', 'copyIds', 'rowId', 'beforeCopyId'], sort: ['type', 'rowId', 'by'], undo: ['type', 'operationId'],
  };
  if (typeof value.type !== 'string' || !Object.hasOwn(keys, value.type) || Object.keys(value).some((key) => !keys[value.type as string]!.includes(key))) throw new Error('Неизвестное действие или поле');
  const fail = () => { throw new Error('Проверьте параметры действия с полкой'); };
  const id = (key: string) => { if (!uuid(value[key])) fail(); return String(value[key]).toLowerCase(); };
  const name = () => { if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) fail(); return String(value.name).trim(); };
  const count = (key: string, max: number) => { if (!Number.isInteger(value[key]) || Number(value[key]) < 1 || Number(value[key]) > max) fail(); return Number(value[key]); };
  const kind = () => { if (!['room', 'shelf', 'section', 'row'].includes(String(value.kind))) fail(); return value.kind as 'room' | 'shelf' | 'section' | 'row'; };
  const optionalId = (key: string) => value[key] === null ? null : id(key);
  switch (value.type) {
    case 'create_room': return { type: value.type, id: id('id'), name: name() };
    case 'create_shelf': if (!['oak', 'ivory', 'night'].includes(String(value.theme))) fail(); return { type: value.type, id: id('id'), roomId: id('roomId'), name: name(), theme: value.theme as 'oak' | 'ivory' | 'night', sections: count('sections', 8), rows: count('rows', 12), capacity: count('capacity', 200) };
    case 'create_section': return { type: value.type, id: id('id'), shelfId: id('shelfId'), name: name() };
    case 'create_row': return { type: value.type, id: id('id'), sectionId: id('sectionId'), name: name(), capacity: count('capacity', 200) };
    case 'rename': return { type: value.type, kind: kind(), id: id('id'), name: name() };
    case 'delete': return { type: value.type, kind: kind(), id: id('id'), ...(value.destinationRowId !== undefined ? { destinationRowId: optionalId('destinationRowId') } : {}) };
    case 'move': {
      if (!Array.isArray(value.copyIds) || !value.copyIds.length || value.copyIds.length > 50 || !value.copyIds.every(uuid)) fail();
      const copyIds = (value.copyIds as string[]).map((key) => key.toLowerCase()); if (new Set(copyIds).size !== copyIds.length) fail();
      return { type: value.type, copyIds, rowId: optionalId('rowId'), ...(value.beforeCopyId !== undefined ? { beforeCopyId: optionalId('beforeCopyId') } : {}) };
    }
    case 'sort': if (!['title', 'author'].includes(String(value.by))) fail(); return { type: value.type, rowId: id('rowId'), by: value.by as 'title' | 'author' };
    case 'undo': return { type: value.type, operationId: id('operationId') };
    default: return fail();
  }
}
export function insertCopies(order: string[], moved: string[], before: string | null = null): string[] {
  const remaining = order.filter((id) => !moved.includes(id));
  const index = before === null ? remaining.length : remaining.indexOf(before);
  if (index < 0) throw new Error('Место вставки изменилось');
  return [...remaining.slice(0, index), ...moved, ...remaining.slice(index)];
}
