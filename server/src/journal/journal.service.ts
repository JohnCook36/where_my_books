import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { JournalEntry } from '@prisma/client';
import type { CreateJournalEntryRequest, JournalEntryResponse, ListJournalEntriesResponse, UpdateJournalEntryRequest } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedBook(userId: string, copyId: string): Promise<number> {
    const copy = await this.prisma.bookCopy.findFirst({
      where: { id: copyId, userId },
      select: { edition: { select: { pageCount: true } } },
    });
    if (!copy) throw new NotFoundException('Книга не найдена');
    return copy.edition.pageCount;
  }

  private validatePage(page: number | null | undefined, totalPages: number) {
    if (page != null && totalPages > 0 && page > totalPages) {
      throw new BadRequestException('Страница превышает количество страниц книги');
    }
  }

  private respond(entry: JournalEntry): JournalEntryResponse {
    return {
      id: entry.id,
      copyId: entry.copyId,
      kind: entry.kind,
      body: entry.body,
      ...(entry.page != null ? { page: entry.page } : {}),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  async list(userId: string, copyId: string): Promise<ListJournalEntriesResponse> {
    await this.ownedBook(userId, copyId);
    const entries = await this.prisma.journalEntry.findMany({
      where: { userId, copyId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return { entries: entries.map((entry) => this.respond(entry)) };
  }

  async create(userId: string, copyId: string, input: CreateJournalEntryRequest): Promise<JournalEntryResponse> {
    const total = await this.ownedBook(userId, copyId);
    const body = input.body.trim();
    if (!body) throw new BadRequestException('Введите заметку или цитату');
    this.validatePage(input.page, total);
    return this.respond(await this.prisma.journalEntry.create({
      data: { userId, copyId, kind: input.kind, body, page: input.page ?? null },
    }));
  }

  async update(userId: string, copyId: string, entryId: string, input: UpdateJournalEntryRequest): Promise<JournalEntryResponse> {
    const total = await this.ownedBook(userId, copyId);
    const existing = await this.prisma.journalEntry.findFirst({ where: { id: entryId, userId, copyId } });
    if (!existing) throw new NotFoundException('Запись не найдена');
    if (input.body === undefined && input.page === undefined) throw new BadRequestException('Не указаны изменения');
    const body = input.body === undefined ? existing.body : input.body.trim();
    if (!body) throw new BadRequestException('Запись не может быть пустой');
    const page = input.page === undefined ? existing.page : input.page;
    this.validatePage(page, total);
    return this.respond(await this.prisma.journalEntry.update({
      where: { id: entryId }, data: { body, page: page ?? null },
    }));
  }

  async remove(userId: string, copyId: string, entryId: string): Promise<void> {
    await this.ownedBook(userId, copyId);
    const deleted = await this.prisma.journalEntry.deleteMany({ where: { id: entryId, userId, copyId } });
    if (!deleted.count) throw new NotFoundException('Запись не найдена');
  }
}
