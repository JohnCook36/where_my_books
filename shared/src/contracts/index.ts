import type { LibraryBook, UserSettings } from '../library/models.js';
import type { ProgressDisplayMode, ReadingStatus } from '../reading/progress.js';

export interface RegisterRequest { email: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface AuthUser { id: string; email: string; createdAt: string }
export interface AuthResponse { user: AuthUser; accessToken: string; refreshToken: string }
export interface RefreshResponse { accessToken: string; refreshToken: string }
export interface CurrentUserResponse { user: AuthUser }

export interface CreateBookRequest { title: string; author: string; totalPages: number }
export interface UpdateBookRequest { title?: string; author?: string; totalPages?: number }
export interface LibraryBookResponse extends LibraryBook {}
export type BookDetailsResponse = LibraryBookResponse;
export interface ListBooksResponse { books: LibraryBookResponse[] }

export interface UpdateReadingStatusRequest { status: ReadingStatus }
export interface UpdateReadingProgressRequest { currentPage: number }
export interface UpdateUserSettingsRequest { progressDisplayMode: ProgressDisplayMode }
export interface UserSettingsResponse { settings: UserSettings }
