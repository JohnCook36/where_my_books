import { BadRequestException, ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type ScanDraft as StoredDraft } from '@prisma/client';
import type { ConfirmScanDraftItem, ConfirmScanDraftsResponse, CreateBookRequest, ScanConfirmationResult, ScanDraft, ScanDraftPayload, UpdateScanDraftRequest } from '@where-my-books/shared';
import { isbn13 } from '@where-my-books/shared';
import { BooksService, lockCopyOperation } from '../books/books.service.js';
import { PrismaService } from '../prisma.service.js';
import { catalogCoverUri } from './providers.js';

const canonical = (payload: ScanDraftPayload) => JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))));
export function readyPayload(payload: ScanDraftPayload | null): payload is ScanDraftPayload & { title: string; author: string } {
  return !!payload?.title?.trim() && !!payload.author?.trim() && (!payload.authors || payload.authors.some((name) => !!name.trim()));
}

@Injectable()
export class ScanDraftsService {
  private readonly logger = new Logger(ScanDraftsService.name);
  constructor(private readonly prisma: PrismaService, private readonly books: BooksService) {}

  async list(userId: string) {
    return { drafts: (await this.prisma.scanDraft.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map((draft) => this.response(draft)) };
  }
  async get(userId: string, id: string) {
    const draft = await this.prisma.scanDraft.findFirst({ where: { id, userId } });
    if (!draft) throw new NotFoundException('Черновик не найден');
    return this.response(draft);
  }
  async add(userId: string, input: string) {
    const isbn = isbn13(input);
    if (!isbn) throw new BadRequestException('Некорректный ISBN');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const existing = await tx.scanDraft.findUnique({ where: { userId_isbn: { userId, isbn } } });
      if (existing) return this.response(existing);
      if (await tx.scanDraft.count({ where: { userId } }) >= 50) throw new BadRequestException('В очереди уже 50 книг. Подтвердите их перед продолжением.');
      return this.response(await tx.scanDraft.create({ data: { userId, isbn } }));
    });
  }
  async update(userId: string, id: string, dto: UpdateScanDraftRequest) {
    // A scanned ISBN cannot silently become a different edition while editing its review.
    if ('isbn' in dto.payload) throw new BadRequestException('Для другого ISBN создайте отдельный черновик');
    if (dto.payload.coverUri && (!dto.payload.coverUri.startsWith('https://') || !catalogCoverUri(dto.payload.coverUri))) throw new BadRequestException('Недопустимый источник обложки');
    if (dto.reviewed && !readyPayload(dto.payload)) throw new BadRequestException('Для подтверждения укажите название и автора');
    return this.prisma.$transaction(async (tx) => {
      await lockCopyOperation(tx, userId, id);
      const draft = await tx.scanDraft.findFirst({ where: { id, userId } });
      if (!draft) throw new NotFoundException('Черновик уже сохранён или удалён. Обновите очередь.');
      if (draft.revision !== dto.baseRevision) {
        // A lost PATCH response can be retried without falsely reporting a conflict.
        if (draft.revision === dto.baseRevision + 1 && draft.reviewed === dto.reviewed && canonical(draft.payload as ScanDraftPayload) === canonical(dto.payload)) return this.response(draft);
        throw new ConflictException('Черновик изменён на другом устройстве. Загрузите актуальную версию.');
      }
      return this.response(await tx.scanDraft.update({ where: { id }, data: { payload: JSON.parse(JSON.stringify(dto.payload)) as Prisma.InputJsonValue, reviewed: dto.reviewed, revision: { increment: 1 } } }));
    });
  }
  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCopyOperation(tx, userId, id);
      await tx.scanDraft.deleteMany({ where: { id, userId } });
      return { removed: true };
    });
  }

  async confirm(userId: string, items: ConfirmScanDraftItem[]): Promise<ConfirmScanDraftsResponse> {
    if (new Set(items.map((item) => item.id)).size !== items.length) throw new BadRequestException('Каждый черновик должен встречаться в партии один раз');
    const results: ScanConfirmationResult[] = [];
    // Separate transactions isolate invalid/failed rows. Only IDs selected by the caller are processed.
    for (const item of items) results.push(await this.confirmOne(userId, item));
    return { results };
  }
  private async confirmOne(userId: string, item: ConfirmScanDraftItem): Promise<ScanConfirmationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockCopyOperation(tx, userId, item.id);
        const receipt = await tx.bookCopy.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: item.id } } });
        if (receipt) return { id: item.id, status: 'saved' as const, copyId: receipt.id };
        const draft = await tx.scanDraft.findFirst({ where: { id: item.id, userId } });
        if (!draft) return { id: item.id, status: 'not_found' as const, message: 'Черновик не найден или удалён' };
        if (draft.revision !== item.revision) return { id: item.id, status: 'conflict' as const, message: 'Данные изменились. Проверьте актуальный черновик.' };
        const payload = draft.payload as ScanDraftPayload | null;
        if (!draft.reviewed || !readyPayload(payload)) return { id: item.id, status: 'invalid' as const, message: 'Сначала проверьте данные и подтвердите готовность книги' };
        const request: CreateBookRequest = { ...payload, title: payload.title, author: payload.author, totalPages: payload.totalPages ?? 0, isbn: draft.isbn, clientRequestId: draft.id };
        const copy = await this.books.createInTransaction(userId, request, tx);
        return { id: item.id, status: 'saved' as const, copyId: copy.id };
      });
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) return { id: item.id, status: error.getStatus() === 409 ? 'conflict' : 'invalid', message: error.message };
      // No metadata, contact data, tokens or database error details in logs/results.
      this.logger.warn('Scan confirmation transaction failed; draft remains retryable');
      return { id: item.id, status: 'failed', message: 'Не удалось сохранить эту книгу. Повторите попытку.' };
    }
  }
  private response(draft: StoredDraft): ScanDraft {
    return { id: draft.id, isbn: draft.isbn, revision: draft.revision, reviewed: draft.reviewed, payload: draft.payload as ScanDraftPayload | null, createdAt: draft.createdAt.toISOString(), updatedAt: draft.updatedAt.toISOString() };
  }
}
