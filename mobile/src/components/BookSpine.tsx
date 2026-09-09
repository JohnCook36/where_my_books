import { useEffect } from 'react';
import type { PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import styled from '@emotion/native';

import { colors, motion, radii, spacing } from '../theme';

interface BookSpineProps {
  title: string;
  color: string;
  width: number;
  height: number;
  progress: number;
  progressLabel: string;
  active?: boolean;
  onPress?: PressableProps['onPress'];
}

const Spine = styled.Pressable({
  borderColor: 'rgba(255, 255, 255, 0.24)',
  borderTopLeftRadius: radii.sm,
  borderTopRightRadius: radii.sm,
  borderWidth: 1,
  justifyContent: 'space-between',
  overflow: 'hidden',
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.sm,
  position: 'relative',
  shadowColor: colors.shelfWoodDark,
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 0.14,
  shadowRadius: 3,
  elevation: 2,
});

const ProgressFill = styled(Animated.View)({
  backgroundColor: colors.amberOverlay,
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
});

const Title = styled.Text({
  color: colors.white,
  fontSize: 11,
  fontWeight: '800',
  lineHeight: 14,
  textAlign: 'center',
  zIndex: 1,
});

const ProgressLabel = styled.Text({
  color: colors.white,
  fontSize: 9,
  fontWeight: '800',
  textAlign: 'center',
  zIndex: 1,
});

const clampProgress = (value: number) => Math.min(Math.max(value, 0), 1);

export const BookSpine = ({
  title,
  color,
  width,
  height,
  progress: value,
  progressLabel,
  active = false,
  onPress,
}: BookSpineProps) => {
  const reduceMotion = useReducedMotion() ?? false;
  const progress = useSharedValue(clampProgress(value));
  const scale = useSharedValue(1);
  const translateY = useSharedValue(reduceMotion ? 0 : active ? -6 : 0);

  useEffect(() => {
    const nextProgress = clampProgress(value);
    progress.value = reduceMotion
      ? nextProgress
      : withTiming(nextProgress, { duration: motion.duration.slow });
  }, [progress, reduceMotion, value]);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      return;
    }

    translateY.value = withSpring(active ? -6 : 0, motion.spring.shelf);
  }, [active, reduceMotion, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    height: height * progress.value,
  }));

  return (
    <Animated.View style={containerStyle}>
      <Spine
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design.
          scale.value = reduceMotion
            ? 1
            : withTiming(0.97, { duration: motion.duration.fast });
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design.
          scale.value = reduceMotion ? 1 : withSpring(1, motion.spring.press);
        }}
        style={{
          backgroundColor: color,
          borderColor: active ? colors.amber : 'rgba(255, 255, 255, 0.24)',
          borderWidth: active ? 2 : 1,
          height,
          width,
        }}
      >
        <ProgressFill style={fillStyle} />
        <Title numberOfLines={4}>{title}</Title>
        <ProgressLabel>{progressLabel}</ProgressLabel>
      </Spine>
    </Animated.View>
  );
};
