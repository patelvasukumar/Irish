import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from './theme';

export type ChipTone = 'neutral' | 'success' | 'danger' | 'info' | 'warning';

const tones: Record<ChipTone, { fg: string; bg: string; border: string }> = {
  neutral: { fg: colors.text, bg: colors.surface, border: colors.border },
  success: { fg: colors.primaryDark, bg: colors.primarySoft, border: colors.primarySoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft, border: colors.infoSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft, border: colors.warningSoft },
};

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export function Chip({ label, tone = 'neutral', selected, icon, onPress }: ChipProps) {
  const t = selected ? { fg: colors.textOnPrimary, bg: colors.primary, border: colors.primary } : tones[tone];
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </>
  );
  if (!onPress) {
    return <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: t.bg, borderColor: t.border },
        pressed && { opacity: 0.75 },
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Wrapping row of chips. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: font.small, fontWeight: '500' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
