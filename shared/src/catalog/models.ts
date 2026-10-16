import type { BookMetadataInput } from '../contracts/index.js';
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
/** A review snapshot, not a library copy or an offline source of truth. */
export interface ScanDraftPayload extends Omit<BookMetadataInput, 'isbn'> {
  title?: string; author?: string; totalPages?: number;
}
export interface ScanDraft {
  id: string; isbn: string; createdAt: string; updatedAt: string;
  revision: number; reviewed: boolean; payload: ScanDraftPayload | null;
}
export interface UpdateScanDraftRequest { baseRevision: number; reviewed: boolean; payload: ScanDraftPayload }
export interface ConfirmScanDraftItem { id: string; revision: number }
export type ScanConfirmationResult =
  | { id: string; status: 'saved'; copyId: string }
  | { id: string; status: 'invalid' | 'conflict' | 'not_found' | 'failed'; message: string };
export interface ConfirmScanDraftsResponse { results: ScanConfirmationResult[] }
