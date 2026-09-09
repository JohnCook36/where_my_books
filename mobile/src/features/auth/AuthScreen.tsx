import styled from '@emotion/native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { colors, spacing, typography } from '@where-my-books/ui';
import { PillButton, ScreenContainer, ScreenContent } from '@where-my-books/ui/native';
import { useAuth } from './AuthProvider';

const Title = styled.Text({ color: colors.ink, ...typography.display, marginBottom: spacing.sm });
const Hint = styled.Text({ color: colors.inkSecondary, ...typography.body, marginBottom: spacing.xl });
const Field = styled(TextInput)({ backgroundColor: colors.paper, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, padding: spacing.md, marginBottom: spacing.md });
const ErrorText = styled.Text({ color: colors.burgundy, ...typography.label, marginBottom: spacing.md });
const Link = styled.Text({ color: colors.forest, ...typography.label, textAlign: 'center', marginTop: spacing.lg });

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter(); const auth = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await (mode === 'login' ? auth.login(email, password) : auth.register(email, password)); router.replace('/(tabs)'); } catch { /* error is shown by the provider */ } finally { setBusy(false); } };
  return <ScreenContainer><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScreenContent><Title>{mode === 'login' ? 'С возвращением' : 'Создай библиотеку'}</Title><Hint>{mode === 'login' ? 'Войди, чтобы увидеть свою полку.' : 'Регистрация займёт меньше минуты.'}</Hint><Field autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.inkMuted} value={email} onChangeText={setEmail} /><Field secureTextEntry placeholder="Пароль (минимум 8 символов)" placeholderTextColor={colors.inkMuted} value={password} onChangeText={setPassword} />{auth.error ? <ErrorText>{auth.error}</ErrorText> : null}<PillButton label={busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'} disabled={busy || !email || password.length < 8} onPress={submit} /><Link onPress={() => router.replace(mode === 'login' ? '/auth/register' : '/auth/login')}>{mode === 'login' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}</Link></ScreenContent></KeyboardAvoidingView></ScreenContainer>;
}
