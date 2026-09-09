import type { ProgressDisplayMode, ReadingProgress, ReadingStatus } from '../reading/progress';

export type EntityId = string;

export interface Author { id: EntityId; name: string }
export interface BookWork { id: EntityId; title: string; originalTitle?: string; description?: string; authors: Author[] }
export interface Edition { id: EntityId; workId: EntityId; isbn?: string; publisher?: string; publicationYear?: number; pageCount: number; coverUri?: string; language?: string }
export interface BookCopy { id: EntityId; editionId: EntityId; status: ReadingStatus; progress: ReadingProgress; spineColor: string; spineWidth: number; spineHeight: number }
export interface LibraryBook extends BookCopy { edition: Edition; work: BookWork }
export interface Shelf { id: EntityId; name: string; room?: string; description?: string }
export interface ShelfSection { id: EntityId; shelfId: EntityId; name: string; position: number }
export interface ShelfPlacement { copyId: EntityId; shelfId: EntityId; sectionId: EntityId; position: number }
export interface UserSettings { progressDisplayMode: ProgressDisplayMode }
