import type { SQLiteDatabase } from 'expo-sqlite';

const books = [
  ['dune', 'DUNE', 'Frank Herbert', '220', '604', 'reading', '#8A5A3B', '62', '182'],
  ['1984', '1984', 'George Orwell', '328', '328', 'finished', '#5B2932', '48', '166'],
  ['master', 'МАСТЕР И МАРГАРИТА', 'Михаил Булгаков', '176', '480', 'reading', '#29493C', '70', '190'],
  ['lotr', 'LOTR', 'J. R. R. Tolkien', '0', '1178', 'want_to_read', '#3D4D62', '76', '198'],
  ['it', 'IT', 'Stephen King', '744', '1138', 'reading', '#6D362A', '82', '202'],
] as const;

export const seedDevelopmentData = (database: SQLiteDatabase) => {
  const existing = database.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM book_copies')?.count ?? 0;
  if (existing > 0) return;
  database.withTransactionSync(() => {
    for (const [id, title, authorName, currentPage, pageCount, status, color, width, height] of books) {
      const authorId = `author-${id}`;
      const workId = `work-${id}`;
      const editionId = `edition-${id}`;
      database.runSync('INSERT INTO authors (id, name) VALUES (?, ?)', authorId, authorName);
      database.runSync('INSERT INTO works (id, title) VALUES (?, ?)', workId, title);
      database.runSync('INSERT INTO work_authors (work_id, author_id) VALUES (?, ?)', workId, authorId);
      database.runSync('INSERT INTO editions (id, work_id, page_count) VALUES (?, ?, ?)', editionId, workId, Number(pageCount));
      database.runSync('INSERT INTO book_copies (id, edition_id, status, current_page, spine_color, spine_width, spine_height) VALUES (?, ?, ?, ?, ?, ?, ?)', id, editionId, status, Number(currentPage), color, Number(width), Number(height));
    }
    database.runSync('INSERT INTO settings (key, value) VALUES (?, ?)', 'progressDisplayMode', 'pages');
  });
};
