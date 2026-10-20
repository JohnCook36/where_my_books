import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ReadingStatus, type Prisma } from '@prisma/client';
import type { SyncMutationRequest, SyncMutationResult } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';
import { lockReading } from '../reading/reading.service.js';

@Injectable()
export class SyncMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(userId: string, input: SyncMutationRequest): Promise<SyncMutationResult> {
    const payload = {
      copyId: input.copyId,
      baseUpdatedAt: input.baseUpdatedAt,
      kind: input.kind,
      status: input.status ?? null,
      currentPage: input.currentPage ?? null,
    };
    const requestHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.prisma.$transaction(async (tx) => {
      await lockReading(tx, userId);
      const previous = await tx.syncOperation.findUnique({
        where: { userId_operationId: { userId, operationId: input.operationId } },
      });
      if (previous) {
        if (previous.requestHash !== requestHash) {
          throw new ConflictException('Operation identifier is already used for different data');
        }
        return previous.result as unknown as SyncMutationResult;
      }
      if ((input.kind === 'progress' && (input.currentPage === undefined || input.status !== undefined)) ||
        (input.kind === 'status' && (input.status === undefined || input.currentPage !== undefined))) {
        throw new BadRequestException('Specify exactly one supported change');
      }
      const book = await tx.bookCopy.findFirst({
        where: { id: input.copyId, userId },
        include: { edition: { select: { pageCount: true } } },
      });
      if (!book) throw new NotFoundException('Book not found');
      if (new Date(input.baseUpdatedAt).toISOString() !== book.updatedAt.toISOString()) {
        throw new ConflictException('Book changed since offline edit; refresh before resolving');
      }
      const currentPage = input.kind === 'progress' ? input.currentPage! : book.currentPage;
      if (currentPage < 0 || currentPage > book.edition.pageCount) {
        throw new BadRequestException('Page is outside edition page count');
      }
      const status = input.kind === 'status' ? input.status! : book.status;
      if (!Object.values(ReadingStatus).includes(status as ReadingStatus)) {
        throw new BadRequestException('Unsupported reading status');
      }
      const updated = await tx.bookCopy.update({
        where: { id: book.id },
        data: input.kind === 'status' ? { status } : { currentPage },
      });
      if (input.kind === 'progress' && updated.currentPage !== book.currentPage) {
        await tx.readingProgressEvent.create({
          data: { userId, copyId: book.id, fromPage: book.currentPage, toPage: updated.currentPage, source: 'manual' },
        });
      }
      const result: SyncMutationResult = {
        operationId: input.operationId,
        copyId: book.id,
        updatedAt: updated.updatedAt.toISOString(),
        status: updated.status,
        currentPage: updated.currentPage,
      };
      await tx.syncOperation.create({
        data: { userId, operationId: input.operationId, requestHash, result: result as unknown as Prisma.InputJsonValue },
      });
      return result;
    });
  }
}
