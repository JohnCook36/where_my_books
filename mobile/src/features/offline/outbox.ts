import type { LibraryBookResponse, SyncMutationRequest, SyncMutationResult } from '@where-my-books/shared';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { ApiError, api } from '../../api/client';

interface PendingMutation {
  operation: SyncMutationRequest;
  createdAt: string;
  conflict?: string;
}
interface Outbox {
  version: 1;
  ownerId: string;
  items: PendingMutation[];
}
export interface OutboxStatus {
  pending: number;
  conflicts: number;
}

const validOwner = (id: string) => /^[0-9a-f-]{36}$/i.test(id);
const ensureNative = () => {
  if (Platform.OS === 'web') throw new Error('Офлайн-редактирование в Web пока недоступно');
};
const pathFor = (ownerId: string, temporary = false) => {
  ensureNative();
  if (!validOwner(ownerId)) throw new Error('Некорректный идентификатор аккаунта');
  return new File(Paths.document, 'outbox-' + ownerId + (temporary ? '.tmp' : '.json'));
};
const empty = (ownerId: string): Outbox => ({ version: 1, ownerId, items: [] });
async function readRaw(ownerId: string): Promise<Outbox> {
  const file = pathFor(ownerId);
  if (!file.exists) return empty(ownerId);
  // A damaged outbox MUST cause a visible error; never erase unacknowledged edits.
  const raw: unknown = JSON.parse(await file.text());
  if (!raw || typeof raw !== 'object') throw new Error('Повреждена локальная очередь изменений');
  const value = raw as Partial<Outbox>;
  if (value.version !== 1 || value.ownerId !== ownerId || !Array.isArray(value.items)) {
    throw new Error('Очередь изменений повреждена или принадлежит другому аккаунту');
  }
  return value as Outbox;
}
function writeRaw(ownerId: string, value: Outbox) {
  const tmp = pathFor(ownerId, true);
  const target = pathFor(ownerId);
  tmp.write(JSON.stringify(value));
  if (target.exists) target.delete();
  tmp.move(target);
}

let busy: Promise<unknown> = Promise.resolve();
const serial = <T>(job: () => Promise<T>): Promise<T> => {
  const result = busy.catch(() => undefined).then(job);
  busy = result.catch(() => undefined);
  return result;
};

const statusOf = (value: Outbox): OutboxStatus => ({
  pending: value.items.filter(item => !item.conflict).length,
  conflicts: value.items.filter(item => !!item.conflict).length,
});

export function applyPendingEdits(books: LibraryBookResponse[], items: readonly PendingMutation[]): LibraryBookResponse[] {
  return books.map(book => {
    let result = book;
    for (const item of items) {
      if (item.operation.copyId !== book.id) continue;
      if (item.operation.kind === 'status' && item.operation.status) {
        result = { ...result, status: item.operation.status };
      }
      if (item.operation.kind === 'progress' && item.operation.currentPage !== undefined) {
        result = { ...result, progress: { ...result.progress, currentPage: item.operation.currentPage } };
      }
    }
    return result;
  });
}

export const offlineOutbox = {
  async inspect(ownerId: string): Promise<OutboxStatus> {
    const value = await serial(() => readRaw(ownerId));
    return statusOf(value);
  },
  async overlay(ownerId: string, books: LibraryBookResponse[]): Promise<LibraryBookResponse[]> {
    if (Platform.OS === 'web') return books;
    const value = await serial(() => readRaw(ownerId));
    return applyPendingEdits(books, value.items);
  },
  async add(ownerId: string, operation: SyncMutationRequest): Promise<OutboxStatus> {
    return serial(async () => {
      const value = await readRaw(ownerId);
      if (value.items.some(item => item.operation.operationId === operation.operationId)) throw new Error('Повторный локальный ID операции');
      value.items.push({ operation, createdAt: new Date().toISOString() });
      writeRaw(ownerId, value);
      return statusOf(value);
    });
  },
  async flush(ownerId: string): Promise<OutboxStatus> {
    return serial(async () => {
      const value = await readRaw(ownerId);
      for (const item of value.items) {
        if (item.conflict) continue;
        let receipt: SyncMutationResult;
        try {
          receipt = await api.sendSyncMutation(item.operation);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 409 || err.status === 400 || err.status === 404)) {
            item.conflict = err.message || 'Нужно вручную разрешить конфликт';
            writeRaw(ownerId, value);
            continue;
          }
          // Network and auth failures preserve the durable record for retry.
          break;
        }
        const index = value.items.findIndex(pending => pending.operation.operationId === receipt.operationId);
        if (index < 0) throw new Error('Очередь изменилась во время синхронизации');
        value.items.splice(index, 1);
        for (const pending of value.items) {
          if (pending.operation.copyId === receipt.copyId && pending.operation.baseUpdatedAt === item.operation.baseUpdatedAt) {
            pending.operation = { ...pending.operation, baseUpdatedAt: receipt.updatedAt };
          }
        }
        writeRaw(ownerId, value);
      }
      return statusOf(value);
    });
  },
};
