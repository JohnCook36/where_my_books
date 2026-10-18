import { AppHeader, EmptyState, PillButton, ScreenContainer, ScreenContent } from '@/components';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useAuth } from '../../features/auth/AuthProvider';
import { ActiveSessions } from '../../features/auth/ActiveSessions';

export default function ProfileScreen() {
  const auth = useAuth();
  return <ScreenContainer><ScreenContent><AppHeader title="Профиль" /><EmptyState title={auth.user?.email ?? 'Профиль'} message="Настройки приложения и сессия аккаунта." /><PillButton label="Настройки" onPress={() => router.push('/settings')} /><PillButton label="Выйти" variant="secondary" onPress={() => void auth.logout()} /><PillButton label="Выйти на всех устройствах" variant="secondary" onPress={() => Alert.alert('Завершить все сеансы?', 'Это отключит остальные устройства и потребует входа с паролем.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Завершить сеансы', style: 'destructive', onPress: () => void auth.logoutAll().catch((err: unknown) => Alert.alert('Не удалось завершить сеансы', err instanceof Error ? err.message : 'Попробуйте ещё раз.')) }])} /><ActiveSessions /></ScreenContent></ScreenContainer>;
}
