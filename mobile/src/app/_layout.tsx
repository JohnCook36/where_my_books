import { ThemeProvider } from '@emotion/react';
import { colors, motion, radii, spacing } from '@where-my-books/ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const theme = {
  colors,
  motion,
  radii,
  spacing,
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider theme={theme}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            animation: 'fade_from_bottom',
            contentStyle: { backgroundColor: colors.canvas },
            headerShown: false,
          }}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
