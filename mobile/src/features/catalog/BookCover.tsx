import { useState } from 'react';
import { CoverFrame, CoverImage, CoverTitle, Note } from './styles';
export function BookCover({ uri, title, author }: { uri?: string | undefined; title: string; author?: string | undefined }) {
  const [failedUri, setFailedUri] = useState<string>();
  return <CoverFrame accessibilityLabel={`Обложка: ${title}`}>
    {uri && failedUri !== uri ? <CoverImage source={{ uri }} resizeMode="contain" onError={() => setFailedUri(uri)} /> : <><CoverTitle>{title || 'Новая книга'}</CoverTitle>{author ? <Note>{author}</Note> : null}</>}
  </CoverFrame>;
}
