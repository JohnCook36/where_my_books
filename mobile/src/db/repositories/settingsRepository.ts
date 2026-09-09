import type { ProgressDisplayMode, UserSettings } from '@where-my-books/shared';
import { getDatabase } from '../database';

export const getSettings = (): UserSettings => ({ progressDisplayMode: getDatabase().getFirstSync<{ value: ProgressDisplayMode }>('SELECT value FROM settings WHERE key = ?', 'progressDisplayMode')?.value ?? 'pages' });
export const updateProgressDisplayMode = (mode: ProgressDisplayMode) => getDatabase().runSync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'progressDisplayMode', mode);
