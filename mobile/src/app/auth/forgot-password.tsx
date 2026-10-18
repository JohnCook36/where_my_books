import styled from '@emotion/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { PillButton, ScreenContainer, ScreenContent } from '@/components';
import { colors, radii, spacing, typography } from '@/theme';
import { api } from '../../api/client';

const Title = styled.Text({ color: colors.ink, ...typography.display, marginBottom: spacing.sm });
const Hint = styled.Text({ color: colors.inkSecondary, ...typography.body, marginBottom: spacing.lg });
const Field = styled(TextInput)({ backgroundColor: colors.paper, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.ink, padding: spacing.md, marginBottom: spacing.md });
const Error = styled.Text({ color: colors.burgundy, ...typography.label, marginBottom: spacing.md });

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить запрос');
    } finally { setBusy(false); }
  };
  return <ScreenContainer><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScreenContent>
    <Title>Восстановление доступа</Title>
    <Hint>{sent ? 'Если такой аккаунт существует, письмо с одноразовой ссылкой будет отправлено. Проверьте почту.' : 'Укажите email аккаунта. Ссылка для смены пароля действует 15 минут.'}</Hint>
    {!sent ? <><Field accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.inkMuted} value={email} onChangeText={setEmail} /><PillButton label={busy ? 'Отправляем…' : 'Получить ссылку'} disabled={busy || !email.includes('@')} onPress={() => void submit()} /></> : null}
    {error ? <Error>{error}</Error> : null}
    <PillButton variant="secondary" label="Вернуться ко входу" onPress={() => router.replace('/auth/login')} />
  </ScreenContent></KeyboardAvoidingView></ScreenContainer>;
}
