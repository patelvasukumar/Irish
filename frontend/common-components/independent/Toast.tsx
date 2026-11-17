import Ionicons from '@expo/vector-icons/Ionicons';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, spacing } from './theme';

type ToastTone = 'success' | 'danger' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

/** Small notifications that work the same on web, Android and iOS. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), tone === 'danger' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={styles.host}>
        {items.map((t) => (
          <View key={t.id} style={[styles.toast, styles[t.tone]]} accessibilityLiveRegion="polite">
            <Ionicons
              name={t.tone === 'success' ? 'checkmark-circle' : t.tone === 'danger' ? 'alert-circle' : 'information-circle'}
              size={18}
              color={colors.textOnPrimary}
            />
            <Text style={styles.text}>{t.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 560,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadow,
  },
  success: { backgroundColor: colors.primaryDark },
  danger: { backgroundColor: colors.danger },
  info: { backgroundColor: colors.text },
  text: { color: colors.textOnPrimary, fontSize: font.small, fontWeight: '600', flexShrink: 1 },
});
