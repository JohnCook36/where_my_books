import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CoverAssetResponse, UserCoverSource } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';
import { lockOwnedCover } from './cover-access.js';
import { normalizeUserCover } from './image-normalizer.js';

const metadataSelect = { id: true, source: true, mimeType: true, width: true, height: true, byteSize: true, createdAt: true } as const;
@Injectable()
export class CoversService {
  constructor(private readonly prisma: PrismaService) {}
  async upload(userId: string, source: UserCoverSource, buffer: Buffer, mimetype: string): Promise<CoverAssetResponse> {
    const normalized = await normalizeUserCover(buffer, mimetype);
    const checksum = createHash('sha256').update(normalized.bytes).digest('hex');
    const asset = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cover-upload:${userId}`}))`;
      const existing = await tx.coverAsset.findUnique({ where: { userId_checksum: { userId, checksum } }, select: metadataSelect });
      return existing ?? tx.coverAsset.create({ data: { userId, source, checksum, ...normalized }, select: metadataSelect });
    });
    return { ...asset, mimeType: 'image/jpeg', createdAt: asset.createdAt.toISOString() };
  }
  async info(userId: string, id: string): Promise<CoverAssetResponse> {
    const asset = await this.prisma.coverAsset.findFirst({ where: { id, userId }, select: metadataSelect });
    if (!asset) throw new NotFoundException('Обложка не найдена');
    return { ...asset, mimeType: 'image/jpeg', createdAt: asset.createdAt.toISOString() };
  }
  async image(userId: string, id: string) {
    const asset = await this.prisma.coverAsset.findFirst({ where: { id, userId }, select: { bytes: true, byteSize: true } });
    if (!asset) throw new NotFoundException('Обложка не найдена');
    return asset;
  }
  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockOwnedCover(tx, userId, id);
      const copies = await tx.bookCopy.count({ where: { coverAssetId: id } });
      const drafts = await tx.scanDraft.count({ where: { userId, payload: { path: ['coverAssetId'], equals: id } } });
      if (copies || drafts) throw new ConflictException('Обложка используется книгой или черновиком. Сначала замените её.');
      await tx.coverAsset.delete({ where: { id } });
      return { removed: true };
    });
  }
}
