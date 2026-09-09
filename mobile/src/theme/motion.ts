export const motion = {
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
