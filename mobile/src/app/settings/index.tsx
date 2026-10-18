import { useEffect, useState } from 'react';
import { AppHeader, ErrorState, LoadingState, PillButton, ScreenContainer, ScreenContent } from '@/components';
import type { ProgressDisplayMode } from '@where-my-books/shared';
import { api } from '../../api/client';

export default function SettingsScreen() {
  const [mode, setMode] = useState<ProgressDisplayMode>('pages');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.settings().then(({ settings }) => setMode(settings.progressDisplayMode)).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Ошибка загрузки')).finally(() => setLoading(false)); }, []);
  const update = async (next: ProgressDisplayMode) => { setMode(next); try { await api.updateSettings(next); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить настройку'); } };
  return <ScreenContainer><ScreenContent><AppHeader back title="Настройки" />{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : <><PillButton label="Страницы" variant={mode === 'pages' ? 'primary' : 'secondary'} onPress={() => void update('pages')} /><PillButton label="Проценты" variant={mode === 'percentage' ? 'primary' : 'secondary'} onPress={() => void update('percentage')} /></>}</ScreenContent></ScreenContainer>;
}
