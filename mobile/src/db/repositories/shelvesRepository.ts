import type { Shelf, ShelfSection } from '@where-my-books/shared';
import { getDatabase } from '../database';

export const getShelves = (): Shelf[] => getDatabase().getAllSync<Shelf>('SELECT id, name, room, description FROM shelves ORDER BY name');
export const getShelfSections = (shelfId: string): ShelfSection[] => getDatabase().getAllSync<ShelfSection>('SELECT id, shelf_id as shelfId, name, position FROM shelf_sections WHERE shelf_id = ? ORDER BY position', shelfId);
