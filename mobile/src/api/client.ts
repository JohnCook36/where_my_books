import type { AuthResponse, RefreshResponse } from '@where-my-books/shared';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000/api';
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokenStore = {
  get refresh() { return refreshToken; },
  set(tokens: { accessToken: string; refreshToken: string }) { accessToken = tokens.accessToken; refreshToken = tokens.refreshToken; },
  clear() { accessToken = null; refreshToken = null; },
};

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && refreshToken) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
    if (refreshed.ok) {
      const tokens = await refreshed.json() as RefreshResponse;
      tokenStore.set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      return request<T>(path, init, false);
    }
    tokenStore.clear();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export const api = {
  register: (body: { email: string; password: string }) => request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request<{ user: { id: string; email: string; createdAt: string } }>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  books: () => request<{ books: import('@where-my-books/shared').LibraryBookResponse[] }>('/books'),
  book: (id: string) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}`),
  addBook: (body: { title: string; author: string; totalPages: number }) => request<import('@where-my-books/shared').BookDetailsResponse>('/books', { method: 'POST', body: JSON.stringify(body) }),
  updateStatus: (id: string, status: import('@where-my-books/shared').ReadingStatus) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateProgress: (id: string, currentPage: number) => request<import('@where-my-books/shared').BookDetailsResponse>(`/books/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ currentPage }) }),
  deleteBook: (id: string) => request<void>(`/books/${id}`, { method: 'DELETE' }),
};
