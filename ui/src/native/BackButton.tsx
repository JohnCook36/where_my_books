import styled from '@emotion/native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors } from '../tokens/colors';
import { radii } from '../tokens/radii';

const Button = styled.Pressable({ alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 });
const Icon = styled.Text({ color: colors.ink, fontSize: 22, lineHeight: 24 });

export const BackButton = () => <Button accessibilityLabel="Назад" onPress={() => { void Haptics.selectionAsync(); router.back(); }}><Icon>‹</Icon></Button>;
