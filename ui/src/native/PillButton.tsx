import { useCallback } from 'react';
import type { PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import styled from '@emotion/native';

import { colors, motion, radii, spacing } from '../tokens';

type PillButtonVariant = 'primary' | 'secondary';

interface PillButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: PillButtonVariant;
}

const Button = styled.Pressable({
  alignItems: 'center',
  borderRadius: radii.full,
  justifyContent: 'center',
  minHeight: 44,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.sm,
});

const Label = styled.Text({
  fontSize: 14,
  fontWeight: '700',
});

export const PillButton = ({
  label,
  variant = 'primary',
  onPressIn,
  onPressOut,
  style,
  ...props
}: PillButtonProps) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = useCallback(
    (event) => {
      scale.value = withTiming(0.97, { duration: motion.duration.fast });
      onPressIn?.(event);
    },
    [onPressIn, scale],
  );

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = useCallback(
    (event) => {
      scale.value = withSpring(1, motion.spring.press);
      onPressOut?.(event);
    },
    [onPressOut, scale],
  );

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={animatedStyle}>
      <Button
        {...props}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          {
            backgroundColor: isPrimary ? colors.forest : colors.burgundySoft,
            borderColor: isPrimary ? colors.forest : colors.burgundy,
            borderWidth: 1,
          },
          style,
        ]}
      >
        <Label style={{ color: isPrimary ? colors.white : colors.burgundy }}>
          {label}
        </Label>
      </Button>
    </Animated.View>
  );
};
