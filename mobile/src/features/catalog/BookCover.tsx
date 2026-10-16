import { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { CoverMode, CoverStyle } from '@where-my-books/shared';
import { coverPalettes, spacing } from '@/theme';
import { api } from '../../api/client';
import { useAuth } from '../auth/AuthProvider';
import { CoverFrame, CoverImage, CoverTitle, Note } from './styles';
export function BookCover({ uri, assetId, mode, coverStyle = 'parchment', title, author }: { uri?: string | undefined; assetId?: string | undefined; mode?: CoverMode | undefined; coverStyle?: CoverStyle | undefined; title: string; author?: string | undefined }) {
  const { user } = useAuth();
  const [privateImage, setPrivateImage] = useState<{ key: string; source: ImageSourcePropType }>();
  const [failedKey, setFailedKey] = useState<string>();
  const key = mode === 'custom' ? `${user?.id}:${assetId}` : `${mode}:${uri}`;
  useEffect(() => {
    let active = true; let objectUrl: string | undefined;
    if (mode === 'custom' && assetId && user) void api.coverImageSource(assetId).then((source) => { if (source.uri.startsWith('blob:')) objectUrl = source.uri; if (active) setPrivateImage({ key, source }); else if (objectUrl) URL.revokeObjectURL(objectUrl); }).catch(() => { if (active) setFailedKey(key); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId, key, mode, user]);
  const source = mode === 'placeholder' ? undefined : mode === 'custom' ? privateImage?.key === key ? privateImage.source : undefined : uri ? { uri } : undefined;
  const palette = coverPalettes[coverStyle];
  return <CoverFrame style={{ backgroundColor: palette.background, borderLeftWidth: spacing.xs, borderLeftColor: palette.spine }} accessibilityLabel={`Обложка: ${title}`}>
    {source && failedKey !== key ? <CoverImage source={source} resizeMode="contain" onError={() => setFailedKey(key)} /> : <><CoverTitle numberOfLines={4} style={{ color: palette.foreground }}>{title || 'Новая книга'}</CoverTitle>{author ? <Note numberOfLines={2} style={{ color: palette.foreground }}>{author}</Note> : null}</>}
  </CoverFrame>;
}
