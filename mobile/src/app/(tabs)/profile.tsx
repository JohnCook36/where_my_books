import { AppHeader, EmptyState, PillButton, ScreenContainer, ScreenContent } from '@/components';
import { router } from 'expo-router';
import { useAuth } from '../../features/auth/AuthProvider';

export default function ProfileScreen() {
  const auth = useAuth();
  return <ScreenContainer><ScreenContent><AppHeader title="Профиль" /><EmptyState title={auth.user?.email ?? 'Профиль'} message="Настройки приложения и сессия аккаунта." /><PillButton label="Настройки" onPress={() => router.push('/settings')} /><PillButton label="Выйти" variant="secondary" onPress={() => void auth.logout()} /></ScreenContent></ScreenContainer>;
}
