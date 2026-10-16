import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReadingStatus } from '@prisma/client';
import type { CreateBookRequest, LibraryBookResponse, ListBooksResponse, UpdateBookRequest, UpdateReadingProgressRequest, UpdateReadingStatusRequest } from '@where-my-books/shared';
import { isbn13 } from '@where-my-books/shared';
import { catalogCoverUri } from '../catalog/providers.js';
import { PrismaService } from '../prisma.service.js';

const include = { edition: { include: { work: { include: { authors: { include: { author: true } } } } } } } as const;
type BookWithRelations = Prisma.BookCopyGetPayload<{ include: typeof include }>;

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ListBooksResponse> {
    const books = await this.prisma.bookCopy.findMany({ where: { userId }, include, orderBy: { createdAt: 'asc' } });
    return { books: books.map((book) => this.toResponse(book)) };
  }

  async get(userId: string, id: string): Promise<LibraryBookResponse> {
    return this.toResponse(await this.owned(userId, id));
  }

  async create(userId: string, dto: CreateBookRequest): Promise<LibraryBookResponse> {
    const title = dto.title.trim();
    const authorName = dto.author.trim();
    if (!title || !authorName || dto.totalPages < 0) throw new BadRequestException('Title, author and totalPages are required');
    const isbn = dto.isbn ? isbn13(dto.isbn) : undefined;
    if (dto.isbn && !isbn) throw new BadRequestException('Некорректный ISBN');
    const coverUri = this.cover(dto.coverUri);
    if (dto.clientRequestId) {
      const existing = await this.prisma.bookCopy.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: dto.clientRequestId } }, include });
      if (existing) return this.toResponse(existing);
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        let editionId = dto.editionId;
        if (editionId) {
          const ownCopy = await tx.bookCopy.findFirst({ where: { userId, editionId } });
          if (!ownCopy) throw new NotFoundException('Издание не найдено в вашей библиотеке');
        } else {
          const names = this.authorNames(dto.authors ?? [authorName]);
          const authors = await Promise.all(names.map((name) => tx.author.upsert({ where: { name }, create: { name }, update: {} })));
          const work = await tx.bookWork.create({ data: { title, description: dto.description ?? null, authors: { create: authors.map((a) => ({ authorId: a.id })) } } });
          const edition = await tx.edition.create({ data: { workId: work.id, pageCount: dto.totalPages, isbn: isbn ?? null, publisher: dto.publisher ?? null, publicationYear: dto.publicationYear ?? null, language: dto.language ?? null, catalogSource: dto.catalogSource ?? null, externalId: dto.externalId ?? null, coverUri } });
          editionId = edition.id;
        }
        const copy = await tx.bookCopy.create({ data: { userId, editionId, clientRequestId: dto.clientRequestId ?? null, coverUri }, include });
        return this.toResponse(copy);
      });
    } catch (error) {
      // Concurrent replays: unique key rolls back the losing entire transaction.
      if (dto.clientRequestId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.bookCopy.findUnique({ where: { userId_clientRequestId: { userId, clientRequestId: dto.clientRequestId } }, include });
        if (existing) return this.toResponse(existing);
      }
      throw error;
    }
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
      const metadataChanged = Object.keys(dto).some((key) => key !== 'coverUri');
      let editionId = current.editionId;
      if (metadataChanged) {
        const names = this.authorNames(dto.authors ?? (dto.author ? [dto.author] : current.edition.work.authors.map(({ author }) => author.name)));
        const authors = await Promise.all(names.map((name) => tx.author.upsert({ where: { name }, create: { name }, update: {} })));
        const work = await tx.bookWork.create({ data: { title: dto.title?.trim() ?? current.edition.work.title, description: dto.description ?? current.edition.work.description, originalTitle: current.edition.work.originalTitle, authors: { create: authors.map((a) => ({ authorId: a.id })) } } });
        const edition = await tx.edition.create({ data: { workId: work.id, pageCount: dto.totalPages ?? current.edition.pageCount, isbn, publisher: dto.publisher ?? current.edition.publisher, publicationYear: dto.publicationYear ?? current.edition.publicationYear, language: dto.language ?? current.edition.language, catalogSource: dto.catalogSource ?? current.edition.catalogSource, externalId: dto.externalId ?? current.edition.externalId, coverUri: current.edition.coverUri } });
        editionId = edition.id;
      }
      return this.toResponse(await tx.bookCopy.update({ where: { id }, data: { editionId, coverUri }, include }));
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

  async remove(userId: string, id: string): Promise<void> { await this.owned(userId, id); await this.prisma.bookCopy.delete({ where: { id } }); }

  async updateStatus(userId: string, id: string, dto: UpdateReadingStatusRequest): Promise<LibraryBookResponse> {
    await this.owned(userId, id);
    return this.toResponse(await this.prisma.bookCopy.update({ where: { id }, data: { status: dto.status as ReadingStatus }, include }));
  }

  async updateProgress(userId: string, id: string, dto: UpdateReadingProgressRequest): Promise<LibraryBookResponse> {
    const current = await this.owned(userId, id);
    if (dto.currentPage < 0 || dto.currentPage > current.edition.pageCount) throw new BadRequestException('currentPage must be within the book page count');
    return this.toResponse(await this.prisma.bookCopy.update({ where: { id }, data: { currentPage: dto.currentPage }, include }));
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
      ...(book.coverUri ? { coverUri: book.coverUri } : {}),
      editionId: book.editionId,
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
