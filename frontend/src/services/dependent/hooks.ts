import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@common/dependent';

/**
 * Load data every time the screen gets focus (and again whenever `load`
 * changes), with loading / error state and a manual reload.
 *
 * Pass a memoised loader: `useLoader(useCallback(() => api.job(id), [api, id]))`.
 */
export function useLoader<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await load();
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, setData, error, loading, reload };
}

/**
 * Wrap an action (button press): tracks "busy", shows errors as a toast,
 * and returns the result (or undefined if it failed).
 */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const result = await fn();
        if (success) toast(success, 'success');
        return result;
      } catch (e) {
        toast((e as Error).message, 'danger');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  return { busy, run };
}
