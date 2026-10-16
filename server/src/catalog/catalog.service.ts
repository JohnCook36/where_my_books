import { BadRequestException, Injectable } from '@nestjs/common';
import { isbn13, type CatalogEdition, type CatalogSource } from '@where-my-books/shared';
import { GoogleBooksProvider, OpenLibraryProvider, type BookMetadataProvider } from './providers.js';

@Injectable()
export class CatalogService {
  private readonly cache = new Map<string, { expires: number; editions: CatalogEdition[] }>();
  private readonly pending = new Map<string, Promise<{ editions: CatalogEdition[]; unavailableSources: CatalogSource[] }>>();
  private readonly providers: BookMetadataProvider[] = [new GoogleBooksProvider(), new OpenLibraryProvider()];

  async lookup(input: string) {
    const isbn = isbn13(input);
    if (!isbn) throw new BadRequestException('Некорректный ISBN. Проверьте цифры или добавьте книгу вручную.');
    const cached = this.cache.get(isbn);
    if (cached && cached.expires > Date.now()) return { isbn, editions: cached.editions, unavailableSources: [] as CatalogSource[] };
    let operation = this.pending.get(isbn);
    if (!operation) {
      // Small bounded concurrency protects provider quotas; callers can retry.
      if (this.pending.size >= 8) throw new BadRequestException('Каталог занят. Повторите поиск через несколько секунд.');
      operation = this.fetchProviders(isbn).finally(() => this.pending.delete(isbn));
      this.pending.set(isbn, operation);
    }
    return { isbn, ...await operation };
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
