import type { LibraryBookResponse, LibrarySearchFilters, SearchBooksResponse } from '@where-my-books/shared';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

interface SavedSnapshot {
  version: 1;
  ownerId: string;
  savedAt: string;
  books: LibraryBookResponse[];
}

const ownerPattern = /^[0-9a-f-]{36}$/i;
const fileFor = (ownerId: string) => {
  if (!ownerPattern.test(ownerId)) throw new Error('Invalid account identity');
  return new File(Paths.document, 'library-' + ownerId + '.json');
};

/**
 * This is a read-only app-sandbox snapshot, NOT encrypted storage or an outbox.
 * Do not persist auth tokens, photos or notes here.
 * On web the offline snapshot is disabled until an encrypted browser cache exists.
 */
export const librarySnapshot = {
  async save(ownerId: string, books: LibraryBookResponse[]): Promise<void> {
    if (Platform.OS === 'web') return;
    const file = fileFor(ownerId);
    const snapshot: SavedSnapshot = { version: 1, ownerId, savedAt: new Date().toISOString(), books };
    const tmp = new File(Paths.document, 'library-' + ownerId + '.tmp');
    tmp.write(JSON.stringify(snapshot));
    if (file.exists) file.delete();
    tmp.move(file);
  },
  async read(ownerId: string): Promise<SavedSnapshot | null> {
    if (Platform.OS === 'web') return null;
    const file = fileFor(ownerId);
    if (!file.exists) return null;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object') return null;
      const entry = parsed as Partial<SavedSnapshot>;
      if (entry.version !== 1 || entry.ownerId !== ownerId || !Array.isArray(entry.books) || typeof entry.savedAt !== 'string') return null;
      return entry as SavedSnapshot;
    } catch { return null; }
  },
  async clear(ownerId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const file = fileFor(ownerId);
    if (file.exists) file.delete();
    const tmp = new File(Paths.document, 'library-' + ownerId + '.tmp');
    if (tmp.exists) tmp.delete();
  },
};

export const filterCachedBooks = (books: LibraryBookResponse[], filters: LibrarySearchFilters): SearchBooksResponse => {
  const q = filters.query?.trim().toLocaleLowerCase() ?? '';
  const matching = books.filter((book) => {
    if (filters.status && book.status !== filters.status) return false;
    if (!q) return true;
    return [book.work.title, ...book.work.authors.map((author) => author.name),
      book.edition.isbn ?? '', book.edition.publisher ?? '']
      .some((candidate) => candidate.toLocaleLowerCase().includes(q));
  });
  const sort = filters.sort ?? 'added';
  const direction = filters.order === 'asc' ? 1 : -1;
  matching.sort((a, b) => {
    const compare = sort === 'title'
      ? a.work.title.localeCompare(b.work.title)
      : sort === 'year'
        ? (a.edition.publicationYear ?? 0) - (b.edition.publicationYear ?? 0)
        : sort === 'updated'
          ? Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
          : Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return direction * compare || a.id.localeCompare(b.id);
  });
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  return { books: matching.slice((page - 1) * limit, page * limit), total: matching.length, page, limit, hasMore: page * limit < matching.length };
};
