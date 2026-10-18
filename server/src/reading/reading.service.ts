import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, ReadingProgressEvent, ReadingSession } from '@prisma/client';
import type { FinishReadingSessionResponse, ReadingHistoryResponse, ReadingProgressEventResponse, ReadingSessionResponse } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';

export async function lockReading(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'reading:' + userId}))`;
}

@Injectable()
export class ReadingService {
  constructor(private readonly prisma: PrismaService) {}

  private session(s: ReadingSession): ReadingSessionResponse {
    return {
      id: s.id, copyId: s.copyId, startPage: s.startPage,
      startedAt: s.startedAt.toISOString(),
      ...(s.endPage !== null ? { endPage: s.endPage } : {}),
      ...(s.finishedAt ? { finishedAt: s.finishedAt.toISOString() } : {}),
      ...(s.durationSeconds !== null ? { durationSeconds: s.durationSeconds } : {}),
    };
  }

  private event(e: ReadingProgressEvent): ReadingProgressEventResponse {
    return {
      id: e.id, copyId: e.copyId, fromPage: e.fromPage, toPage: e.toPage,
      source: e.source, createdAt: e.createdAt.toISOString(),
    };
  }

  async history(userId: string, copyId: string): Promise<ReadingHistoryResponse> {
    const book = await this.prisma.bookCopy.findFirst({ where: { id: copyId, userId }, select: { id: true } });
    if (!book) throw new NotFoundException('Книга не найдена');
    const [active, sessions, events] = await Promise.all([
      this.prisma.readingSession.findFirst({ where: { userId, copyId, finishedAt: null } }),
      this.prisma.readingSession.findMany({ where: { userId, copyId, finishedAt: { not: null } }, orderBy: [{ finishedAt: 'desc' }, { id: 'asc' }], take: 50 }),
      this.prisma.readingProgressEvent.findMany({ where: { userId, copyId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 50 }),
    ]);
    return { ...(active ? { active: this.session(active) } : {}), sessions: sessions.map(s => this.session(s)), events: events.map(e => this.event(e)) };
  }

  async start(userId: string, copyId: string): Promise<ReadingSessionResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockReading(tx, userId);
      const book = await tx.bookCopy.findFirst({ where: { id: copyId, userId }, select: { currentPage: true, status: true } });
      if (!book) throw new NotFoundException('Книга не найдена');
      const active = await tx.readingSession.findFirst({ where: { userId, finishedAt: null } });
      if (active) {
        if (active.copyId !== copyId) throw new ConflictException('Уже идёт чтение другой книги. Сначала завершите или отмените её сессию.');
        return this.session(active);
      }
      const created = await tx.readingSession.create({ data: { userId, copyId, startPage: book.currentPage } });
      if (book.status === 'want_to_read') await tx.bookCopy.update({ where: { id: copyId }, data: { status: 'reading' } });
      return this.session(created);
    });
  }

  async finish(userId: string, copyId: string, sessionId: string, endPage: number): Promise<FinishReadingSessionResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockReading(tx, userId);
      const book = await tx.bookCopy.findFirst({ where: { id: copyId, userId }, include: { edition: { select: { pageCount: true } } } });
      if (!book) throw new NotFoundException('Книга не найдена');
      const session = await tx.readingSession.findFirst({ where: { id: sessionId, userId, copyId } });
      if (!session) throw new NotFoundException('Сессия не найдена');
      if (session.finishedAt) {
        if (session.endPage !== endPage) throw new ConflictException('Сессия уже завершена с другой страницей');
        return { session: this.session(session), currentPage: book.currentPage };
      }
      if (!Number.isInteger(endPage) || endPage < 0 || endPage > book.edition.pageCount) throw new BadRequestException('Некорректная страница');
      if (book.currentPage !== session.startPage) throw new ConflictException('Прогресс книги изменился во время чтения. Обновите книгу, завершите или отмените сессию.');
      const now = new Date();
      const durationSeconds = Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000));
      const saved = await tx.readingSession.update({ where: { id: sessionId }, data: { finishedAt: now, endPage, durationSeconds } });
      if (book.currentPage !== endPage) {
        await tx.bookCopy.update({ where: { id: copyId }, data: { currentPage: endPage } });
        await tx.readingProgressEvent.create({ data: { userId, copyId, fromPage: book.currentPage, toPage: endPage, source: 'session' } });
      }
      return { session: this.session(saved), currentPage: endPage };
    });
  }

  async cancel(userId: string, copyId: string, sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockReading(tx, userId);
      const book = await tx.bookCopy.findFirst({ where: { id: copyId, userId }, select: { id: true } });
      if (!book) throw new NotFoundException('Книга не найдена');
      const result = await tx.readingSession.deleteMany({ where: { id: sessionId, userId, copyId, finishedAt: null } });
      if (!result.count) throw new NotFoundException('Активная сессия не найдена');
    });
  }
}
