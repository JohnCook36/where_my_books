import type { AuthResponse, RefreshResponse, CatalogLookupResponse, ScanDraft, CreateBookRequest, UpdateBookRequest, UpdateScanDraftRequest, ConfirmScanDraftItem, ConfirmScanDraftsResponse, CoverAssetResponse, UserCoverSource, CatalogSearchQuery, CatalogSearchResponse } from '@where-my-books/shared';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api';
let accessToken: string | null = null;
let refreshToken: string | null = null;
const SESSION_KEY = 'where-my-books.session';

export const tokenStore = {
  get refresh() { return refreshToken; },
  async hydrate() {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return false;
    try {
      const tokens = JSON.parse(raw) as { accessToken: string; refreshToken: string };
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      return true;
    } catch {
      await this.clear();
      return false;
    }
  },
  async set(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(tokens));
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

let refreshInFlight: Promise<boolean> | null = null;
async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  const previous = refreshToken;
  if (!previous) return false;
  refreshInFlight = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: previous }) });
    if (refreshToken !== previous) return !!accessToken;
    if (!response.ok) { await tokenStore.clear(); return false; }
    const tokens = await response.json() as RefreshResponse;
    if (refreshToken !== previous) return !!accessToken;
    await tokenStore.set(tokens); return true;
  })();
  try { return await refreshInFlight; } finally { refreshInFlight = null; }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const sentToken = accessToken;
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && refreshToken) {
    if ((accessToken && accessToken !== sentToken) || await refreshSession()) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiError(Array.isArray(body?.message) ? body.message.join('; ') : body?.message ?? `Request failed (${response.status})`, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export const api = {
  async uploadCover(uri: string, source: UserCoverSource) {
    const form = new FormData(); form.append('source', source);
    if (Platform.OS === 'web') form.append('file', await (await fetch(uri)).blob(), 'cover.jpg');
    else form.append('file', { uri, name: 'cover.jpg', type: 'image/jpeg' } as unknown as Blob);
    return request<CoverAssetResponse>('/covers', { method: 'POST', body: form });
  },
  async coverImageSource(id: string) {
    await request<CoverAssetResponse>(`/covers/${encodeURIComponent(id)}`);
    const uri = `${API_URL}/covers/${encodeURIComponent(id)}/image`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (Platform.OS === 'web') {
      const image = await fetch(uri, { headers, cache: 'no-store' });
      if (!image.ok) throw new ApiError('Не удалось загрузить обложку', image.status);
      return { uri: URL.createObjectURL(await image.blob()) };
    }
    return { uri, headers };
  },
  register: (body: { email: string; password: string }) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<{ user: { id: string; email: string; createdAt: string } }>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  catalogSearch: (query: CatalogSearchQuery, signal?: AbortSignal) => request<CatalogSearchResponse>(`/catalog/search?${new URLSearchParams({ title: query.title, author: query.author, page: String(query.page) })}`, signal ? { signal } : {}),
  catalog: (isbn: string, signal?: AbortSignal) => request<CatalogLookupResponse>(`/catalog?isbn=${encodeURIComponent(isbn)}`, signal ? { signal } : {}),
  scanDrafts: () => request<{ drafts: ScanDraft[] }>('/scan-drafts'),
  scanDraft: (id: string) => request<ScanDraft>(`/scan-drafts/${id}`),
  updateScanDraft: (id: string, body: UpdateScanDraftRequest) => request<ScanDraft>(`/scan-drafts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  confirmScanDrafts: (items: ConfirmScanDraftItem[]) => request<ConfirmScanDraftsResponse>('/scan-drafts/confirm', { method: 'POST', body: JSON.stringify({ items }) }),
  addScanDraft: (isbn: string) => request<ScanDraft>('/scan-drafts', { method: 'POST', body: JSON.stringify({ isbn }) }),
  removeScanDraft: (id: string) => request<void>(`/scan-drafts/${id}`, { method: 'DELETE' }),
  shelfLayout: () => request<import('@where-my-books/shared').ShelfLayout>('/shelves/layout'),
  mutateShelf: (body: import('@where-my-books/shared').ShelfMutation) => request<import('@where-my-books/shared').ShelfMutationResponse>('/shelves/layout', { method: 'POST', body: JSON.stringify(body) }),
  books: () => request<{ books: import('@where-my-books/shared').LibraryBookResponse[] }>('/books'),
  searchBooks: (filters: import('@where-my-books/shared').LibrarySearchFilters) => {
    const params = new URLSearchParams();
    if (filters.query) params.set('query', filters.query);
    if (filters.status) params.set('status', filters.status);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.order) params.set('order', filters.order);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    return request<import('@where-my-books/shared').SearchBooksResponse>(`/books/search?${params.toString()}`);
  },
  book: (id: string) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}`),
  addBook: (body: CreateBookRequest) => request<import('@where-my-books/shared').BookDetailsResponse>('/books', { method: 'POST', body: JSON.stringify(body) }),
  updateStatus: (id: string, status: import('@where-my-books/shared').ReadingStatus) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateProgress: (id: string, currentPage: number) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ currentPage }) }),
  updateBook: (id: string, body: UpdateBookRequest) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteBook: (id: string) => request<void>(`/books/${id}`, { method: 'DELETE' }),
  settings: () => request<import('@where-my-books/shared').UserSettingsResponse>('/settings'),
  updateSettings: (progressDisplayMode: import('@where-my-books/shared').ProgressDisplayMode) => request<import('@where-my-books/shared').UserSettingsResponse>('/settings', { method: 'PATCH', body: JSON.stringify({ progressDisplayMode }) }),
};
