import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewProps } from 'react-native';

import { colors, font, radius, shadow, spacing } from './theme';

export interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Element shown at the right of the title row (e.g. a button). */
  action?: React.ReactNode;
  onPress?: () => void;
  /** Step number shown in a circle (used by the Tailor wizard). */
  step?: number;
  done?: boolean;
}

export function Card({ title, subtitle, icon, action, onPress, step, done, style, children, ...rest }: CardProps) {
  const header =
    title || action ? (
      <View style={styles.header}>
        {step !== undefined ? (
          <View style={[styles.step, done && styles.stepDone]}>
            {done ? (
              <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.stepText}>{step}</Text>
            )}
          </View>
        ) : icon ? (
          <Ionicons name={icon} size={20} color={colors.primary} />
        ) : null}
        <View style={styles.titleBox}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
    ) : null;

  const body = (
    <>
      {header}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style as object]}
        {...rest}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style]} {...rest}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  pressed: { backgroundColor: colors.primaryTint },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleBox: { flex: 1, gap: 2 },
  title: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: font.small, color: colors.textMuted },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDone: { backgroundColor: colors.primary },
  stepText: { color: colors.primary, fontWeight: '700' },
});
