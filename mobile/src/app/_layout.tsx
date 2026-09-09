import { ThemeProvider } from '@emotion/react';
import { colors, motion, radii, spacing } from '@where-my-books/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { AuthProvider } from '../features/auth/AuthProvider';

const theme = {
  colors,
  motion,
  radii,
  spacing,
};

export default function RootLayout() {
  const reduceMotion = useReducedMotion() ?? false;
  const appTheme = { ...theme, motion: { ...motion, reduceMotion } };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider theme={appTheme}>
        <AuthProvider><StatusBar style="dark" /><Stack
          screenOptions={{
            animation: reduceMotion ? 'none' : 'fade_from_bottom',
            contentStyle: { backgroundColor: colors.canvas },
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="books/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="shelves/index" options={{ headerShown: false }} />
          <Stack.Screen name="settings/index" options={{ headerShown: false }} />
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        </Stack></AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
