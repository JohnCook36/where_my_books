import { schema } from './schema';

export const migrations = [{ version: 1, statements: schema }] as const;
