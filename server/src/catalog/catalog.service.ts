import { BadRequestException, Injectable } from '@nestjs/common';
import { isbn13, type CatalogEdition, type CatalogSource, type CatalogSearchQuery, type CatalogSearchPage } from '@where-my-books/shared';
import { GoogleBooksProvider, OpenLibraryProvider, type BookMetadataProvider } from './providers.js';

@Injectable()
export class CatalogService {
  private readonly cache = new Map<string, { expires: number; editions: CatalogEdition[] }>();
  private readonly pending = new Map<string, Promise<{ editions: CatalogEdition[]; unavailableSources: CatalogSource[] }>>();
  private readonly searchCache = new Map<string, { expires: number; page: CatalogSearchPage }>();
  private readonly searchPending = new Map<string, Promise<CatalogSearchPage & { unavailableSources: CatalogSource[] }>>();
  private readonly providers: BookMetadataProvider[] = [new GoogleBooksProvider(), new OpenLibraryProvider()];

  async lookup(input: string) {
    const isbn = isbn13(input);
    if (!isbn) throw new BadRequestException('Некорректный ISBN. Проверьте цифры или добавьте книгу вручную.');
    const cached = this.cache.get(isbn);
    if (cached && cached.expires > Date.now()) return { isbn, editions: cached.editions, unavailableSources: [] as CatalogSource[] };
    let operation = this.pending.get(isbn);
    if (!operation) {
      // Small bounded concurrency protects provider quotas; callers can retry.
      if (this.pending.size + this.searchPending.size >= 8) throw new BadRequestException('Каталог занят. Повторите поиск через несколько секунд.');
      operation = this.fetchProviders(isbn).finally(() => this.pending.delete(isbn));
      this.pending.set(isbn, operation);
    }
    return { isbn, ...await operation };
  }

  async search(input: CatalogSearchQuery) {
    if (typeof input.title !== 'string' || typeof input.author !== 'string' || input.title.length > 200 || input.author.length > 200 || !Number.isInteger(input.page) || input.page < 1 || input.page > 20) throw new BadRequestException('Название/автор до 200 символов, страница от 1 до 20');
    const query = { title: input.title.trim().replace(/\s+/g, ' '), author: input.author.trim().replace(/\s+/g, ' '), page: input.page };
    if (query.title.length < 2 && query.author.length < 2) throw new BadRequestException('Введите хотя бы два символа названия или автора');
    const key = JSON.stringify(query);
    const cached = this.searchCache.get(key);
    if (cached && cached.expires > Date.now()) return { ...query, ...cached.page, unavailableSources: [] as CatalogSource[] };
    let operation = this.searchPending.get(key);
    if (!operation) {
      if (this.pending.size + this.searchPending.size >= 8) throw new BadRequestException('Каталог занят. Повторите поиск через несколько секунд.');
      operation = (async () => {
        const results = await Promise.allSettled(this.providers.map((provider) => provider.search(query)));
        const page = { hits: results.flatMap((r) => r.status === 'fulfilled' ? r.value.hits : []), hasMore: query.page < 20 && results.some((r) => r.status === 'fulfilled' && r.value.hasMore) };
        const unavailableSources = results.flatMap((r, i) => r.status === 'rejected' ? [this.providers[i]!.source] : []);
        if (page.hits.length && !unavailableSources.length) {
          if (this.searchCache.size >= 100) this.searchCache.delete(this.searchCache.keys().next().value!);
          this.searchCache.set(key, { expires: Date.now() + 5 * 60_000, page });
        }
        return { ...page, unavailableSources };
      })().finally(() => this.searchPending.delete(key));
      this.searchPending.set(key, operation);
    }
    return { ...query, ...await operation };
  }

  private async fetchProviders(isbn: string) {
    const results = await Promise.allSettled(this.providers.map((p) => p.lookup(isbn)));
    const editions = results.flatMap((r) => r.status === 'fulfilled' ? r.value : []);
    const unavailableSources = results.flatMap((r, i) => r.status === 'rejected' ? [this.providers[i]!.source] : []);
    // Do not cache outages or empty results. Retain only a short metadata cache.
    if (editions.length && !unavailableSources.length) {
      if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(isbn, { editions, expires: Date.now() + 15 * 60_000 });
    }
    return { editions, unavailableSources };
  }
}
