import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { BooksService } from '../books/books.service.js';
import type { SyncBootstrapResponse, SyncChangesResponse } from '@where-my-books/shared';

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService, private readonly books: BooksService) {}

  async bootstrap(userId: string): Promise<SyncBootstrapResponse> {
    // Capture the cursor before reading the books. Concurrent changes made
    // during the snapshot will therefore be replayed on the next delta pull.
    const current = await this.prisma.syncCursor.findUnique({ where: { userId } });
    const books = await this.books.list(userId);
    return { cursor: String(current?.revision ?? 0n), books: books.books };
  }

  async changes(userId: string, after: string): Promise<SyncChangesResponse> {
    if (!/^(0|[1-9]\d{0,17})$/.test(after)) throw new BadRequestException('Invalid sync cursor');
    const previous = BigInt(after);
    const current = await this.prisma.syncCursor.findUnique({ where: { userId } });
    const highest = current?.revision ?? 0n;
    if (previous > highest) throw new BadRequestException('Sync cursor is ahead of server');
    const events = await this.prisma.syncEvent.findMany({
      where: { userId, revision: { gt: previous, lte: highest } },
      orderBy: { revision: 'asc' },
      take: 101,
      select: { revision: true, copyId: true, action: true },
    });
    const page = events.slice(0, 100);
    return {
      cursor: String(page.at(-1)?.revision ?? previous),
      serverCursor: String(highest),
      hasMore: events.length > 100,
      changes: page.map((event) => ({ revision: String(event.revision), copyId: event.copyId, action: event.action === 'delete' ? 'delete' as const : 'upsert' as const })),
    };
  }
}
