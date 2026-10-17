import { useEffect } from 'react';
import type { PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import styled from '@emotion/native';
import { colors, motion, radii, shelfVisuals, spacing } from '../theme';
import { useMotionPreference } from '../hooks/useMotionPreference';
interface BookSpineProps {
  title: string; color: string; width: number; height: number; progress: number; progressLabel: string;
  active?: boolean; onPress?: PressableProps['onPress']; disabled?: boolean;
}
const Spine = styled.Pressable({ borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm, borderWidth: shelfVisuals.selectedBorder, justifyContent: 'space-between', overflow: 'hidden', paddingHorizontal: spacing.xxs, paddingVertical: spacing.sm });
const Glint = styled.View({ position: 'absolute', top: 0, bottom: 0, left: 0, width: spacing.xxs, backgroundColor: colors.white, opacity: shelfVisuals.spineHighlightOpacity });
const Fill = styled(Animated.View)({ backgroundColor: colors.amberOverlay, bottom: 0, left: 0, position: 'absolute', right: 0 });
const Title = styled.Text({ color: colors.white, fontSize: shelfVisuals.spine.fontSize, fontWeight: '800', lineHeight: shelfVisuals.spine.lineHeight, textAlign: 'center', zIndex: 1 });
const Label = styled.Text({ color: colors.white, fontSize: shelfVisuals.spine.labelSize, fontWeight: '700', textAlign: 'center', zIndex: 1 });
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export function BookSpine({ title, color, width, height, progress: value, progressLabel, active = false, onPress, disabled }: BookSpineProps) {
  const reduced = useMotionPreference(); const fill = useSharedValue(clamp(value)); const lift = useSharedValue(0); const scale = useSharedValue(1); const selectedScale = useSharedValue(1);
  useEffect(() => { fill.set(reduced ? clamp(value) : withTiming(clamp(value), { duration: motion.duration.slow })); }, [fill, reduced, value]);
  useEffect(() => { lift.set(reduced ? 0 : withSpring(active ? -motion.shelf.lift : 0, motion.spring.shelf)); selectedScale.set(reduced ? 1 : withSpring(active ? motion.shelf.selectedScale : 1, motion.spring.shelf)); }, [active, lift, reduced, selectedScale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }, { scale: scale.get() * selectedScale.get() }] }));
  const progressStyle = useAnimatedStyle(() => ({ height: height * fill.get() }));
  return <Animated.View style={[{ shadowColor: colors.shelfWoodDark, shadowOffset: { width: shelfVisuals.shadow.width, height: shelfVisuals.shadow.height }, shadowOpacity: shelfVisuals.shadow.opacity, shadowRadius: shelfVisuals.shadow.radius, elevation: shelfVisuals.shadow.elevation }, animated]}><Spine accessibilityRole="button" accessibilityLabel={`${title}. ${progressLabel}`} accessibilityState={{ selected: active, disabled: !!disabled }} disabled={disabled} onPress={onPress}
    onPressIn={() => scale.set(reduced ? 1 : withTiming(motion.shelf.pressScale, { duration: motion.duration.fast }))}
    onPressOut={() => scale.set(reduced ? 1 : withSpring(1, motion.spring.press))}
    style={{ backgroundColor: color, width, height, borderColor: active ? colors.amber : shelfVisuals.spine.border }}>
    <Glint pointerEvents="none" /><Fill style={progressStyle} /><Title numberOfLines={5}>{title}</Title><Label numberOfLines={2}>{progressLabel}</Label>
  </Spine></Animated.View>;
}
