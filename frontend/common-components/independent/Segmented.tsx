import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from './theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Small count shown after the label (e.g. number of applications). */
  badge?: number | string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && styles.active]}
          >
            {o.icon ? (
              <Ionicons name={o.icon} size={15} color={active ? colors.primaryDark : colors.textMuted} />
            ) : null}
            <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>
              {o.label}
            </Text>
            {o.badge !== undefined ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  active: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft },
  label: { fontSize: font.small, color: colors.textMuted, fontWeight: '500' },
  activeLabel: { color: colors.primaryDark, fontWeight: '700' },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
  },
  badgeText: { fontSize: font.tiny, fontWeight: '700', color: colors.primaryDark },
});
