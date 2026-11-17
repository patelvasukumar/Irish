/**
 * File helpers shared by Android and iOS (both use expo-file-system + sharing).
 */
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { PickedFile } from '@common/independent/PlatformAdapter';

/**
 * When running in Expo Go / a dev build, the phone loads JS from the laptop.
 * The backend runs on the same laptop, so reuse that IP with port 8000.
 */
export function laptopHostFromExpo(): string | null {
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:8000` : null;
}

export function nativeAppendFile(form: FormData, field: string, file: PickedFile): void {
  // React Native's FormData accepts { uri, name, type } objects for files.
  form.append(field, {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
}

export async function nativeSaveDownload(url: string, fileName: string): Promise<void> {
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  const downloaded = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloaded.uri, { dialogTitle: fileName });
  } else {
    throw new Error(`Saved to ${downloaded.uri} (sharing is not available on this device).`);
  }
}
