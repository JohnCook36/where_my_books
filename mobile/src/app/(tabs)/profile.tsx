import { AppHeader, EmptyState, PillButton, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
import { router } from 'expo-router';
export default function ProfileScreen() { return <ScreenContainer><ScreenContent><AppHeader title="Профиль" /><EmptyState title="Личный профиль" message="Настройки приложения доступны отдельно." /><PillButton label="Настройки" onPress={() => router.push('/settings')} /></ScreenContent></ScreenContainer>; }
