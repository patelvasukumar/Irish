/**
 * Tailor tab -> "Application progress": every application not submitted on
 * the job portal yet, as a sideways-scrolling row of cards with "+" first.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, colors, font, Muted, radius, spacing } from '@common/dependent';

import { timeAgo } from '../../services/independent/format';
import type { Application } from '../../services/independent/types';
import { cardInitial, cardSubtitle, cardTitle, progressSummary, stepText } from '../independent/applicationCards';

export function ApplicationProgressPanel({
  apps,
  currentId,
  error,
  onNew,
  onOpen,
  onDelete,
}: {
  apps: Application[] | null;
  currentId: string | null;
  error: string | null;
  onNew: () => void;
  onOpen: (app: Application) => void;
  onDelete: (app: Application) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      {error ? <Banner tone="danger" message={error} /> : <Muted>{apps ? progressSummary(apps) : 'Loading applications…'}</Muted>}

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new application"
          onPress={onNew}
          style={({ pressed }) => [styles.newCard, pressed && { backgroundColor: colors.primaryTint }]}
        >
          <View style={styles.plus}>
            <Ionicons name="add" size={24} color={colors.primaryDark} />
          </View>
          <Text style={styles.newText}>New application</Text>
        </Pressable>

        {(apps ?? []).map((app) => (
          <ApplicationCard
            key={app.id}
            app={app}
            current={app.id === currentId}
            onOpen={() => onOpen(app)}
            onDelete={() => onDelete(app)}
          />
        ))}
      </ScrollView>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={styles.noteText}>
          An application stays here until you mark it submitted on the job portal. Then it moves to the Job Tracker, and
          its resume shows under “From submitted applications” when you choose a resume.
        </Text>
      </View>
    </View>
  );
}

function ApplicationCard({
  app,
  current,
  onOpen,
  onDelete,
}: {
  app: Application;
  current: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const title = cardTitle(app);
  return (
    <View style={[styles.card, current && styles.cardCurrent]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${title}${app.company ? ` at ${app.company}` : ''}`}
        accessibilityState={{ selected: current }}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardBody, pressed && { backgroundColor: colors.primaryTint }]}
      >
        <View style={styles.cardHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{cardInitial(app)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.small} numberOfLines={1}>
              {cardSubtitle(app)}
            </Text>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                { width: `${app.progress}%`, backgroundColor: app.waiting_to_submit ? colors.warning : colors.primary },
              ]}
            />
          </View>
          <View style={styles.stepRow}>
            <Text style={[styles.step, app.waiting_to_submit && styles.waiting]} numberOfLines={1}>
              {stepText(app)}
            </Text>
            {app.match_score != null ? (
              <View style={styles.score}>
                <Text style={styles.scoreText}>{app.match_score}%</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.foot}>
          <View style={styles.footRow}>
            <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
            <Text style={styles.small} numberOfLines={1}>
              {app.resume_name || 'No resume yet'}
            </Text>
          </View>
          <Text style={styles.small}>Updated {timeAgo(app.updated_at)}</Text>
        </View>

        {current ? (
          <View style={styles.openTag}>
            <Text style={styles.openTagText}>Open below</Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${title}`}
        onPress={onDelete}
        hitSlop={6}
        style={({ pressed }) => [styles.delete, pressed && { backgroundColor: colors.dangerSoft }]}
      >
        <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const CARD_HEIGHT = 200;

const styles = StyleSheet.create({
  row: { gap: spacing.md, paddingBottom: spacing.sm, paddingRight: spacing.xs },
  newCard: {
    width: 128,
    minHeight: CARD_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newText: { fontSize: font.small, fontWeight: '700', color: colors.primaryDark, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  noteText: { flex: 1, fontSize: font.small - 1, color: colors.textMuted, lineHeight: 17 },
  card: {
    width: 264,
    minHeight: CARD_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  cardCurrent: { borderWidth: 2, borderColor: colors.primary },
  cardBody: { flex: 1, padding: spacing.md, gap: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingRight: 30 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: font.h3 },
  title: { fontSize: font.body, fontWeight: '700', color: colors.text },
  small: { fontSize: font.small - 1, color: colors.textMuted, flexShrink: 1 },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: radius.pill },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  step: { flexShrink: 1, fontSize: font.small - 1, fontWeight: '600', color: colors.textMuted },
  waiting: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  score: { backgroundColor: colors.primarySoft, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  scoreText: { fontSize: font.small - 1, fontWeight: '700', color: colors.primaryDark },
  foot: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 3 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  openTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  openTagText: { color: colors.textOnPrimary, fontSize: font.tiny, fontWeight: '700' },
  delete: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
