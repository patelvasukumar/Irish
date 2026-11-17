import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, font, radius, spacing } from './theme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Number of visible lines for multiline fields. */
  lines?: number;
}

export function TextField({ label, hint, error, lines, multiline, style, ...rest }: TextFieldProps) {
  const isMulti = multiline || (lines ?? 1) > 1;
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={isMulti}
        textAlignVertical={isMulti ? 'top' : 'center'}
        accessibilityLabel={label}
        style={[
          styles.input,
          isMulti && { minHeight: 22 * (lines ?? 4) + spacing.md * 2 },
          !!error && styles.inputError,
          style,
        ]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, flexGrow: 1 },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    color: colors.text,
    minHeight: 44,
  },
  inputError: { borderColor: colors.danger },
  hint: { fontSize: font.tiny, color: colors.textMuted },
  error: { fontSize: font.tiny, color: colors.danger },
});
