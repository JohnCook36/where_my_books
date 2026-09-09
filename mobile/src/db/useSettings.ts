import { useCallback, useEffect, useState } from 'react';
import type { ProgressDisplayMode } from '@where-my-books/shared';
import { getSettings, updateProgressDisplayMode } from './repositories/settingsRepository';
import { useDatabase } from './DatabaseProvider';

export const useProgressDisplayMode = () => {
  const { isReady } = useDatabase();
  const [mode, setMode] = useState<ProgressDisplayMode>('pages');
  useEffect(() => { if (!isReady) return; const timer = setTimeout(() => setMode(getSettings().progressDisplayMode), 0); return () => clearTimeout(timer); }, [isReady]);
  const updateMode = useCallback((nextMode: ProgressDisplayMode) => { updateProgressDisplayMode(nextMode); setMode(nextMode); }, []);
  return { mode, updateMode };
};
