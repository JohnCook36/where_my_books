import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReadingStatus } from '@prisma/client';
import type { CreateBookRequest, LibraryBookResponse, ListBooksResponse, UpdateBookRequest, UpdateReadingProgressRequest, UpdateReadingStatusRequest } from '@where-my-books/shared';
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
    if (!title || !authorName || dto.totalPages < 1) throw new BadRequestException('Title, author and totalPages are required');
    const author = await this.prisma.author.upsert({ where: { name: authorName }, create: { name: authorName }, update: {} });
    const work = await this.prisma.bookWork.create({ data: { title, authors: { create: { authorId: author.id } } } });
    const edition = await this.prisma.edition.create({ data: { workId: work.id, pageCount: dto.totalPages } });
    const copy = await this.prisma.bookCopy.create({ data: { userId, editionId: edition.id }, include });
    return this.toResponse(copy);
  }

  async update(userId: string, id: string, dto: UpdateBookRequest): Promise<LibraryBookResponse> {
    const current = await this.owned(userId, id);
    const data: Prisma.BookWorkUpdateInput = {};
    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('Title cannot be blank');
      data.title = title;
    }
    if (dto.author !== undefined && !dto.author.trim()) throw new BadRequestException('Author cannot be blank');
    if (dto.totalPages !== undefined && dto.totalPages < current.currentPage) throw new BadRequestException('totalPages cannot be less than currentPage');
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.bookWork.update({ where: { id: current.edition.workId }, data });
      if (dto.totalPages !== undefined) await tx.edition.update({ where: { id: current.editionId }, data: { pageCount: dto.totalPages } });
      if (dto.author !== undefined) {
        const authorName = dto.author.trim();
        const author = await tx.author.upsert({ where: { name: authorName }, create: { name: authorName }, update: {} });
        await tx.workAuthor.deleteMany({ where: { workId: current.edition.workId } });
        await tx.workAuthor.create({ data: { workId: current.edition.workId, authorId: author.id } });
      }
    });
    return this.get(userId, id);
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
      editionId: book.editionId,
      status: book.status.toLowerCase() as LibraryBookResponse['status'],
      progress: { currentPage: book.currentPage, totalPages: book.edition.pageCount },
      spineColor: book.spineColor,
      spineWidth: book.spineWidth,
      spineHeight: book.spineHeight,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
      work: { id: work.id, title: work.title, ...(work.originalTitle ? { originalTitle: work.originalTitle } : {}), ...(work.description ? { description: work.description } : {}), authors: work.authors.map(({ author }) => ({ id: author.id, name: author.name, createdAt: author.createdAt.toISOString(), updatedAt: author.updatedAt.toISOString() })), createdAt: work.createdAt.toISOString(), updatedAt: work.updatedAt.toISOString() },
      edition: { id: book.edition.id, workId: book.edition.workId, pageCount: book.edition.pageCount, ...(book.edition.isbn ? { isbn: book.edition.isbn } : {}), ...(book.edition.publisher ? { publisher: book.edition.publisher } : {}), ...(book.edition.publicationYear ? { publicationYear: book.edition.publicationYear } : {}), ...(book.edition.coverUri ? { coverUri: book.edition.coverUri } : {}), ...(book.edition.language ? { language: book.edition.language } : {}), createdAt: book.edition.createdAt.toISOString(), updatedAt: book.edition.updatedAt.toISOString() },
    };
  }
}
