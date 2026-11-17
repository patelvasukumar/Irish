import React, { useState } from 'react';

import type { PlatformAdapter } from '@common/independent/PlatformAdapter';
import { colors } from '@common/independent/theme';
import { TextField, TextFieldProps } from '@common/independent/TextField';

import { webDefaultApiUrl, webSaveDownload } from '../independent/webFiles';

/**
 * Web override of TextField: removes the browser's default focus outline and
 * shows the Irish green border instead (keyboard users still see focus).
 */
function WebTextField(props: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextField
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        // outlineStyle is a react-native-web style
        { outlineStyle: 'none' } as object,
        focused && { borderColor: colors.primary, borderWidth: 2 },
        props.style,
      ]}
    />
  );
}

export const platform: PlatformAdapter = {
  name: 'web',
  defaultApiUrl: webDefaultApiUrl,
  appendFile(form, field, file) {
    if (file.file) form.append(field, file.file as Blob, file.name);
    else throw new Error('The browser did not give access to the picked file.');
  },
  saveDownload: webSaveDownload,
  overrides: { TextField: WebTextField },
};
