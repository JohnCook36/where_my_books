import { lockShelfLayout, detachDeletedCopy } from '../shelves/layout-storage.js';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, ReadingStatus } from '@prisma/client';
import type { CreateBookRequest, LibraryBookResponse, ListBooksResponse, LibrarySearchFilters, SearchBooksResponse, UpdateBookRequest, UpdateReadingProgressRequest, UpdateReadingStatusRequest } from '@where-my-books/shared';
import { isbn13 } from '@where-my-books/shared';
import { validateOwnedCoverSelection } from '../covers/cover-access.js';
import { catalogCoverUri } from '../catalog/providers.js';
import { PrismaService } from '../prisma.service.js';
import { lockReading } from '../reading/reading.service.js';

const include = { placement: { include: { row: { include: { section: { include: { shelf: { include: { room: true } } } } } } } }, edition: { include: { work: { include: { authors: { include: { author: true } } } } } } } as const;
type BookWithRelations = Prisma.BookCopyGetPayload<{ include: typeof include }>;

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ListBooksResponse> {
    const books = await this.prisma.bookCopy.findMany({ where: { userId }, include, orderBy: { createdAt: 'asc' } });
    return { books: books.map((book) => this.toResponse(book)) };
  }

  async search(userId: string, filters: LibrarySearchFilters): Promise<SearchBooksResponse> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const query = filters.query?.trim();
    const direction = filters.order ?? 'desc';
    const sort = filters.sort ?? 'added';
    // Query is always owner-scoped in PostgreSQL, including total count.
    const where: Prisma.BookCopyWhereInput = {
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(query ? { OR: [
        { edition: { work: { title: { contains: query, mode: 'insensitive' } } } },
        { edition: { work: { authors: { some: { author: { name: { contains: query, mode: 'insensitive' } } } } } } },
        { edition: { isbn: { contains: query.replace(/[\s-]/g, ''), mode: 'insensitive' } } },
        { edition: { publisher: { contains: query, mode: 'insensitive' } } },
      ] } : {}),
    };
    const orderBy: Prisma.BookCopyOrderByWithRelationInput[] =
      sort === 'title' ? [{ edition: { work: { title: direction } } }, { id: 'asc' }] :
      sort === 'year' ? [{ edition: { publicationYear: direction } }, { id: 'asc' }] :
      sort === 'updated' ? [{ updatedAt: direction }, { id: 'asc' }] :
      [{ createdAt: direction }, { id: 'asc' }];
    const [total, books] = await this.prisma.$transaction([
      this.prisma.bookCopy.count({ where }),
      this.prisma.bookCopy.findMany({ where, include, orderBy, take: limit, skip: (page - 1) * limit }),
    ]);
    return { books: books.map((book) => this.toResponse(book)), total, page, limit, hasMore: page * limit < total };
  }

  async get(userId: string, id: string): Promise<LibraryBookResponse> {
    return this.toResponse(await this.owned(userId, id));
  }

  async create(userId: string, dto: CreateBookRequest): Promise<LibraryBookResponse> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.clientRequestId) {
        await lockCopyOperation(tx, userId, dto.clientRequestId);
        const staged = await tx.scanDraft.findFirst({ where: { id: dto.clientRequestId, userId }, select: { payload: true } });
        if (staged?.payload) throw new ConflictException('Сохранённый черновик нужно подтвердить с актуальной ревизией через очередь.');
      }
      return this.createInTransaction(userId, dto, tx);
    });
  }

  /** Call with an existing transaction when confirming a persisted review snapshot. */
  async createInTransaction(userId: string, dto: CreateBookRequest, tx: Prisma.TransactionClient): Promise<LibraryBookResponse> {
    if (dto.clientRequestId) await lockCopyOperation(tx, userId, dto.clientRequestId);
    const title = dto.title.trim();
    const authorName = dto.author.trim();
    if (!title || !authorName || dto.totalPages < 0) throw new BadRequestException('Title, author and totalPages are required');
    const isbn = dto.isbn ? isbn13(dto.isbn) : undefined;
    if (dto.isbn && !isbn) throw new BadRequestException('Некорректный ISBN');
    const coverUri = this.cover(dto.coverUri);
    const requestHash = createHash('sha256').update(JSON.stringify(Object.fromEntries(
      Object.entries({ ...dto, title, author: authorName, isbn: isbn ?? null, coverUri }).filter(([key]) => key !== 'clientRequestId').sort(([a], [b]) => a.localeCompare(b)),
    ))).digest('hex');
    const replay = (existing: BookWithRelations) => {
      if (existing.requestHash && existing.requestHash !== requestHash) throw new ConflictException('Этот запрос уже сохранил другие данные. Откройте сохранённую книгу или начните добавление нового экземпляра.');
      return this.toResponse(existing);
    };
    if (dto.clientRequestId) {
      const existing = await tx.bookCopy.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: dto.clientRequestId } }, include });
      if (existing) return replay(existing);
    }
    const coverMode = dto.coverMode ?? (dto.coverAssetId ? 'custom' : coverUri ? 'catalog' : 'automatic');
    const coverAssetId = coverMode === 'custom' ? dto.coverAssetId ?? null : null;
    await validateOwnedCoverSelection(tx, userId, { coverMode, coverAssetId });
    const automaticCoverUri = this.cover(dto.automaticCoverUri === undefined ? dto.coverUri : dto.automaticCoverUri);
    let editionId = dto.editionId;
    if (editionId) {
      const ownCopy = await tx.bookCopy.findFirst({ where: { userId, editionId } });
      if (!ownCopy) throw new NotFoundException('Издание не найдено в вашей библиотеке');
    } else {
      const names = this.authorNames(dto.authors ?? [authorName]);
      const authors = await Promise.all(names.map((name) => tx.author.upsert({ where: { name }, create: { name }, update: {} })));
      const work = await tx.bookWork.create({ data: { title, description: dto.description ?? null, authors: { create: authors.map((a) => ({ authorId: a.id })) } } });
      const edition = await tx.edition.create({ data: { workId: work.id, pageCount: dto.totalPages, isbn: isbn ?? null, publisher: dto.publisher ?? null, publicationYear: dto.publicationYear ?? null, language: dto.language ?? null, catalogSource: dto.catalogSource ?? null, externalId: dto.externalId ?? null, coverUri: automaticCoverUri } });
      editionId = edition.id;
    }
    const copy = await tx.bookCopy.create({ data: { userId, editionId, clientRequestId: dto.clientRequestId ?? null, requestHash, coverUri, coverMode, coverAssetId, coverStyle: dto.coverStyle ?? 'parchment' }, include });
    if (dto.clientRequestId) await tx.scanDraft.deleteMany({ where: { id: dto.clientRequestId, userId } });
    return this.toResponse(copy);
  }

  async update(userId: string, id: string, dto: UpdateBookRequest): Promise<LibraryBookResponse> {
    const current = await this.owned(userId, id);
    if (dto.title !== undefined && !dto.title.trim()) throw new BadRequestException('Title cannot be blank');
    if (dto.author !== undefined && !dto.author.trim()) throw new BadRequestException('Author cannot be blank');
    if (dto.totalPages !== undefined && dto.totalPages < current.currentPage) throw new BadRequestException('totalPages cannot be less than currentPage');
    const isbn = dto.isbn === undefined ? current.edition.isbn : dto.isbn ? isbn13(dto.isbn) : null;
    if (dto.isbn && !isbn) throw new BadRequestException('Некорректный ISBN');
    const coverUri = dto.coverUri === undefined ? current.coverUri : this.cover(dto.coverUri);
    return this.prisma.$transaction(async (tx) => {
      // Personal metadata corrections must never mutate another copy's edition/work.
      const coverMode = dto.coverMode ?? (dto.coverAssetId ? 'custom' : dto.coverUri !== undefined ? (dto.coverUri ? 'catalog' : 'automatic') : current.coverMode);
      const coverAssetId = coverMode === 'custom' ? dto.coverAssetId === undefined ? current.coverAssetId : dto.coverAssetId : null;
      await validateOwnedCoverSelection(tx, userId, { coverMode, coverAssetId });
      const metadataChanged = Object.entries(dto).some(([key, value]) => value !== undefined && !['coverUri', 'coverMode', 'coverAssetId', 'automaticCoverUri', 'coverStyle'].includes(key));
      let editionId = current.editionId;
      if (metadataChanged) {
        const names = this.authorNames(dto.authors ?? (dto.author ? [dto.author] : current.edition.work.authors.map(({ author }) => author.name)));
        const authors = await Promise.all(names.map((name) => tx.author.upsert({ where: { name }, create: { name }, update: {} })));
        const work = await tx.bookWork.create({ data: { title: dto.title?.trim() ?? current.edition.work.title, description: dto.description ?? current.edition.work.description, originalTitle: current.edition.work.originalTitle, authors: { create: authors.map((a) => ({ authorId: a.id })) } } });
        const edition = await tx.edition.create({ data: { workId: work.id, pageCount: dto.totalPages ?? current.edition.pageCount, isbn, publisher: dto.publisher ?? current.edition.publisher, publicationYear: dto.publicationYear ?? current.edition.publicationYear, language: dto.language ?? current.edition.language, catalogSource: dto.catalogSource ?? current.edition.catalogSource, externalId: dto.externalId ?? current.edition.externalId, coverUri: current.edition.coverUri } });
        editionId = edition.id;
      }
      return this.toResponse(await tx.bookCopy.update({ where: { id }, data: { editionId, coverUri, coverMode, coverAssetId, coverStyle: dto.coverStyle ?? current.coverStyle }, include }));
    });
  }

  private authorNames(names: string[]) {
    const normalized = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (!normalized.length) throw new BadRequestException('Укажите автора');
    return normalized;
  }

  private cover(uri: string | null | undefined) {
    if (!uri) return null;
    const safe = catalogCoverUri(uri);
    if (!safe || !uri.startsWith('https://')) throw new BadRequestException('Обложка должна быть HTTPS-ссылкой поддерживаемого каталога');
    return safe;
  }

  async remove(userId: string, id: string): Promise<void> { await this.prisma.$transaction(async (tx) => { await lockShelfLayout(tx, userId); await this.owned(userId, id); await detachDeletedCopy(tx, userId, id); await tx.bookCopy.delete({ where: { id } }); }); }

  async updateStatus(userId: string, id: string, dto: UpdateReadingStatusRequest): Promise<LibraryBookResponse> {
    await this.owned(userId, id);
    return this.toResponse(await this.prisma.bookCopy.update({ where: { id }, data: { status: dto.status as ReadingStatus }, include }));
  }

  async updateProgress(userId: string, id: string, dto: UpdateReadingProgressRequest): Promise<LibraryBookResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockReading(tx, userId);
      const current = await tx.bookCopy.findFirst({ where: { id, userId }, include });
      if (!current) throw new NotFoundException('Книга не найдена');
      if (dto.currentPage < 0 || dto.currentPage > current.edition.pageCount) throw new BadRequestException('currentPage must be within the book page count');
      if (current.currentPage === dto.currentPage) return this.toResponse(current);
      const updated = await tx.bookCopy.update({ where: { id }, data: { currentPage: dto.currentPage }, include });
      await tx.readingProgressEvent.create({ data: { userId, copyId: id, fromPage: current.currentPage, toPage: dto.currentPage, source: 'manual' } });
      return this.toResponse(updated);
    });
  }

  private async owned(userId: string, id: string): Promise<BookWithRelations> {
    const book = await this.prisma.bookCopy.findUnique({ where: { id }, include });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId !== userId) throw new ForbiddenException('Book does not belong to the current user');
    return book;
  }

  private toResponse(book: BookWithRelations): LibraryBookResponse {
    const work = book.edition.work;
    return {
      id: book.id,
      coverMode: book.coverMode,
      coverStyle: book.coverStyle,
      ...(book.coverAssetId ? { coverAssetId: book.coverAssetId } : {}),
      ...(book.coverUri ? { coverUri: book.coverUri } : {}),
      editionId: book.editionId,
      ...(book.placement ? { location: { rowId: book.placement.rowId, sectionId: book.placement.row.sectionId, shelfId: book.placement.row.section.shelfId, roomId: book.placement.row.section.shelf.roomId, position: book.placement.position, path: [book.placement.row.section.shelf.room.name, book.placement.row.section.shelf.name, book.placement.row.section.name, book.placement.row.name, `Книга ${book.placement.position + 1}`].join(' → ') } } : {}),
      status: book.status.toLowerCase() as LibraryBookResponse['status'],
      progress: { currentPage: book.currentPage, totalPages: book.edition.pageCount },
      spineColor: book.spineColor,
      spineWidth: book.spineWidth,
      spineHeight: book.spineHeight,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
      work: { id: work.id, title: work.title, ...(work.originalTitle ? { originalTitle: work.originalTitle } : {}), ...(work.description ? { description: work.description } : {}), authors: work.authors.map(({ author }) => ({ id: author.id, name: author.name, createdAt: author.createdAt.toISOString(), updatedAt: author.updatedAt.toISOString() })), createdAt: work.createdAt.toISOString(), updatedAt: work.updatedAt.toISOString() },
      edition: { id: book.edition.id, workId: book.edition.workId, pageCount: book.edition.pageCount, ...(book.edition.isbn ? { isbn: book.edition.isbn } : {}), ...(book.edition.publisher ? { publisher: book.edition.publisher } : {}), ...(book.edition.publicationYear ? { publicationYear: book.edition.publicationYear } : {}), ...(book.edition.coverUri ? { coverUri: book.edition.coverUri } : {}), ...(book.edition.catalogSource ? { catalogSource: book.edition.catalogSource } : {}), ...(book.edition.externalId ? { externalId: book.edition.externalId } : {}), ...(book.edition.language ? { language: book.edition.language } : {}), createdAt: book.edition.createdAt.toISOString(), updatedAt: book.edition.updatedAt.toISOString() },
    };
  }
}

/** One key for direct POST replay, review editing, deletion and batch confirmation. */
export async function lockCopyOperation(tx: Prisma.TransactionClient, userId: string, operationId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${operationId}`}))`;
}
