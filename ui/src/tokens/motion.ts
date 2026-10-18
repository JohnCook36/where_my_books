export const motion = {
  shelf: { lift: 10, dragLift: 22, selectedScale: 1.025, dragScale: 1.045, pressScale: 0.98, longPressMs: 280, sheetOffset: 18 },
  duration: {
    fast: 160,
    normal: 320,
    slow: 520,
  },
  spring: {
    press: {
      damping: 18,
      stiffness: 220,
    },
    shelf: {
      damping: 20,
      stiffness: 170,
    },
  },
} as const;
