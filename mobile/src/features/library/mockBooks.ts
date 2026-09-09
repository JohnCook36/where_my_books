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

export const initialBooks: LibraryBookPreview[] = [
  { id: 'dune', title: 'DUNE', author: 'Frank Herbert', currentPage: 220, totalPages: 604, status: 'reading', spineColor: '#8A5A3B', spineWidth: 62, spineHeight: 182 },
  { id: '1984', title: '1984', author: 'George Orwell', currentPage: 328, totalPages: 328, status: 'finished', spineColor: '#5B2932', spineWidth: 48, spineHeight: 166 },
  { id: 'master', title: 'МАСТЕР И МАРГАРИТА', author: 'Михаил Булгаков', currentPage: 176, totalPages: 480, status: 'reading', spineColor: '#29493C', spineWidth: 70, spineHeight: 190 },
  { id: 'lotr', title: 'LOTR', author: 'J. R. R. Tolkien', currentPage: 0, totalPages: 1178, status: 'want_to_read', spineColor: '#3D4D62', spineWidth: 76, spineHeight: 198 },
  { id: 'it', title: 'IT', author: 'Stephen King', currentPage: 744, totalPages: 1138, status: 'reading', spineColor: '#6D362A', spineWidth: 82, spineHeight: 202 },
];
