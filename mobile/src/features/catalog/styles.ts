import styled from '@emotion/native';
import { TextInput } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';

export const Field = styled(TextInput)({ ...typography.body, backgroundColor: colors.paper, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.ink, padding: spacing.md, marginVertical: spacing.xs });
export const Note = styled.Text({ ...typography.body, color: colors.inkSecondary, marginVertical: spacing.sm });
export const Row = styled.View({ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginVertical: spacing.sm });
export const Choice = styled.Pressable({ backgroundColor: colors.paper, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm, marginVertical: spacing.xs });
export const CoverFrame = styled.View({ width: spacing.xxl * 3, height: spacing.xxl * 4, backgroundColor: colors.burgundySoft, borderRadius: radii.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: spacing.sm });
export const CoverTitle = styled.Text({ ...typography.body, fontWeight: '700', color: colors.burgundy, textAlign: 'center' });
export const CoverImage = styled.Image({ width: '100%', height: '100%' });
export const PreviewImage = styled.Image({ width: '100%', height: spacing.xxl * 9 });
