import type { Shelf, ShelfSection, ShelfPlacement, SyncFields } from '../library/models.js';
export type ShelfTheme = 'oak' | 'ivory' | 'night';
export interface StorageRoom extends SyncFields { name: string }
export interface ShelfRow extends SyncFields { sectionId: string; name: string; capacity: number; position: number }
export interface ShelfLayout {
  revision: number; rooms: StorageRoom[];
  shelves: (Shelf & { roomId: string; theme: ShelfTheme })[];
  sections: ShelfSection[]; rows: ShelfRow[]; placements: (ShelfPlacement & { rowId: string })[];
}
export type StorageKind = 'room' | 'shelf' | 'section' | 'row';
export type ShelfAction =
  | { type: 'create_room'; id: string; name: string }
  | { type: 'create_shelf'; id: string; roomId: string; name: string; theme: ShelfTheme; sections: number; rows: number; capacity: number }
  | { type: 'create_section'; id: string; shelfId: string; name: string }
  | { type: 'create_row'; id: string; sectionId: string; name: string; capacity: number }
  | { type: 'rename'; kind: StorageKind; id: string; name: string }
  | { type: 'delete'; kind: StorageKind; id: string; destinationRowId?: string | null }
  | { type: 'move'; copyIds: string[]; rowId: string | null; beforeCopyId?: string | null }
  | { type: 'sort'; rowId: string; by: 'title' | 'author' }
  | { type: 'undo'; operationId: string };
export interface ShelfMutation { requestId: string; baseRevision: number; action: ShelfAction }
export interface ShelfMutationResponse { revision: number; operationId: string; canUndo: boolean }
export interface PhysicalLocation { roomId: string; shelfId: string; sectionId: string; rowId: string; position: number; path: string }
