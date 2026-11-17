import type React from 'react';

import type { ButtonProps } from './Button';
import type { CardProps } from './Card';
import type { TextFieldProps } from './TextField';

/** A file the user picked (resume or screenshot), in a platform-neutral shape. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  /** Web only: the browser File object. */
  file?: Blob | null;
}

/**
 * What each platform folder (platforms/web, platforms/android, platforms/ios)
 * must provide. Common components are used unless a platform overrides them.
 */
export interface PlatformAdapter {
  name: 'web' | 'android' | 'ios';
  /** Backend address used when the user has not set one in Settings. */
  defaultApiUrl(): string;
  /** Add a picked file to a multipart form in the way this platform needs. */
  appendFile(form: FormData, field: string, file: PickedFile): void;
  /** Download a file from the backend and save / share it. */
  saveDownload(url: string, fileName: string): Promise<void>;
  /** Optional component overrides for this platform. */
  overrides: {
    Button?: React.ComponentType<ButtonProps>;
    Card?: React.ComponentType<CardProps>;
    TextField?: React.ComponentType<TextFieldProps>;
  };
}
