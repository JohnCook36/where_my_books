import { coverStyles, type CoverStyle } from '@where-my-books/shared';
import { BookCover } from './BookCover';
import { Choice, Note, Row } from './styles';
const labels: Record<CoverStyle, string> = { parchment: 'Пергамент', forest: 'Лесная', burgundy: 'Бордовая', midnight: 'Полночь' };
export function CoverStylePicker({ value, title, author, disabled, onChange }: { value: CoverStyle; title: string; author?: string | undefined; disabled?: boolean; onChange: (value: CoverStyle) => void }) {
  return <><Note>Стиль типографической обложки</Note><Row>{coverStyles.map((style) => <Choice key={style} accessibilityRole="radio" accessibilityLabel={labels[style]} accessibilityState={{ checked: value === style, disabled: !!disabled }} disabled={disabled} onPress={() => onChange(style)}><BookCover mode="placeholder" coverStyle={style} title={title} author={author} /><Note>{value === style ? '✓ ' : ''}{labels[style]}</Note></Choice>)}</Row></>;
}
