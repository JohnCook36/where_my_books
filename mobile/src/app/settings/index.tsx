import { AppHeader, EmptyState, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';

export default function SettingsScreen() {
  return (
    <ScreenContainer>
      <ScreenContent>
        <AppHeader back title="Настройки" />
        <EmptyState
          title="Настройки приложения"
          message="Сохранение настроек подключим вместе с backend API на Этапе 4."
        />
      </ScreenContent>
    </ScreenContainer>
  );
}
