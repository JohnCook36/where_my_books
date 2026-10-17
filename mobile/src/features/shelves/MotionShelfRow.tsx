import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, ReduceMotion, withDelay, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { formatReadingProgress, getReadingProgressRatio, shelfDropIndex, shelfNeighborShift, type LibraryBookResponse, type ProgressDisplayMode, type ShelfTheme } from '@where-my-books/shared';
import { BookSpine } from '@/components';
import { motion, radii, shelfVisuals } from '@/theme';
import { useMotionPreference } from '../../hooks/useMotionPreference';
type Slot = { x: number; width: number; height: number; center: number };
const buzz = () => { void Haptics.selectionAsync().catch(() => {}); };
export function MotionShelfRow({ books, mode, selectedId, theme, disabled, onSelect, onReorder }: { books: LibraryBookResponse[]; mode: ProgressDisplayMode; selectedId: string | undefined; theme: ShelfTheme; disabled: boolean; onSelect: (id: string) => void; onReorder: (from: number, to: number) => void }) {
  const reduced = useMotionPreference(); const from = useSharedValue(-1); const over = useSharedValue(-1); const draggedWidth = useSharedValue(0);
  const slots = useMemo(() => {
    const result: Slot[] = []; let x = 0;
    for (const book of books) {
      const width = Math.max(shelfVisuals.bookMinWidth, Math.min(shelfVisuals.bookMaxWidth, book.spineWidth));
      result.push({ x, width, height: Math.max(shelfVisuals.bookMinHeight, Math.min(shelfVisuals.bookMaxHeight, book.spineHeight)), center: x + width / 2 });
      x += width + shelfVisuals.bookGap;
    }
    return result;
  }, [books]);
  const centers = slots.map((slot) => slot.center); const palette = shelfVisuals.themes[theme];
  const width = slots.length ? slots[slots.length - 1]!.x + slots[slots.length - 1]!.width + shelfVisuals.bookGap : shelfVisuals.bookMinWidth;
  return <View style={{ backgroundColor: palette.background, paddingTop: shelfVisuals.headroom, borderRadius: radii.lg, borderWidth: shelfVisuals.frameBorder, borderColor: palette.lip, overflow: 'hidden' }}>
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }}><View style={{ width, height: shelfVisuals.bookMaxHeight + shelfVisuals.headroom }}>
      {books.map((book, index) => <DraggableSpine key={book.id} book={book} index={index} slot={slots[index]!} centers={centers} from={from} over={over} draggedWidth={draggedWidth} reduced={reduced} disabled={disabled} active={selectedId === book.id} mode={mode} onSelect={onSelect} onReorder={onReorder} />)}
    </View></ScrollView><View style={{ height: shelfVisuals.railHeight, backgroundColor: palette.rail, borderTopWidth: shelfVisuals.railLip, borderTopColor: palette.lip }} />
  </View>;
}
function DraggableSpine({ book, index, slot, centers, from, over, draggedWidth, reduced, disabled, active, mode, onSelect, onReorder }: { book: LibraryBookResponse; index: number; slot: Slot; centers: number[]; from: SharedValue<number>; over: SharedValue<number>; draggedWidth: SharedValue<number>; reduced: boolean; disabled: boolean; active: boolean; mode: ProgressDisplayMode; onSelect: (id: string) => void; onReorder: (from: number, to: number) => void }) {
  const tapBlocked = useSharedValue(0);
  const baseX = useSharedValue(slot.x); const dragX = useSharedValue(0); const lifted = useSharedValue(0); const moving = useSharedValue(false);
  useEffect(() => { baseX.set(reduced ? slot.x : withSpring(slot.x, motion.spring.shelf)); }, [baseX, reduced, slot.x]);
  const pan = Gesture.Pan().enabled(!disabled).maxPointers(1).minDistance(0).activateAfterLongPress(motion.shelf.longPressMs)
    .onStart(() => { tapBlocked.set(1); moving.set(true); from.set(index); over.set(index); draggedWidth.set(slot.width + shelfVisuals.bookGap); lifted.set(reduced ? 0 : withSpring(1, motion.spring.press)); scheduleOnRN(buzz); })
    .onUpdate((event) => { dragX.set(event.translationX); over.set(shelfDropIndex(centers, slot.center + event.translationX)); })
    .onEnd((_event, success) => { const target = over.get(); if (success && target !== index && target >= 0) scheduleOnRN(onReorder, index, target); })
    .onFinalize(() => { if (moving.get()) tapBlocked.set(withDelay(motion.duration.fast, withTiming(0, { duration: 0 }), ReduceMotion.Never)); moving.set(false); from.set(-1); over.set(-1); dragX.set(reduced ? 0 : withSpring(0, motion.spring.shelf)); lifted.set(reduced ? 0 : withSpring(0, motion.spring.shelf)); });
  const gap = useDerivedValue(() => { const shift = shelfNeighborShift(index, from.get(), over.get(), draggedWidth.get()); return reduced ? shift : withSpring(shift, motion.spring.shelf); });
  const style = useAnimatedStyle(() => {
    return { zIndex: moving.get() ? 10 : active ? 2 : 0, transform: [{ translateX: baseX.get() + dragX.get() + gap.get() }, { translateY: -lifted.get() * motion.shelf.dragLift }, { scale: reduced ? 1 : 1 + lifted.get() * (motion.shelf.dragScale - 1) }] };
  });
  return <GestureDetector gesture={pan}><Animated.View collapsable={false} {...(reduced ? {} : { entering: FadeIn.duration(motion.duration.normal), exiting: FadeOut.duration(motion.duration.fast) })} style={[{ position: 'absolute', bottom: 0 }, style]}><BookSpine title={book.work.title} color={book.spineColor} width={slot.width} height={slot.height} active={active && !disabled} progress={getReadingProgressRatio(book.progress)} progressLabel={formatReadingProgress(book.progress, mode)} disabled={disabled} onPress={() => { if (tapBlocked.get() === 0) { onSelect(book.id); buzz(); } }} /></Animated.View></GestureDetector>;
}
