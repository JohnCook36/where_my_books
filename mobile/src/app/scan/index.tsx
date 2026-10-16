import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import styled from '@emotion/native';
import { isbn13 } from '@where-my-books/shared';
import { AppHeader, PillButton, ScreenContainer, ScreenContent, ScreenScroll } from '@/components';
import { colors, radii, spacing } from '@/theme';
import { api } from '../../api/client';
import { Note, Row } from '../../features/catalog/styles';

const Camera = styled(CameraView)({ height: spacing.xxl * 7, borderRadius: radii.lg, overflow: 'hidden' });
const Frame = styled.View({ position: 'absolute', top: '30%', left: '10%', width: '80%', height: '40%', borderWidth: 2, borderColor: colors.white, borderRadius: radii.md });
export default function ScanScreen() {
  const { bulk } = useLocalSearchParams<{ bulk?: string }>(); const router = useRouter(); const [focused, setFocused] = useState(false);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false); const [active, setActive] = useState(true);
  const [message, setMessage] = useState('Наведите камеру на книжный штрихкод 978 или 979.');
  const [count, setCount] = useState(0); const [failed, setFailed] = useState(false);
  const locked = useRef(false); const seen = useRef(new Set<string>());
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { void api.scanDrafts().then(({ drafts }) => { setCount(drafts.length); seen.current = new Set(drafts.map((draft) => draft.isbn)); }).catch(() => setMessage('Не удалось загрузить очередь. Проверьте соединение.')); }, []);
  useEffect(() => { const subscription = AppState.addEventListener('change', (state) => { setActive(state === 'active'); if (state === 'active') void getPermission(); }); return () => subscription.remove(); }, [getPermission]);
  const scanned = async ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    const isbn = isbn13(data);
    if (!isbn) { setMessage('Этот код не является корректным ISBN. Наведите камеру на другой штрихкод или введите ISBN вручную.'); return; }
    if (seen.current.has(isbn)) { setMessage('Этот ISBN уже находится в очереди. Подтвердите его на экране очереди.'); return; }
    locked.current = true;
    try {
      const draft = await api.addScanDraft(isbn); seen.current.add(isbn); setCount((value) => value + 1);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (bulk === '1') setMessage(`ISBN ${isbn} сохранён в очередь. Сканируйте следующую книгу.`);
      else router.replace({ pathname: '/scan/review', params: { isbn, draftId: draft.id } });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить код. Повторите сканирование после восстановления сети.'); }
    finally { locked.current = false; }
  };
  return <ScreenContainer><ScreenScroll><ScreenContent><PillButton label="Назад" variant="secondary" onPress={() => router.back()} /><AppHeader title={bulk === '1' ? 'Сканировать партию' : 'Сканировать книгу'} subtitle="Коды и подтверждённые экземпляры хранятся на сервере" />
    {Platform.OS === 'web' ? <Note>Для камеры используйте приложение Android или iOS. ISBN можно ввести вручную.</Note> : !permission?.granted ? <><Note>Для сканирования требуется доступ к камере.</Note><PillButton label={permission?.canAskAgain === false ? 'Открыть настройки камеры' : 'Разрешить камеру'} onPress={() => void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission())} /></> : focused && active && !failed ? <Camera facing="back" autofocus="off" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ['ean13'] }} onBarcodeScanned={(event) => void scanned(event)} onMountError={() => { setFailed(true); setMessage('Камера недоступна. Закройте другие приложения или используйте ручной ввод.'); }}><Frame pointerEvents="none" /></Camera> : failed ? <PillButton label="Повторить запуск камеры" onPress={() => setFailed(false)} /> : null}
    <Note accessibilityLiveRegion="polite">{message}</Note><Row>{permission?.granted && Platform.OS !== 'web' ? <PillButton label={torch ? 'Выключить фонарик' : 'Включить фонарик'} variant="secondary" onPress={() => setTorch((value) => !value)} /> : null}<PillButton label={`Очередь: ${count}`} onPress={() => router.push('/scan/queue')} /><PillButton label="Ввести ISBN / добавить вручную" variant="secondary" onPress={() => router.replace('/(tabs)/add')} /></Row>
  </ScreenContent></ScreenScroll></ScreenContainer>;
}
