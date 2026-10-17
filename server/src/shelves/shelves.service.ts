import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { insertCopies, parseShelfAction, type ShelfAction, type ShelfLayout, type ShelfMutation, type ShelfMutationResponse, type StorageKind } from '@where-my-books/shared';
import { PrismaService } from '../prisma.service.js';
import { lockShelfLayout, writeOrders, type Orders } from './layout-storage.js';
type Tx = Prisma.TransactionClient;
interface UndoSnapshot { orders: Orders }
@Injectable()
export class ShelvesService {
  constructor(private readonly prisma: PrismaService) {}
  async layout(userId: string): Promise<ShelfLayout> {
    return this.prisma.$transaction(async (tx) => {
      const [state, rooms, shelves, sections, rows, placements] = await Promise.all([
        tx.shelfLayout.findUnique({ where: { userId } }), tx.storageRoom.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
        tx.shelf.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }), tx.shelfSection.findMany({ where: { userId }, orderBy: { position: 'asc' } }),
        tx.shelfRow.findMany({ where: { userId }, orderBy: { position: 'asc' } }), tx.shelfPlacement.findMany({ where: { userId }, orderBy: { position: 'asc' } }),
      ]);
      const stamps = (value: { id: string; createdAt: Date; updatedAt: Date }) => ({ id: value.id, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() });
      return { revision: state?.revision ?? 0, rooms: rooms.map((r) => ({ ...stamps(r), name: r.name })),
        shelves: shelves.map((s) => ({ ...stamps(s), name: s.name, roomId: s.roomId, theme: s.theme as 'oak' | 'ivory' | 'night' })),
        sections: sections.map((s) => ({ ...stamps(s), shelfId: s.shelfId, name: s.name, position: s.position })),
        rows: rows.map((r) => ({ ...stamps(r), sectionId: r.sectionId, name: r.name, capacity: r.capacity, position: r.position })),
        placements: placements.map((p) => { const row = rows.find((r) => r.id === p.rowId)!; const section = sections.find((s) => s.id === row.sectionId)!; return { ...stamps(p), copyId: p.copyId, rowId: p.rowId, sectionId: row.sectionId, shelfId: section.shelfId, position: p.position }; }),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async mutate(userId: string, dto: ShelfMutation): Promise<ShelfMutationResponse> {
    let action: ShelfAction;
    try { action = parseShelfAction(dto.action); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Некорректное действие'); }
    const hash = createHash('sha256').update(JSON.stringify({ baseRevision: dto.baseRevision, action })).digest('hex');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockShelfLayout(tx, userId);
        const prior = await tx.shelfOperation.findUnique({ where: { userId_requestId: { userId, requestId: dto.requestId } } });
        if (prior) { if (prior.requestHash !== hash) throw new ConflictException('Этот ключ уже использован для другого действия'); return { revision: prior.resultRevision, operationId: prior.requestId, canUndo: !!prior.undo }; }
        const state = await tx.shelfLayout.upsert({ where: { userId }, create: { userId }, update: {} });
        if (state.revision !== dto.baseRevision) throw new ConflictException('Расположение изменилось на другом устройстве. Обновите шкаф.');
        const undo = await this.apply(tx, userId, action, state.revision);
        const revision = state.revision + 1;
        await tx.shelfLayout.update({ where: { userId }, data: { revision } });
        await tx.shelfOperation.create({ data: { userId, requestId: dto.requestId, requestHash: hash, resultRevision: revision, undo: undo ? JSON.parse(JSON.stringify(undo)) as Prisma.InputJsonValue : Prisma.DbNull } });
        return { revision, operationId: dto.requestId, canUndo: !!undo };
      }, { timeout: 15_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2003', 'P2025'].includes(error.code)) throw new ConflictException('Данные расположения изменились. Обновите шкаф и повторите действие.');
      throw error;
    }
  }
  private async owned(tx: Tx, userId: string, kind: StorageKind, id: string) {
    const where = { id, userId };
    const value = kind === 'room' ? await tx.storageRoom.findFirst({ where }) : kind === 'shelf' ? await tx.shelf.findFirst({ where }) : kind === 'section' ? await tx.shelfSection.findFirst({ where }) : await tx.shelfRow.findFirst({ where });
    if (!value) throw new NotFoundException('Место хранения не найдено');
    return value;
  }
  private async orders(tx: Tx, userId: string, rowIds: string[]): Promise<Orders> {
    const placements = await tx.shelfPlacement.findMany({ where: { userId, rowId: { in: rowIds } }, orderBy: { position: 'asc' } });
    return rowIds.map((rowId) => ({ rowId, copyIds: placements.filter((p) => p.rowId === rowId).map((p) => p.copyId) }));
  }
  private async move(tx: Tx, userId: string, copyIds: string[], rowId: string | null, beforeCopyId: string | null = null): Promise<UndoSnapshot> {
    const copies = await tx.bookCopy.count({ where: { userId, id: { in: copyIds } } });
    if (copies !== copyIds.length) throw new NotFoundException('Некоторые экземпляры не найдены в вашей библиотеке');
    const target = rowId ? await tx.shelfRow.findFirst({ where: { id: rowId, userId } }) : null;
    if (rowId && !target) throw new NotFoundException('Целевая полка не найдена');
    const current = await tx.shelfPlacement.findMany({ where: { userId, copyId: { in: copyIds } } });
    const rowIds = [...new Set([...current.map((p) => p.rowId), ...(rowId ? [rowId] : [])])];
    const original = await this.orders(tx, userId, rowIds);
    const updated = original.map((row) => ({ rowId: row.rowId, copyIds: row.copyIds.filter((id) => !copyIds.includes(id)) }));
    if (target) {
      const order = updated.find((row) => row.rowId === target.id)!;
      try { order.copyIds = insertCopies(order.copyIds, copyIds, beforeCopyId); } catch { throw new ConflictException('Место вставки изменилось'); }
      if (order.copyIds.length > target.capacity) throw new BadRequestException('На полке недостаточно свободных мест');
    }
    await writeOrders(tx, userId, updated);
    return { orders: original };
  }
  private async apply(tx: Tx, userId: string, action: ShelfAction, revision: number): Promise<UndoSnapshot | null> {
    switch (action.type) {
      case 'create_room': await tx.storageRoom.create({ data: { id: action.id, userId, name: action.name } }); break;
      case 'create_shelf': {
        await this.owned(tx, userId, 'room', action.roomId);
        await tx.shelf.create({ data: { id: action.id, userId, roomId: action.roomId, name: action.name, theme: action.theme } });
        for (let i = 0; i < action.sections; i++) {
          const section = await tx.shelfSection.create({ data: { userId, shelfId: action.id, name: `Секция ${i + 1}`, position: i } });
          await tx.shelfRow.createMany({ data: Array.from({ length: action.rows }, (_, j) => ({ userId, sectionId: section.id, name: `Полка ${j + 1}`, position: j, capacity: action.capacity })) });
        }
        break;
      }
      case 'create_section': await this.owned(tx, userId, 'shelf', action.shelfId); await tx.shelfSection.create({ data: { id: action.id, userId, shelfId: action.shelfId, name: action.name, position: ((await tx.shelfSection.aggregate({ where: { userId, shelfId: action.shelfId }, _max: { position: true } }))._max.position ?? -1) + 1 } }); break;
      case 'create_row': await this.owned(tx, userId, 'section', action.sectionId); await tx.shelfRow.create({ data: { id: action.id, userId, sectionId: action.sectionId, name: action.name, capacity: action.capacity, position: ((await tx.shelfRow.aggregate({ where: { userId, sectionId: action.sectionId }, _max: { position: true } }))._max.position ?? -1) + 1 } }); break;
      case 'rename': {
        await this.owned(tx, userId, action.kind, action.id); const args = { where: { id: action.id }, data: { name: action.name } };
        if (action.kind === 'room') await tx.storageRoom.update(args); else if (action.kind === 'shelf') await tx.shelf.update(args); else if (action.kind === 'section') await tx.shelfSection.update(args); else await tx.shelfRow.update(args); break;
      }
      case 'move': return this.move(tx, userId, action.copyIds, action.rowId, action.beforeCopyId ?? null);
      case 'sort': {
        await this.owned(tx, userId, 'row', action.rowId); const original = await this.orders(tx, userId, [action.rowId]);
        const copies = await tx.bookCopy.findMany({ where: { userId, placement: { rowId: action.rowId } }, include: { edition: { include: { work: { include: { authors: { include: { author: true } } } } } } } });
        const key = (copy: typeof copies[number]) => action.by === 'title' ? copy.edition.work.title : copy.edition.work.authors.map((a) => a.author.name).sort().join('; ');
        copies.sort((a, b) => key(a).localeCompare(key(b), 'ru') || a.id.localeCompare(b.id));
        await writeOrders(tx, userId, [{ rowId: action.rowId, copyIds: copies.map((c) => c.id) }]); return { orders: original };
      }
      case 'undo': {
        const prior = await tx.shelfOperation.findUnique({ where: { userId_requestId: { userId, requestId: action.operationId } } });
        if (!prior?.undo || prior.resultRevision !== revision) throw new ConflictException('Отмена недоступна после других изменений раскладки');
        const snapshot = prior.undo as unknown as UndoSnapshot;
        // A moved, previously unplaced copy must also leave its current row on Undo.
        const originalIds = snapshot.orders.flatMap((o) => o.copyIds);
        const affectedIds = snapshot.orders.map((o) => o.rowId);
        const current = await tx.shelfPlacement.findMany({ where: { userId, rowId: { in: affectedIds } } });
        const outside = current.filter((p) => !originalIds.includes(p.copyId)).map((p) => p.copyId);
        if (outside.length) await tx.shelfPlacement.deleteMany({ where: { userId, copyId: { in: outside } } });
        await writeOrders(tx, userId, snapshot.orders); return null;
      }
      case 'delete': {
        await this.owned(tx, userId, action.kind, action.id);
        const rows = await tx.shelfRow.findMany({ where: { userId, ...(action.kind === 'row' ? { id: action.id } : action.kind === 'section' ? { sectionId: action.id } : action.kind === 'shelf' ? { section: { shelfId: action.id } } : { section: { shelf: { roomId: action.id } } }) } });
        const rowIds = rows.map((r) => r.id);
        const placed = await tx.shelfPlacement.findMany({ where: { userId, rowId: { in: rowIds } }, orderBy: [{ rowId: 'asc' }, { position: 'asc' }] });
        if (placed.length && action.destinationRowId === undefined) throw new ConflictException('Сначала выберите, куда перенести книги');
        if (action.destinationRowId && rowIds.includes(action.destinationRowId)) throw new BadRequestException('Нельзя переносить книги внутрь удаляемого места');
        if (action.destinationRowId) await this.owned(tx, userId, 'row', action.destinationRowId);
        if (placed.length) await this.move(tx, userId, placed.map((p) => p.copyId), action.destinationRowId ?? null);
        const where = { id: action.id }; if (action.kind === 'room') await tx.storageRoom.delete({ where }); else if (action.kind === 'shelf') await tx.shelf.delete({ where }); else if (action.kind === 'section') await tx.shelfSection.delete({ where }); else await tx.shelfRow.delete({ where }); break;
      }
    }
    return null;
  }
}
