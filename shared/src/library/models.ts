import type { ProgressDisplayMode, ReadingProgress, ReadingStatus } from '../reading/progress.js';

export type EntityId = string;

export interface SyncFields {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface Author extends SyncFields { name: string }
export interface BookWork extends SyncFields { title: string; originalTitle?: string; description?: string; authors: Author[] }
export interface Edition extends SyncFields { workId: EntityId; isbn?: string; publisher?: string; publicationYear?: number; pageCount: number; coverUri?: string; language?: string }
export interface BookCopy extends SyncFields { editionId: EntityId; status: ReadingStatus; progress: ReadingProgress; spineColor: string; spineWidth: number; spineHeight: number }
export interface LibraryBook extends BookCopy { edition: Edition; work: BookWork }
export interface Shelf extends SyncFields { name: string; room?: string; description?: string }
export interface ShelfSection extends SyncFields { shelfId: EntityId; name: string; position: number }
export interface ShelfPlacement extends SyncFields { copyId: EntityId; shelfId: EntityId; sectionId: EntityId; position: number }
export interface UserSettings extends SyncFields { userId: EntityId; progressDisplayMode: ProgressDisplayMode }
