import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';
import { GoogleBooksProvider, OpenLibraryProvider } from './providers.js';
const reply = (value: unknown) => new Response(JSON.stringify(value));
afterEach(() => vi.unstubAllGlobals());
describe('title and author catalog search', () => {
  it('keeps Open Library works distinct from editions and rejects invalid identifiers', async () => {
    const fetcher = vi.fn().mockResolvedValue(reply({ numFound: 1, docs: [{ key: '/works/OL1W', title: 'Книга', author_name: ['Автор'], isbn: ['0306406152', '9780306406157', '4006381333931'], cover_i: 123 }] })); vi.stubGlobal('fetch', fetcher);
    const result = await new OpenLibraryProvider().search({ title: 'Книга & мир', author: 'Автор', page: 2 });
    expect(result.hits[0]).toMatchObject({ kind: 'work', isbns: ['9780306406157'], title: 'Книга' });
    expect(result.hits[0]?.edition).toBeUndefined(); expect(result.hits[0]).not.toHaveProperty('covers');
    const url = new URL(fetcher.mock.calls[0]![0] as string); expect(url.origin).toBe('https://openlibrary.org'); expect(url.searchParams.get('title')).toBe('Книга & мир'); expect(url.searchParams.get('offset')).toBe('10');
  });
  it('uses only the selected Google volume edition image and preserves volumes without ISBN as text candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ totalItems: 2, items: [{ id: 'exact', volumeInfo: { title: 'Book', industryIdentifiers: [{ identifier: '0306406152' }], imageLinks: { thumbnail: 'https://books.google.com/books/content?id=exact' } } }, { id: 'no-isbn', volumeInfo: { title: 'Rare volume' } }] })));
    const page = await new GoogleBooksProvider().search({ title: 'Book', author: '', page: 1 });
    expect(page.hits[0]?.edition).toMatchObject({ externalId: 'exact', isbn: '9780306406157' }); expect(page.hits[0]?.edition?.covers[0]?.externalId).toBe('exact');
    expect(page.hits[1]?.isbns).toEqual([]); expect(page.hits[1]?.edition).toBeUndefined();
  });
  it('shares in-flight/cache across normalized queries while keeping pagination separate', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(reply(url.includes('googleapis') ? { items: [{ id: 'volume', volumeInfo: { title: 'Book' } }] } : {}))); vi.stubGlobal('fetch', fetcher);
    const service = new CatalogService(); const query = { title: '  A   Book  ', author: '', page: 1 };
    await Promise.all([service.search(query), service.search({ ...query, title: 'A Book' })]); await service.search(query); expect(fetcher).toHaveBeenCalledTimes(2);
    await service.search({ ...query, page: 2 }); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('does not cache provider outages or hide fallback results', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => url.includes('googleapis') ? Promise.reject(new Error('429')) : Promise.resolve(reply({ docs: [{ key: '/works/OL1W', title: 'Fallback' }] }))); vi.stubGlobal('fetch', fetcher);
    const service = new CatalogService(); const query = { title: 'Book', author: '', page: 1 }; const result = await service.search(query);
    expect(result.unavailableSources).toEqual(['google_books']); expect(result.hits[0]?.kind).toBe('work'); await service.search(query); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([{ title: '', author: '', page: 1 }, { title: 'B', author: '', page: 1 }, { title: 'Book', author: '', page: 0 }, { title: 'Book', author: '', page: 21 }, { title: 'Book', author: '', page: 1.1 }, { title: 'x'.repeat(201), author: '', page: 1 }])('validates before accessing providers', async (query) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); await expect(new CatalogService().search(query)).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('never caches account-specific library matches with provider metadata', async () => {
    const hit = { source: 'open_library', externalId: '/works/OL1W', kind: 'work', title: 'Book', authors: [], isbns: ['9780306406157'] };
    const catalog = { search: vi.fn().mockResolvedValue({ title: 'Book', author: '', page: 1, hits: [hit], hasMore: false, unavailableSources: [] }) };
    const prisma = { bookCopy: { findMany: vi.fn().mockResolvedValueOnce([{ id: 'a-copy', edition: { isbn: '9780306406157', work: { title: 'A private title' } } }]).mockResolvedValueOnce([]) } };
    const controller = new CatalogController(catalog as never, prisma as never, {} as never);
    const a = await controller.search({ sub: 'a' } as never, 'Book', '', '1'); const b = await controller.search({ sub: 'b' } as never, 'Book', '', '1');
    expect(a.hits[0]?.existingCopies[0]?.id).toBe('a-copy'); expect(b.hits[0]?.existingCopies).toEqual([]);
    expect(prisma.bookCopy.findMany.mock.calls[1]?.[0]).toMatchObject({ where: { userId: 'b' } }); expect(hit).not.toHaveProperty('existingCopies');
  });
});
