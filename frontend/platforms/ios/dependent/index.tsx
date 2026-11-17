import React from 'react';

import type { PlatformAdapter } from '@common/independent/PlatformAdapter';
import { TextField, TextFieldProps } from '@common/independent/TextField';

import {
  laptopHostFromExpo,
  nativeAppendFile,
  nativeSaveDownload,
} from '../../shared-native/independent/nativeFiles';

/**
 * iOS override of TextField: shows the native "clear" (x) button while typing
 * on single-line fields. clearButtonMode is an iOS-only prop.
 */
function IOSTextField(props: TextFieldProps) {
  const multi = props.multiline || (props.lines ?? 1) > 1;
  return <TextField clearButtonMode={multi ? 'never' : 'while-editing'} {...props} />;
}

export const platform: PlatformAdapter = {
  name: 'ios',
  // The iOS simulator shares the laptop's network, so localhost works there.
  defaultApiUrl: () => laptopHostFromExpo() ?? 'http://localhost:8000',
  appendFile: nativeAppendFile,
  saveDownload: nativeSaveDownload,
  overrides: { TextField: IOSTextField },
};
