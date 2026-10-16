import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CoverSelection } from '@where-my-books/shared';

export async function lockOwnedCover(tx: Prisma.TransactionClient, userId: string, id: string) {
  const owned = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "CoverAsset" WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
  if (!owned.length) throw new NotFoundException('Обложка не найдена');
}

export async function validateOwnedCoverSelection(tx: Prisma.TransactionClient, userId: string, selection: CoverSelection) {
  if (selection.coverAssetId) await lockOwnedCover(tx, userId, selection.coverAssetId);
  if (selection.coverMode === 'custom' && !selection.coverAssetId) throw new BadRequestException('Выберите собственное изображение обложки');
}
