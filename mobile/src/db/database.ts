// eslint-disable-next-line import/no-unresolved
import * as SQLite from 'expo-sqlite';

import { migrations } from './migrations';

const DATABASE_NAME = 'booknook.db';
let database: SQLite.SQLiteDatabase | null = null;

export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (!database) throw new Error('Database is not initialized');
  return database;
};

export const initializeDatabase = (): SQLite.SQLiteDatabase => {
  if (database) return database;
  const nextDatabase = SQLite.openDatabaseSync(DATABASE_NAME);
  nextDatabase.execSync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const version = nextDatabase.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  for (const migration of migrations) {
    if (version >= migration.version) continue;
    nextDatabase.withTransactionSync(() => {
      for (const statement of migration.statements) nextDatabase.execSync(statement);
      nextDatabase.execSync(`PRAGMA user_version = ${migration.version}`);
    });
  }
  database = nextDatabase;
  return nextDatabase;
};
