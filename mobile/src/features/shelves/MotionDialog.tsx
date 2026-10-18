import { useEffect, type PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppHeader, PillButton } from '@/components';
import { colors, motion, radii, shelfVisuals, spacing } from '@/theme';
import { useMotionPreference } from '../../hooks/useMotionPreference';
export function MotionDialog({ visible, title, onClose, children, busy = false, scroll = true }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void; busy?: boolean; scroll?: boolean }>) {
  const reduced = useMotionPreference(); const open = useSharedValue(0);
  useEffect(() => { open.set(reduced ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: motion.duration.normal })); }, [open, reduced, visible]);
  const style = useAnimatedStyle(() => ({ opacity: reduced ? 1 : open.get(), transform: [{ translateY: reduced ? 0 : (1 - open.get()) * motion.shelf.sheetOffset }] }));
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => { if (!busy) onClose(); }}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: shelfVisuals.backdrop }} accessibilityViewIsModal>
    <Pressable accessibilityLabel="Закрыть окно" style={{ flex: 1 }} disabled={busy} onPress={onClose} />
    <Animated.View style={[{ maxHeight: shelfVisuals.dialogMaxHeight, backgroundColor: colors.canvas, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.md, paddingBottom: spacing.xl }, style]}>
      <AppHeader title={title} />{scroll ? <ScrollView keyboardShouldPersistTaps="handled">{children}<PillButton label="Закрыть" variant="secondary" disabled={busy} onPress={onClose} /></ScrollView> : <>{children}<PillButton label="Закрыть" variant="secondary" disabled={busy} onPress={onClose} /></>}
    </Animated.View>
  </View></Modal>;
}
