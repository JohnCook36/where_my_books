import type { AuthResponse, AuthUser } from '@where-my-books/shared';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { api, tokenStore } from '../../api/client';

type AuthContextValue = { user: AuthUser | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; register: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
const applyAuth = (response: AuthResponse) => { tokenStore.set(response); return response.user; };

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const loading = false;
  const [error, setError] = useState<string | null>(null);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading, error,
    login: async (email, password) => { setError(null); try { setUser(applyAuth(await api.login({ email, password }))); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось войти'); throw err; } },
    register: async (email, password) => { setError(null); try { setUser(applyAuth(await api.register({ email, password }))); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось зарегистрироваться'); throw err; } },
    logout: async () => { try { await api.logout(); } finally { tokenStore.clear(); setUser(null); } },
  }), [error, loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used inside AuthProvider'); return context; };
