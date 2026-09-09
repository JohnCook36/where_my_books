import styled from '@emotion/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

export const ScreenContainer = styled(SafeAreaView)({ backgroundColor: colors.canvas, flex: 1 });
export const ScreenScroll = styled.ScrollView({ flex: 1 });
export const ScreenContent = styled.View({ paddingBottom: spacing.xxl, paddingHorizontal: spacing.md, paddingTop: spacing.lg });
