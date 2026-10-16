// Expo Router 57 vendors React Navigation. Use the same provider context instead
// of installing a second navigation library. Keep this version-specific import here.
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { useNavigation } from 'expo-router';
import { Alert } from 'react-native';
import type { RefObject } from 'react';

export function useReviewNavigationGuard(dirty: boolean, bypass: RefObject<boolean>, busy: boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (bypass.current) { navigation.dispatch(data.action); return; }
    if (busy) { Alert.alert('Сохранение выполняется', 'Дождитесь результата сохранения, прежде чем выходить.'); return; }
    Alert.alert('Есть несохранённые правки', 'Сохраните черновик перед выходом или оставьте последнюю серверную версию.', [
      { text: 'Остаться', style: 'cancel' },
      { text: 'Выйти без правок', style: 'destructive', onPress: () => { bypass.current = true; navigation.dispatch(data.action); } },
    ]);
  });
}
