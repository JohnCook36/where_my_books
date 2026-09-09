import styled from '@emotion/native';
import type { ReactNode } from 'react';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { BackButton } from './BackButton';

const Wrap = styled.View({ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 });
const TitleWrap = styled.View({ flex: 1 });
const Title = styled.Text({ color: colors.ink, ...typography.heading });
const Subtitle = styled.Text({ color: colors.inkSecondary, ...typography.caption });

interface AppHeaderProps { title: string; subtitle?: string; back?: boolean; rightAction?: ReactNode }
export const AppHeader = ({ title, subtitle, back = false, rightAction }: AppHeaderProps) => <Wrap>{back ? <BackButton /> : null}<TitleWrap><Title>{title}</Title>{subtitle ? <Subtitle>{subtitle}</Subtitle> : null}</TitleWrap>{rightAction}</Wrap>;
