import styled from '@emotion/native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { AccountSession } from '@where-my-books/shared';
import { ErrorState, LoadingState, PillButton, SurfaceCard } from '@/components';
import { colors, spacing, typography } from '@/theme';
import { api } from '../../api/client';

const Container = styled.View({ gap: spacing.md, marginTop: spacing.lg });
const Heading = styled.Text({ color: colors.ink, ...typography.heading });
const Description = styled.Text({ color: colors.inkSecondary, ...typography.caption });

export function ActiveSessions() {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useFocusEffect(useCallback(() => {
    void version;
    let active = true;
    setLoading(true);
    void api.activeSessions().then((data) => {
      if (active) { setSessions(data.sessions); setError(null); }
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : 'Не удалось загрузить сеансы');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [version]));

  const revoke = (session: AccountSession) => Alert.alert(
    'Завершить сеанс?',
    'Этот сеанс сразу потеряет доступ к вашей библиотеке.',
    [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Завершить', style: 'destructive', onPress: () => {
        setBusyId(session.id);
        setError(null);
        void api.revokeSession(session.id)
          .then(() => setVersion((v) => v + 1))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Не удалось завершить сеанс'))
          .finally(() => setBusyId(null));
      } },
    ],
  );

  return <Container>
    <Heading>Активные сеансы</Heading>
    <Description>Показаны действующие авторизации. Название устройства пока не собирается и не хранится.</Description>
    {loading ? <LoadingState /> : sessions.map((session) => <SurfaceCard key={session.id}>
      <Description>{session.isCurrent ? 'Текущий сеанс' : 'Другой сеанс'} · {session.id.slice(0, 8)}…</Description>
      <Description>Создан: {new Date(session.createdAt).toLocaleString()}</Description>
      <Description>Истекает: {new Date(session.expiresAt).toLocaleString()}</Description>
      {!session.isCurrent ? <PillButton label="Завершить сеанс" variant="secondary" disabled={busyId !== null} onPress={() => revoke(session)} /> : null}
    </SurfaceCard>)}
    {!loading && sessions.length === 0 && !error ? <Description>Активных сеансов нет.</Description> : null}
    {error ? <ErrorState message={error} /> : null}
  </Container>;
}
