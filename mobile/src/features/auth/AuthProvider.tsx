import type { AuthUser } from '@where-my-books/shared';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { api, tokenStore } from '../../api/client';

type AuthContextValue = { user: AuthUser | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (await tokenStore.hydrate()) {
          const response = await api.me();
          if (active) setUser(response.user);
        }
      } catch {
        await tokenStore.clear();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading, error,
    login: async (email, password) => { setError(null); try { const response = await api.login({ email, password }); await tokenStore.set(response); setUser(response.user); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось войти'); throw err; } },
    register: async (email, password) => { setError(null); try { const response = await api.register({ email, password }); await tokenStore.set(response); setUser(response.user); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться'); throw err; } },
    logout: async () => { try { await api.logout(); } finally { await tokenStore.clear(); setUser(null); } },
  }), [error, loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; };
