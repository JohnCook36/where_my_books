import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { initializeDatabase } from './database';
import { seedDevelopmentData } from './seed';

interface DatabaseContextValue { isReady: boolean; error: Error | null; retry: () => void }
const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ isReady: boolean; error: Error | null }>({ isReady: false, error: null });
  useEffect(() => { const timer = setTimeout(() => { try { const database = initializeDatabase(); seedDevelopmentData(database); setState({ isReady: true, error: null }); } catch (error) { setState({ isReady: false, error: error instanceof Error ? error : new Error('Unknown database error') }); } }, 0); return () => clearTimeout(timer); }, [attempt]);
  const value = useMemo(() => ({ ...state, retry: () => setAttempt((current) => current + 1) }), [state]);
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export const useDatabase = () => { const context = useContext(DatabaseContext); if (!context) throw new Error('useDatabase must be used inside DatabaseProvider'); return context; };
