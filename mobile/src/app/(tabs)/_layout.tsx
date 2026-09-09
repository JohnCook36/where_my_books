import { Tabs } from 'expo-router';
import { colors } from '@where-my-books/ui';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.forest, tabBarInactiveTintColor: colors.inkMuted, tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.border, height: 70, paddingBottom: 10, paddingTop: 8 } }}>
    <Tabs.Screen name="index" options={{ title: 'Главная' }} />
    <Tabs.Screen name="library" options={{ title: 'Библиотека' }} />
    <Tabs.Screen name="add" options={{ title: 'Добавить' }} />
    <Tabs.Screen name="stats" options={{ title: 'Статистика' }} />
    <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
  </Tabs>;
}
