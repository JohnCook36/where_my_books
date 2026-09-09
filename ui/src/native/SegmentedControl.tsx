import styled from '@emotion/native';
import * as Haptics from 'expo-haptics';
import { colors } from '../tokens/colors';
import { radii } from '../tokens/radii';

const Root = styled.View({ backgroundColor: colors.surfaceRecessed, borderRadius: radii.full, flexDirection: 'row', padding: 3 });
const Option = styled.Pressable<{ active: boolean }>(({ active }) => ({ backgroundColor: active ? colors.paper : 'transparent', borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 7 }));
const Label = styled.Text<{ active: boolean }>(({ active }) => ({ color: active ? colors.forest : colors.inkMuted, fontSize: 11, fontWeight: '800' }));
export interface SegmentedOption<T extends string> { label: string; value: T }
interface SegmentedControlProps<T extends string> { options: readonly SegmentedOption<T>[]; value: T; onChange: (value: T) => void }
export const SegmentedControl = <T extends string>({ options, value, onChange }: SegmentedControlProps<T>) => <Root>{options.map((option) => <Option active={option.value === value} key={option.value} onPress={() => { onChange(option.value); void Haptics.selectionAsync(); }}><Label active={option.value === value}>{option.label}</Label></Option>)}</Root>;
