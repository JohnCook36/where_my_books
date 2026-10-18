import { useState } from 'react';
import { Image, Linking, Modal, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { coverCrop, type CoverAssetResponse, type UserCoverSource } from '@where-my-books/shared';
import { PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { colors, media } from '@/theme';
import { api } from '../../api/client';
import { Note, Row } from './styles';
type Photo = { uri: string; width: number; height: number; source: UserCoverSource };
export function UserCoverEditor({ disabled, onSelected, onBusy }: { disabled?: boolean; onSelected: (asset: CoverAssetResponse) => void; onBusy?: (busy: boolean) => void }) {
  const [photo, setPhoto] = useState<Photo>(); const [original, setOriginal] = useState<Photo>();
  const [error, setError] = useState(''); const [denied, setDenied] = useState(false); const [busy, setBusy] = useState(false);
  const [aspect, setAspect] = useState<number | null>(2 / 3); const [zoom, setZoom] = useState(1); const [x, setX] = useState(0.5); const [y, setY] = useState(0.5); const [viewport, setViewport] = useState(0);
  const resetCrop = () => { setZoom(1); setX(0.5); setY(0.5); };
  const lock = (value: boolean) => { setBusy(value); onBusy?.(value); };
  const pick = async (source: UserCoverSource) => {
    lock(true); setError(''); setDenied(false);
    try {
      const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setDenied(true); throw new Error(source === 'camera' ? 'Разрешите доступ к камере, чтобы сфотографировать обложку.' : 'Разрешите доступ к фотографиям, чтобы выбрать обложку.'); }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) { const asset = result.assets[0]; const selected = { uri: asset.uri, width: asset.width, height: asset.height, source }; setOriginal(selected); setPhoto(selected); resetCrop(); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось открыть изображение. Повторите выбор.'); } finally { lock(false); }
  };
  const rotate = async () => {
    if (!photo) return; lock(true); setError('');
    try { const context = ImageManipulator.manipulate(photo.uri); context.rotate(90); const image = await context.renderAsync(); const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 }); setPhoto({ ...photo, uri: result.uri, width: result.width, height: result.height }); resetCrop(); }
    catch { setError('Не удалось повернуть фото. Выберите изображение повторно.'); } finally { lock(false); }
  };
  const save = async () => {
    if (!photo) return; lock(true); setError('');
    try {
      const crop = coverCrop(photo.width, photo.height, aspect, zoom, x, y);
      const context = ImageManipulator.manipulate(photo.uri); context.crop(crop);
      if (crop.width > 1200 || crop.height > 1800) context.resize(crop.width / crop.height > 1200 / 1800 ? { width: 1200 } : { height: 1800 });
      const image = await context.renderAsync(); const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      const asset = await api.uploadCover(result.uri, photo.source); onSelected(asset); setPhoto(undefined); setOriginal(undefined);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить фото. Изображение осталось открытым — повторите попытку.'); } finally { lock(false); }
  };
  const crop = photo ? coverCrop(photo.width, photo.height, aspect, zoom, x, y) : null;
  const scale = photo && viewport ? Math.min(viewport / photo.width, media.coverEditorHeight / photo.height) : 0;
  return <><Row><PillButton label="Фото из галереи" variant="secondary" disabled={disabled || busy} onPress={() => void pick('gallery')} /><PillButton label="Сфотографировать обложку" variant="secondary" disabled={disabled || busy} onPress={() => void pick('camera')} /></Row>
    {!photo && error ? <Note accessibilityRole="alert">{error}</Note> : null}{denied ? <PillButton label="Открыть настройки разрешений" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
    <Modal visible={!!photo} animationType="none" onRequestClose={() => { if (!busy) { setPhoto(undefined); setError(''); } }}><ScreenContainer><ScreenScroll><ScreenContent>
      <Note>Обрежьте и выровняйте обложку. Фото сохранится после нажатия «Использовать фото».</Note>
      <View style={{ height: media.coverEditorHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }} onLayout={(event) => setViewport(event.nativeEvent.layout.width)}>
        {photo ? <Image source={{ uri: photo.uri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessibilityLabel="Предпросмотр фотографии обложки" /> : null}
        {photo && crop && scale ? <View pointerEvents="none" style={{ position: 'absolute', left: (viewport - photo.width * scale) / 2 + crop.originX * scale, top: (media.coverEditorHeight - photo.height * scale) / 2 + crop.originY * scale, width: crop.width * scale, height: crop.height * scale, borderWidth: media.cropBorderWidth, borderColor: colors.burgundy }} /> : null}
      </View>
      <Row>{[{ label: 'Книжный формат', ratio: 2 / 3 }, { label: 'Квадрат', ratio: 1 }, { label: 'Всё фото', ratio: null }].map(({ label, ratio }) => <PillButton key={label} label={label} variant={aspect === ratio ? 'primary' : 'secondary'} disabled={busy} onPress={() => { setAspect(ratio); resetCrop(); }} />)}</Row>
      <Row><PillButton label="Увеличить" disabled={busy || zoom >= 4} onPress={() => setZoom(Math.min(4, zoom + 0.25))} /><PillButton label="Уменьшить" disabled={busy || zoom <= 1} onPress={() => setZoom(Math.max(1, zoom - 0.25))} /><PillButton label="Повернуть на 90°" disabled={busy} onPress={() => void rotate()} /></Row>
      <Row><PillButton label="Кадр левее" disabled={busy || x <= 0} onPress={() => setX(Math.max(0, x - 0.1))} /><PillButton label="Кадр правее" disabled={busy || x >= 1} onPress={() => setX(Math.min(1, x + 0.1))} /><PillButton label="Кадр выше" disabled={busy || y <= 0} onPress={() => setY(Math.max(0, y - 0.1))} /><PillButton label="Кадр ниже" disabled={busy || y >= 1} onPress={() => setY(Math.min(1, y + 0.1))} /></Row>
      <PillButton label="Сбросить обработку" variant="secondary" disabled={busy} onPress={() => { setPhoto(original); resetCrop(); }} />
      {error ? <Note accessibilityRole="alert">{error}</Note> : null}
      <PillButton label={busy ? 'Обрабатываем фото…' : 'Использовать фото'} disabled={busy} onPress={() => void save()} />
      <PillButton label="Отмена" variant="secondary" disabled={busy} onPress={() => { setPhoto(undefined); setError(''); }} />
    </ScreenContent></ScreenScroll></ScreenContainer></Modal></>;
}
