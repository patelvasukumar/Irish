import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from './theme';

export interface DialogProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Buttons shown at the bottom. */
  footer?: React.ReactNode;
  wide?: boolean;
}

/**
 * Modal dialog used instead of Alert.alert, because Alert does nothing on web.
 */
export function Dialog({ visible, title, onClose, children, footer, wide }: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" />
        <View style={[styles.sheet, wide && styles.wide]} accessibilityViewIsModal>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  wide: { maxWidth: 820 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: font.h2, fontWeight: '700', color: colors.text, flex: 1 },
  body: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
