export const schema = [
  `CREATE TABLE IF NOT EXISTS authors (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, original_title TEXT, description TEXT)`,
  `CREATE TABLE IF NOT EXISTS work_authors (work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE, PRIMARY KEY (work_id, author_id))`,
  `CREATE TABLE IF NOT EXISTS editions (id TEXT PRIMARY KEY NOT NULL, work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE, isbn TEXT, publisher TEXT, publication_year INTEGER, page_count INTEGER NOT NULL CHECK (page_count > 0), cover_uri TEXT, language TEXT)`,
  `CREATE TABLE IF NOT EXISTS book_copies (id TEXT PRIMARY KEY NOT NULL, edition_id TEXT NOT NULL REFERENCES editions(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK (status IN ('want_to_read', 'reading', 'finished', 'dnf')), current_page INTEGER NOT NULL DEFAULT 0 CHECK (current_page >= 0), spine_color TEXT NOT NULL, spine_width REAL NOT NULL, spine_height REAL NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shelves (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, room TEXT, description TEXT)`,
  `CREATE TABLE IF NOT EXISTS shelf_sections (id TEXT PRIMARY KEY NOT NULL, shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shelf_placements (copy_id TEXT PRIMARY KEY NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE, shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE, section_id TEXT NOT NULL REFERENCES shelf_sections(id) ON DELETE CASCADE, position INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS idx_editions_work_id ON editions(work_id)',
  'CREATE INDEX IF NOT EXISTS idx_book_copies_edition_id ON book_copies(edition_id)',
  'CREATE INDEX IF NOT EXISTS idx_shelf_sections_shelf_id ON shelf_sections(shelf_id)',
] as const;
