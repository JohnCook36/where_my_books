import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogCoverUri, GoogleBooksProvider, OpenLibraryProvider } from './providers.js';
import { CatalogService } from './catalog.service.js';
const isbn = '9780306406157';
const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());
describe('catalog normalization and trust boundaries', () => {
  it('filters Google editions with a different ISBN and normalizes missing data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ items: [
      { id: 'wrong', volumeInfo: { title: 'Wrong edition', industryIdentifiers: [{ identifier: '9780140328721' }] } },
      { id: 'right', volumeInfo: { title: 'Correct edition', authors: ['Author'], industryIdentifiers: [{ identifier: '0306406152' }], imageLinks: { thumbnail: 'http://books.google.com/books/content?id=right' } } },
    ] })));
    const result = await new GoogleBooksProvider().lookup(isbn);
    expect(result).toHaveLength(1); expect(result[0]?.externalId).toBe('right');
    expect(result[0]?.pageCount).toBeUndefined(); expect(result[0]?.covers[0]?.uri).toMatch(/^https:/);
  });
  it('accepts Open Library data for the requested ISBN without inventing pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ [`ISBN:${isbn}`]: { title: 'Book', key: '/books/OL1M', authors: [{ name: 'A' }], cover: { large: 'https://covers.openlibrary.org/b/id/1-L.jpg' } } })));
    const [result] = await new OpenLibraryProvider().lookup(isbn);
    expect(result?.externalId).toBe('/books/OL1M'); expect(result?.authors).toEqual(['A']); expect(result?.pageCount).toBeUndefined();
  });
  it('keeps fallback available during one provider outage and does not cache outage', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => url.includes('googleapis') ? Promise.reject(new Error('timeout')) : Promise.resolve(reply({ [`ISBN:${isbn}`]: { title: 'Fallback' } })));
    vi.stubGlobal('fetch', fetcher);
    const service = new CatalogService(); const result = await service.lookup(isbn);
    expect(result.unavailableSources).toEqual(['google_books']); expect(result.editions[0]?.title).toBe('Fallback');
    await service.lookup(isbn); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('coalesces simultaneous requests and caches only successful results', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(reply(url.includes('googleapis') ? {} : { [`ISBN:${isbn}`]: { title: 'Cached' } })));
    vi.stubGlobal('fetch', fetcher); const service = new CatalogService();
    await Promise.all([service.lookup(isbn), service.lookup(isbn)]); await service.lookup(isbn);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['http://127.0.0.1/image', 'https://evil.test/a', 'file:///etc/passwd', 'https://books.google.com@evil.test/a', 'https://books.google.com:444/a'])('rejects untrusted cover %s', (uri) => expect(catalogCoverUri(uri)).toBeUndefined());
  it('rejects invalid ISBN before a provider request', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(new CatalogService().lookup('4006381333931')).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
});
