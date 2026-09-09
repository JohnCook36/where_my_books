declare module 'expo-sqlite' {
  export interface SQLiteDatabase {
    execSync(source: string): void;
    getFirstSync<T>(source: string, ...params: unknown[]): T | null;
    getAllSync<T>(source: string, ...params: unknown[]): T[];
    runSync(source: string, ...params: unknown[]): { changes: number; lastInsertRowId: number };
    withTransactionSync(task: () => void): void;
  }
  export const SQLiteDatabase: unknown;
  export function openDatabaseSync(databaseName: string): SQLiteDatabase;
}
