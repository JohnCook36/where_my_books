import styled from '@emotion/native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput } from 'react-native';
import type { ReadingStatsResponse } from '@where-my-books/shared';
import { AppHeader, ErrorState, LoadingState, PillButton, ScreenContainer, ScreenContent, ScreenScroll, SurfaceCard } from '@/components';
import { useAuth } from '../../features/auth/AuthProvider';
import { api } from '../../api/client';
import { colors, radii, spacing, typography } from '@/theme';

const Title = styled.Text({ color: colors.ink, ...typography.heading });
const Label = styled.Text({ color: colors.inkSecondary, ...typography.caption });
const Text = styled.Text({ color: colors.ink, ...typography.body });
const Stack = styled.View({ gap: spacing.md });
const Row = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md });
const Field = styled(TextInput)({ color: colors.ink, backgroundColor: colors.paper, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, ...typography.body });
const Chart = styled.View({ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.xs, minHeight: 115 });
const Column = styled.View({ alignItems: 'center', flex: 1, gap: spacing.xs });
const Bar = styled.View({ backgroundColor: colors.forest, borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm, width: '80%' });

export default function StatsScreen() {
  const auth = useAuth();
  const [stats, setStats] = useState<ReadingStatsResponse>();
  const [booksTarget, setBooksTarget] = useState('12');
  const [minutesTarget, setMinutesTarget] = useState('180');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [refresh, setRefresh] = useState(0);

  useFocusEffect(useCallback(() => {
    void refresh;
    if (!auth.user) return;
    let active = true;
    setLoading(true);
    void api.statistics().then(result => {
      if (!active) return;
      setStats(result);
      setBooksTarget(String(result.goals.finishedBooksTarget));
      setMinutesTarget(String(result.goals.weeklyMinutesTarget));
      setError(undefined);
    }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Не удалось загрузить статистику'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.user, refresh]));

  const saveGoals = async () => {
    const finishedBooksTarget = Number(booksTarget);
    const weeklyMinutesTarget = Number(minutesTarget);
    if (!Number.isInteger(finishedBooksTarget) || finishedBooksTarget < 1 || finishedBooksTarget > 500 ||
        !Number.isInteger(weeklyMinutesTarget) || weeklyMinutesTarget < 10 || weeklyMinutesTarget > 10080) {
      setError('Цель книг: 1–500, минут в неделю: 10–10080');
      return;
    }
    setSaving(true); setError(undefined);
    try {
      await api.updateReadingGoals({ finishedBooksTarget, weeklyMinutesTarget });
      setRefresh(current => current + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить цели'); }
    finally { setSaving(false); }
  };

  if (auth.loading) return <ScreenContainer><LoadingState /></ScreenContainer>;
  if (!auth.user) return null;
  if (loading && !stats) return <ScreenContainer><LoadingState /></ScreenContainer>;
  const daily = stats?.daily ?? [];
  const maxMinutes = Math.max(1, ...daily.map(day => day.minutes));
  return <ScreenContainer><ScreenScroll keyboardShouldPersistTaps="handled"><ScreenContent>
    <AppHeader title="Статистика" subtitle="Только данные вашей библиотеки и завершённых сессий" />
    <Stack>
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : null}
      {stats ? <>
        <SurfaceCard><Title>Моя библиотека</Title>
          <Row><Text>Всего: {stats.booksTotal}</Text><Text>Читаю: {stats.booksReading}</Text><Text>Прочитано: {stats.booksFinished}</Text></Row>
        </SurfaceCard>
        <SurfaceCard><Title>Чтение</Title>
          <Text>Завершено сессий: {stats.completedSessions}</Text>
          <Text>Время завершённых сессий: {stats.totalMinutes} мин</Text>
          <Text>Продвижение по страницам: {stats.totalPagesAdvanced}</Text>
          <Label>Продвижение — сумма положительных изменений страницы, включая изменения вручную. Это не уникальные страницы.</Label>
        </SurfaceCard>
        <SurfaceCard><Title>Последние 7 дней (UTC)</Title>
          <Chart>{daily.map(day => <Column key={day.date}>
            <Label>{day.minutes}м</Label>
            <Bar style={{ height: Math.max(6, Math.round((day.minutes / maxMinutes) * 78)) }} />
            <Label>{day.date.slice(5)}</Label>
          </Column>)}</Chart>
          <Label>Данные завершённых сессий; дни учитываются по времени UTC. Страницы за 7 дней: {daily.reduce((sum, day) => sum + day.pagesAdvanced, 0)}.</Label>
        </SurfaceCard>
        <SurfaceCard><Title>Цели</Title>
          <Text>Прочитано книг: {stats.booksFinished} / {stats.goals.finishedBooksTarget}</Text>
          <Label>Цель по книгам — общее количество книг со статусом «Прочитано».</Label>
          <Text>Эта неделя: {stats.weeklyMinutes} / {stats.goals.weeklyMinutesTarget} минут</Text>
          <Label>Неделя начинается {stats.weekStartUtc} (понедельник, UTC).</Label>
          <Label>Сколько книг хочу прочитать</Label>
          <Field accessibilityLabel="Цель по прочитанным книгам" keyboardType="number-pad" value={booksTarget} onChangeText={setBooksTarget} />
          <Label>Сколько минут читать за неделю</Label>
          <Field accessibilityLabel="Цель минут за неделю" keyboardType="number-pad" value={minutesTarget} onChangeText={setMinutesTarget} />
          <PillButton label={saving ? 'Сохраняем…' : 'Сохранить цели'} onPress={() => void saveGoals()} disabled={saving} />
        </SurfaceCard>
      </> : null}
    </Stack>
  </ScreenContent></ScreenScroll></ScreenContainer>;
}
