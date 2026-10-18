import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
export type Orders = { rowId: string; copyIds: string[] }[];
export async function lockShelfLayout(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shelf-layout:${userId}`}))`;
}
/** Rewrite complete affected rows atomically; preserve placement identity and creation time. */
export async function writeOrders(tx: Prisma.TransactionClient, userId: string, orders: Orders) {
  if (!orders.length) return;
  const rowIds = orders.map((row) => row.rowId);
  const previous = await tx.shelfPlacement.findMany({ where: { userId, rowId: { in: rowIds } } });
  const identities = new Map(previous.map((p) => [p.copyId, p]));
  await tx.shelfPlacement.deleteMany({ where: { userId, rowId: { in: rowIds } } });
  const data = orders.flatMap((row) => row.copyIds.map((copyId, position) => ({ id: identities.get(copyId)?.id ?? randomUUID(), userId, copyId, rowId: row.rowId, position, createdAt: identities.get(copyId)?.createdAt ?? new Date() })));
  if (data.length) await tx.shelfPlacement.createMany({ data });
}
/** Book deletion participates in layout revision/locking, so it cannot invalidate an Undo silently. */
export async function detachDeletedCopy(tx: Prisma.TransactionClient, userId: string, copyId: string) {
  const placement = await tx.shelfPlacement.findUnique({ where: { copyId } });
  if (!placement) {
    // An unplaced copy may still be referenced by the latest Undo snapshot.
    await tx.shelfLayout.updateMany({ where: { userId }, data: { revision: { increment: 1 } } });
    return;
  }
  const copies = await tx.shelfPlacement.findMany({ where: { userId, rowId: placement.rowId }, orderBy: { position: 'asc' } });
  await writeOrders(tx, userId, [{ rowId: placement.rowId, copyIds: copies.filter((p) => p.copyId !== copyId).map((p) => p.copyId) }]);
  await tx.shelfLayout.upsert({ where: { userId }, create: { userId, revision: 1 }, update: { revision: { increment: 1 } } });
}
