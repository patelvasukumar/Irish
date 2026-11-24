import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, font, JobStatus, radius, spacing, statusColors } from './theme';

/** Inline message box for errors, warnings, info and success. */
export function Banner({
  tone = 'info',
  message,
  title,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  message: string;
  title?: string;
}) {
  const map = {
    info: { fg: colors.info, bg: colors.infoSoft, icon: 'information-circle' as const },
    warning: { fg: colors.warning, bg: colors.warningSoft, icon: 'warning' as const },
    danger: { fg: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' as const },
    success: { fg: colors.primaryDark, bg: colors.primarySoft, icon: 'checkmark-circle' as const },
  }[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: map.bg }]}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
    >
      <Ionicons name={map.icon} size={18} color={map.fg} />
      <View style={{ flex: 1 }}>
        {title ? <Text style={[styles.bannerTitle, { color: map.fg }]}>{title}</Text> : null}
        <Text style={[styles.bannerText, { color: map.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
  children,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyText}>{message}</Text> : null}
      {children}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.emptyText}>{label}</Text> : null}
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusColors[status as JobStatus] ?? { fg: colors.textMuted, bg: colors.background, icon: 'ellipse' };
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={13} color={s.fg} />
      <Text style={[styles.badgeText, { color: s.fg }]}>{status}</Text>
    </View>
  );
}

/** Circular match score (0-100). Drawn with plain Views so it works everywhere. */
export function ScoreRing({ score, size = 92, label = 'match' }: { score: number; size?: number; label?: string }) {
  const tone = score >= 70 ? colors.primary : score >= 40 ? colors.warning : colors.danger;
  return (
    <View
      accessibilityLabel={`${label} score ${score} percent`}
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: tone },
      ]}
    >
      <Text style={[styles.ringValue, { color: tone }]}>{score}%</Text>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {right}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children, numberOfLines }: { children: React.ReactNode; numberOfLines?: number }) {
  return (
    <Text style={styles.muted} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  bannerTitle: { fontWeight: '700', fontSize: font.small, marginBottom: 2 },
  bannerText: { fontSize: font.small, lineHeight: 19 },
  empty: { alignItems: 'center', padding: spacing.xxl, gap: spacing.sm },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyText: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', maxWidth: 420 },
  loading: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.tiny, fontWeight: '700' },
  ring: { borderWidth: 7, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 22, fontWeight: '800' },
  ringLabel: { fontSize: font.tiny, color: colors.textMuted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  section: {
    fontSize: font.tiny,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  label: { fontSize: font.small, fontWeight: '600', color: colors.text },
  muted: { fontSize: font.small, color: colors.textMuted, lineHeight: 19 },
});
