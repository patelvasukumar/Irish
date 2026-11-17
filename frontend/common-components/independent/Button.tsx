import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  small?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary, pressed: colors.primaryDark },
  secondary: { bg: colors.surface, fg: colors.primaryDark, border: colors.primary, pressed: colors.primaryTint },
  ghost: { bg: 'transparent', fg: colors.primaryDark, border: 'transparent', pressed: colors.primaryTint },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger, pressed: colors.dangerSoft },
};

/** Default button. Platforms may override it (see platforms/<name>/dependent/overrides.tsx). */
export function Button({
  title,
  variant = 'primary',
  icon,
  loading,
  small,
  fullWidth,
  disabled,
  ...rest
}: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        fullWidth && styles.fullWidth,
        { backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={small ? 15 : 18} color={v.fg} />
        ) : null}
        <Text style={[styles.label, small && styles.labelSmall, { color: v.fg }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  small: { minHeight: 34, paddingHorizontal: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: font.body, fontWeight: '600' },
  labelSmall: { fontSize: font.small },
  disabled: { opacity: 0.5 },
});
