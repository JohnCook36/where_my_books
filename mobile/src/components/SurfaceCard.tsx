import styled from '@emotion/native';

import { colors, radii, spacing } from '../theme';

export const SurfaceCard = styled.View({
  backgroundColor: colors.paper,
  borderColor: colors.border,
  borderRadius: radii.xl,
  borderWidth: 1,
  padding: spacing.lg,
  shadowColor: colors.shelfWoodDark,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 2,
});
