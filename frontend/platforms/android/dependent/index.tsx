import React from 'react';

import { Button, ButtonProps } from '@common/independent/Button';
import type { PlatformAdapter } from '@common/independent/PlatformAdapter';
import { colors } from '@common/independent/theme';

import {
  laptopHostFromExpo,
  nativeAppendFile,
  nativeSaveDownload,
} from '../../shared-native/independent/nativeFiles';

/**
 * Android override of Button: adds the Material ripple effect on press.
 * android_ripple only works on Android, so it lives in this folder.
 */
function AndroidButton(props: ButtonProps) {
  const ripple = props.variant === 'primary' || !props.variant ? colors.primaryDark : colors.primarySoft;
  return <Button android_ripple={{ color: ripple, foreground: true }} {...props} />;
}

export const platform: PlatformAdapter = {
  name: 'android',
  // 10.0.2.2 is how the Android emulator reaches the laptop's localhost.
  defaultApiUrl: () => laptopHostFromExpo() ?? 'http://10.0.2.2:8000',
  appendFile: nativeAppendFile,
  saveDownload: nativeSaveDownload,
  overrides: { Button: AndroidButton },
};
