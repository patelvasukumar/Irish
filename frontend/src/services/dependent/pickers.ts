/** File / photo pickers that return the platform-neutral PickedFile shape. */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import type { PickedFile } from '@common/dependent';

const RESUME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

export async function pickResumeFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: RESUME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType, file: a.file ?? null };
}

export async function pickScreenshot(source: 'library' | 'camera'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission was not given.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  const ext = (a.mimeType?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return {
    uri: a.uri,
    name: a.fileName || `posting.${ext}`,
    mimeType: a.mimeType || 'image/jpeg',
    file: a.file ?? null,
  };
}
