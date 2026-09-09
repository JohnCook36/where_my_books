import type { LibraryBook } from '@where-my-books/shared';
import { getDatabase } from '../database';

type BookRow = { copy_id: string; edition_id: string; status: LibraryBook['status']; current_page: number; spine_color: string; spine_width: number; spine_height: number; work_id: string; title: string; original_title: string | null; description: string | null; page_count: number; isbn: string | null; publisher: string | null; publication_year: number | null; cover_uri: string | null; language: string | null; author_id: string; author_name: string };

const mapRow = (row: BookRow): LibraryBook => ({
  id: row.copy_id,
  editionId: row.edition_id,
  status: row.status,
  progress: { currentPage: row.current_page, totalPages: row.page_count },
  spineColor: row.spine_color,
  spineWidth: row.spine_width,
  spineHeight: row.spine_height,
  work: { id: row.work_id, title: row.title, ...(row.original_title ? { originalTitle: row.original_title } : {}), ...(row.description ? { description: row.description } : {}), authors: [{ id: row.author_id, name: row.author_name }] },
  edition: { id: row.edition_id, workId: row.work_id, pageCount: row.page_count, ...(row.isbn ? { isbn: row.isbn } : {}), ...(row.publisher ? { publisher: row.publisher } : {}), ...(row.publication_year ? { publicationYear: row.publication_year } : {}), ...(row.cover_uri ? { coverUri: row.cover_uri } : {}), ...(row.language ? { language: row.language } : {}) },
});

const query = `SELECT c.id as copy_id, c.edition_id, c.status, c.current_page, c.spine_color, c.spine_width, c.spine_height, e.work_id, e.page_count, e.isbn, e.publisher, e.publication_year, e.cover_uri, e.language, w.title, w.original_title, w.description, a.id as author_id, a.name as author_name FROM book_copies c JOIN editions e ON e.id = c.edition_id JOIN works w ON w.id = e.work_id JOIN work_authors wa ON wa.work_id = w.id JOIN authors a ON a.id = wa.author_id ORDER BY c.id`;

export const getBooks = (): LibraryBook[] => getDatabase().getAllSync<BookRow>(query).map(mapRow);
export const getBookById = (id: string): LibraryBook | null => { const row = getDatabase().getFirstSync<BookRow>(query.replace(' ORDER BY c.id', ' WHERE c.id = ?'), id); return row ? mapRow(row) : null; };
export const updateReadingProgress = (id: string, currentPage: number) => getDatabase().runSync('UPDATE book_copies SET current_page = ? WHERE id = ?', currentPage, id);
