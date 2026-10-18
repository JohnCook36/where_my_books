import styled from '@emotion/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { PillButton, ScreenContainer, ScreenContent } from '@/components';
import { colors, radii, spacing, typography } from '@/theme';
import { api } from '../../api/client';

const Title = styled.Text({ color: colors.ink, ...typography.display, marginBottom: spacing.sm });
const Hint = styled.Text({ color: colors.inkSecondary, ...typography.body, marginBottom: spacing.lg });
const Field = styled(TextInput)({ backgroundColor: colors.paper, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.ink, padding: spacing.md, marginBottom: spacing.md });
const ErrorText = styled.Text({ color: colors.burgundy, ...typography.label, marginBottom: spacing.md });

export default function PasswordResetScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!token || password.length < 8 || confirm !== password) { setError('Проверьте пароль и его подтверждение (минимум 8 символов)'); return; }
    setBusy(true); setError('');
    try {
      await api.confirmPasswordReset(token, password);
      setPassword(''); setConfirm('');
      setComplete(true);
      // Drop the secret query parameter from navigation history.
      router.replace('/auth/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ссылка истекла или уже использована');
    } finally { setBusy(false); }
  };
  return <ScreenContainer><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScreenContent>
    <Title>Новый пароль</Title>
    <Hint>{complete ? 'Пароль изменён. Войдите снова на всех устройствах.' : 'Задайте новый пароль. Все ранее открытые сеансы будут завершены.'}</Hint>
    {!token ? <ErrorText>Ссылка недействительна. Запросите новую ссылку на странице входа.</ErrorText> : null}
    {!complete && !!token ? <>
      <Field accessibilityLabel="Новый пароль" secureTextEntry autoCapitalize="none" placeholder="Новый пароль (8–128 символов)" placeholderTextColor={colors.inkMuted} value={password} onChangeText={setPassword} />
      <Field accessibilityLabel="Подтвердите пароль" secureTextEntry autoCapitalize="none" placeholder="Подтвердите пароль" placeholderTextColor={colors.inkMuted} value={confirm} onChangeText={setConfirm} />
      <PillButton label={busy ? 'Сохраняем…' : 'Изменить пароль'} disabled={busy || password.length < 8 || password.length > 128 || password !== confirm} onPress={() => void submit()} />
    </> : null}
    {error ? <ErrorText>{error}</ErrorText> : null}
    <PillButton label="Вернуться ко входу" variant="secondary" onPress={() => router.replace('/auth/login')} />
  </ScreenContent></KeyboardAvoidingView></ScreenContainer>;
}
