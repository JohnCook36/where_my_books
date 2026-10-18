import type { CoverSelection } from '../covers/models.js';
import type { LibraryBook, UserSettings } from '../library/models.js';
import type { ProgressDisplayMode, ReadingStatus } from '../reading/progress.js';

export interface RegisterRequest { email: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface AuthUser { id: string; email: string; createdAt: string }
export interface AuthResponse { user: AuthUser; accessToken: string; refreshToken: string }
export interface RefreshResponse { accessToken: string; refreshToken: string }
export interface CurrentUserResponse { user: AuthUser }

export interface BookMetadataInput extends CoverSelection {
  isbn?: string; publisher?: string; publicationYear?: number; language?: string;
  description?: string; authors?: string[];
  catalogSource?: import('../catalog/models.js').CatalogSource; externalId?: string;
}
export interface CreateBookRequest extends BookMetadataInput {
  title: string; author: string; totalPages: number;
  clientRequestId?: string; editionId?: string;
}
export interface UpdateBookRequest extends BookMetadataInput { title?: string; author?: string; totalPages?: number }
export interface LibraryBookResponse extends LibraryBook {}
export type BookDetailsResponse = LibraryBookResponse;
export interface ListBooksResponse { books: LibraryBookResponse[] }
export type LibrarySearchSort = 'added' | 'updated' | 'title' | 'year';
export interface LibrarySearchFilters {
  query?: string;
  status?: ReadingStatus;
  sort?: LibrarySearchSort;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
export interface SearchBooksResponse {
  books: LibraryBookResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UpdateReadingStatusRequest { status: ReadingStatus }
export interface UpdateReadingProgressRequest { currentPage: number }
export interface UpdateUserSettingsRequest { progressDisplayMode: ProgressDisplayMode }
export interface UserSettingsResponse { settings: UserSettings }
