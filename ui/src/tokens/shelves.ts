import { colors } from './colors';
import { spacing } from './spacing';
export const shelfVisuals = {
  dialogMaxHeight: '88%',
  pickerMaxHeight: 360, pickerScreenFraction: 0.45,
  bookGap: spacing.xs, bookMinWidth: 48, bookMaxWidth: 88, bookMinHeight: 136, bookMaxHeight: 208,
  frameBorder: 1, spineHighlightOpacity: 0.12,
  headroom: spacing.xl, railHeight: 20, railLip: 3, selectedBorder: 2,
  shadow: { width: 0, height: 5, opacity: 0.18, radius: 9, elevation: 6 },
  spine: { fontSize: 11, lineHeight: 15, labelSize: 10, border: 'rgba(255,255,255,0.24)' },
  themes: {
    oak: { background: colors.surfaceRecessed, rail: colors.shelfWood, lip: colors.shelfWoodDark },
    ivory: { background: colors.paper, rail: colors.surface, lip: colors.amber },
    night: { background: colors.forestDark, rail: colors.ink, lip: colors.shelfWood },
  },
  backdrop: 'rgba(20,25,23,0.42)',
} as const;
