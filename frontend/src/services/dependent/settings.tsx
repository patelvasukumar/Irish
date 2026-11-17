/**
 * App settings shared by every screen (currently: the backend address).
 * Saved on the device with AsyncStorage (localStorage on web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { platform } from '@common/dependent';

import { ApiClient } from './api';

const KEY = 'irish.apiUrl';

interface SettingsValue {
  apiUrl: string;
  defaultApiUrl: string;
  setApiUrl: (url: string | null) => Promise<void>;
  api: ApiClient;
  ready: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const defaultApiUrl = useMemo(() => platform.defaultApiUrl(), []);
  const [apiUrl, setUrl] = useState(defaultApiUrl);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (saved) setUrl(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setApiUrl = useCallback(
    async (url: string | null) => {
      const clean = url?.trim().replace(/\/+$/, '') || null;
      setUrl(clean ?? defaultApiUrl);
      try {
        if (clean) await AsyncStorage.setItem(KEY, clean);
        else await AsyncStorage.removeItem(KEY);
      } catch {
        // Storage can be blocked (private browsing); the setting still applies for this session.
      }
    },
    [defaultApiUrl],
  );

  const api = useMemo(() => new ApiClient(apiUrl), [apiUrl]);
  const value = useMemo(
    () => ({ apiUrl, defaultApiUrl, setApiUrl, api, ready }),
    [apiUrl, defaultApiUrl, setApiUrl, api, ready],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** Shortcut used by screens. */
export function useApi(): ApiClient {
  return useSettings().api;
}
