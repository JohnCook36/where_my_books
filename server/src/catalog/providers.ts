import type { CatalogEdition, CatalogSource, CatalogSearchQuery, CatalogSearchPage } from '@where-my-books/shared';
import { isbn13 } from '@where-my-books/shared';

export interface BookMetadataProvider { readonly source: CatalogSource; lookup(isbn: string): Promise<CatalogEdition[]>; search(query: CatalogSearchQuery): Promise<CatalogSearchPage> }
const text = (v: unknown, max = 500): string | undefined => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
const positive = (v: unknown): number | undefined => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 100000 ? v : undefined;
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const year = (v: unknown) => { const match = text(v)?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/); return match ? Number(match[1]) : undefined; };

// No arbitrary URL fetching, redirects or image proxy. Provider hosts are constants.
async function json(url: string, timeoutMs = 6000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'WhereMyBook/0.1 (https://github.com/JohnCook36/where_my_books)' } });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Catalog response too large');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response');
  let size = 0;
  const decoder = new TextDecoder(); let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 2_000_000) throw new Error('Catalog response too large');
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { await reader.cancel(); }
}

export function catalogCoverUri(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    url.protocol = 'https:';
    if (url.username || url.password || url.port) return undefined;
    if (!['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org'].includes(url.hostname)) return undefined;
    return url.toString();
  } catch { return undefined; }
}

export class GoogleBooksProvider implements BookMetadataProvider {
  readonly source = 'google_books' as const;
  async lookup(isbn: string): Promise<CatalogEdition[]> {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const data = object(await json(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=10${key ? `&key=${encodeURIComponent(key)}` : ''}`));
    return array(data.items).slice(0, 10).flatMap((raw) => this.editions(raw, isbn));
  }
  async search(query: CatalogSearchQuery): Promise<CatalogSearchPage> {
    const key = process.env.GOOGLE_BOOKS_API_KEY;
    const literal = (value: string) => value.replace(/["\\]/g, ' ');
    const q = [query.title ? `intitle:"${literal(query.title)}"` : '', query.author ? `inauthor:"${literal(query.author)}"` : ''].filter(Boolean).join(' ');
    const data = object(await json(`https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, maxResults: '10', startIndex: String((query.page - 1) * 10), printType: 'books', ...(key ? { key } : {}) })}`));
    const items = array(data.items).slice(0, 10);
    return { hits: items.flatMap((raw) => {
      const item = object(raw), info = object(item.volumeInfo);
      const isbns = [...new Set(array(info.industryIdentifiers).slice(0, 12).flatMap((id) => isbn13(String(object(id).identifier ?? '')) ?? []))];
      const title = text(info.title), externalId = text(item.id, 200);
      if (!title || !externalId) return [];
      const edition = isbns[0] ? this.editions(raw, isbns[0])[0] : undefined;
      return [{ source: this.source, externalId, kind: 'edition' as const, title, authors: array(info.authors).slice(0, 30).flatMap((a) => text(a) ?? []), isbns, ...(edition ? { edition } : {}) }];
    }), hasMore: items.length === 10 && typeof data.totalItems === 'number' && data.totalItems > query.page * 10 };
  }
  private editions(raw: unknown, isbn: string): CatalogEdition[] {
    const item = object(raw), info = object(item.volumeInfo);
    const matches = array(info.industryIdentifiers).some((id) => isbn13(String(object(id).identifier ?? '')) === isbn);
    const title = text(info.title), externalId = text(item.id, 200);
    if (!matches || !title || !externalId) return [];
    const images = object(info.imageLinks);
    const uri = catalogCoverUri(images.thumbnail ?? images.smallThumbnail);
    return [{ source: this.source, externalId, isbn, title, authors: array(info.authors).slice(0, 30).flatMap((a) => text(a) ?? []), pageCount: positive(info.pageCount), publisher: text(info.publisher), publicationYear: year(info.publishedDate), description: text(info.description, 10000), language: text(info.language, 30), covers: uri ? [{ uri, source: this.source, externalId }] : [] }];
  }
}

export class OpenLibraryProvider implements BookMetadataProvider {
  readonly source = 'open_library' as const;
  async search(query: CatalogSearchQuery): Promise<CatalogSearchPage> {
    const params = new URLSearchParams({ ...(query.title ? { title: query.title } : {}), ...(query.author ? { author: query.author } : {}), fields: 'key,title,author_name,isbn', limit: '10', offset: String((query.page - 1) * 10) });
    const data = object(await json(`https://openlibrary.org/search.json?${params}`, 10_000));
    const docs = array(data.docs).slice(0, 10);
    return { hits: docs.flatMap((raw) => {
      const info = object(raw), title = text(info.title), externalId = text(info.key, 200);
      if (!title || !externalId || !/^\/works\/OL[0-9]+W$/.test(externalId)) return [];
      return [{ source: this.source, externalId, kind: 'work' as const, title, authors: array(info.author_name).slice(0, 30).flatMap((a) => text(a) ?? []), isbns: [...new Set(array(info.isbn).flatMap((value) => isbn13(String(value)) ?? []))].slice(0, 12) }];
    }), hasMore: docs.length === 10 && typeof data.numFound === 'number' && data.numFound > query.page * 10 };
  }
  async lookup(isbn: string): Promise<CatalogEdition[]> {
    const data = object(await json(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`));
    const info = object(data[`ISBN:${isbn}`]); const title = text(info.title);
    if (!title) return [];
    const uri = catalogCoverUri(object(info.cover).large ?? object(info.cover).medium);
    const externalId = text(info.key) ?? `ISBN:${isbn}`;
    return [{ source: this.source, externalId, isbn, title, authors: array(info.authors).flatMap((a) => text(object(a).name) ?? []), pageCount: positive(info.number_of_pages), publisher: text(object(array(info.publishers)[0]).name), publicationYear: year(info.publish_date), covers: uri ? [{ uri, source: this.source, externalId }] : [] }];
  }
}
