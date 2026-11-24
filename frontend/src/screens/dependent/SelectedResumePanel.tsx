/** Tailor tab -> "Selected resume": the resume of the application on screen. */
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ChipRow, colors, font, Muted, radius, spacing } from '@common/dependent';

import { resumeMeta } from '../independent/applicationCards';
import type { ResumeChoice } from './ResumePickerDialog';

export function SelectedResumePanel({
  choice,
  forText,
  loading,
  onChoose,
}: {
  choice: ResumeChoice | null;
  forText: string;
  loading: boolean;
  onChoose: () => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={styles.forLine}>
        Application: <Text style={styles.forStrong}>{forText}</Text>
      </Text>

      {loading ? (
        <Muted>Opening the application…</Muted>
      ) : choice ? (
        <>
          <View style={styles.selected}>
            <View style={styles.icon}>
              <Ionicons
                name={choice.kind === 'profile' ? 'person-outline' : 'document-text-outline'}
                size={22}
                color={colors.primaryDark}
              />
            </View>
            <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
              <Text style={styles.name} numberOfLines={2}>
                {choice.kind === 'profile' ? 'My profile' : choice.resume.name}
              </Text>
              <Muted>
                {choice.kind === 'profile' ? resumeMeta('profile') : resumeMeta(choice.source, choice.resume)}
              </Muted>
            </View>
            <Button title="Change resume" variant="secondary" icon="swap-horizontal" small onPress={onChoose} />
          </View>
          {choice.kind === 'resume' ? (
            choice.resume.analysis.skills.length ? (
              <ChipRow>
                {choice.resume.analysis.skills.map((s) => (
                  <Chip key={s} label={s} />
                ))}
              </ChipRow>
            ) : (
              <Muted>No known skills found.</Muted>
            )
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <View style={[styles.icon, { backgroundColor: colors.surface }]}>
            <Ionicons name="document-outline" size={22} color={colors.textMuted} />
          </View>
          <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
            <Text style={styles.name}>No resume chosen for this application yet</Text>
            <Muted>Upload one, reuse one from a submitted application, or use your profile.</Muted>
          </View>
          <Button title="Choose resume" icon="document-attach-outline" onPress={onChoose} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  forLine: { fontSize: font.small, color: colors.textMuted },
  forStrong: { color: colors.text, fontWeight: '700' },
  selected: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primaryTint,
  },
  empty: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: font.h3, fontWeight: '700', color: colors.text },
});
