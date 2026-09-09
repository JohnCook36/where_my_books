import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import styled from '@emotion/native';

import { colors, motion, radii } from '../tokens';

interface ReadingProgressBarProps {
  value: number;
  label?: string;
}

const Row = styled.View({
  alignItems: 'center',
  flexDirection: 'row',
  gap: 10,
});

const Track = styled.View({
  backgroundColor: colors.surfaceRecessed,
  borderRadius: radii.full,
  flex: 1,
  height: 8,
  overflow: 'hidden',
});

const Fill = styled(Animated.View)({
  backgroundColor: colors.amber,
  borderRadius: radii.full,
  height: '100%',
});

const Label = styled.Text({
  color: colors.inkSecondary,
  fontSize: 12,
  fontWeight: '700',
  minWidth: 48,
  textAlign: 'right',
});

const clampProgress = (value: number) => Math.min(Math.max(value, 0), 1);

export const ReadingProgressBar = ({ value, label }: ReadingProgressBarProps) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(clampProgress(value));

  useEffect(() => {
    progress.value = withTiming(clampProgress(value), {
      duration: motion.duration.normal,
    });
  }, [progress, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: trackWidth * progress.value,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <Row>
      <Track onLayout={handleLayout}>
        <Fill style={animatedStyle} />
      </Track>
      {label ? <Label>{label}</Label> : null}
    </Row>
  );
};
