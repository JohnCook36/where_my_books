import { colors } from './colors';
export const coverPalettes = {
  parchment: { background: colors.surface, foreground: colors.ink, spine: colors.shelfWood },
  forest: { background: colors.forestDark, foreground: colors.white, spine: colors.amber },
  burgundy: { background: colors.burgundy, foreground: colors.white, spine: colors.amber },
  midnight: { background: colors.ink, foreground: colors.canvas, spine: colors.amber },
} as const;
