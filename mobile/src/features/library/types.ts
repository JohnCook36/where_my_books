import type { ReadingStatus } from '@where-my-books/shared';

export interface LibraryBookPreview {
  id: string;
  title: string;
  author: string;
  currentPage: number;
  totalPages: number;
  status: ReadingStatus;
  spineColor: string;
  spineWidth: number;
  spineHeight: number;
}
