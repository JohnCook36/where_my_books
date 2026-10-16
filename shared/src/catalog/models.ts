export type CatalogSource = 'google_books' | 'open_library';
export interface CoverCandidate { uri: string; source: CatalogSource; externalId: string }
export interface CatalogEdition {
  source: CatalogSource;
  externalId: string;
  isbn: string;
  title: string;
  authors: string[];
  pageCount?: number | undefined;
  publisher?: string | undefined;
  publicationYear?: number | undefined;
  description?: string | undefined;
  language?: string | undefined;
  covers: CoverCandidate[];
}
export interface CatalogLookupResponse {
  isbn: string;
  editions: CatalogEdition[];
  unavailableSources: CatalogSource[];
  existingCopies: { id: string; title: string }[];
}
export interface ScanDraft { id: string; isbn: string; createdAt: string }
