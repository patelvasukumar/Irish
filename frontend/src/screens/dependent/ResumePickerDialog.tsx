/**
 * "Choose a resume" popup on the Tailor tab:
 *   - upload a new file
 *   - use the saved profile form
 *   - reuse the resume of a submitted application (same order as the Job Tracker)
 *   - pick a recent upload that has not been submitted with yet
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Chip, colors, Dialog, font, Muted, radius, spacing, useToast } from '@common/dependent';

import { useAction } from '../../services/dependent/hooks';
import { pickResumeFile } from '../../services/dependent/pickers';
import { useApi } from '../../services/dependent/settings';
import { formatDate } from '../../services/independent/format';
import type { Resume, ResumeOptions, ResumeSource, SubmittedResume } from '../../services/independent/types';
import { submittedLine, submittedTitle } from '../independent/applicationCards';

export type ResumeChoice = { kind: 'resume'; resume: Resume; source: Exclude<ResumeSource, 'profile'> } | { kind: 'profile' };

export function ResumePickerDialog({
  visible,
  forText,
  current,
  onClose,
  onPick,
}: {
  visible: boolean;
  /** "Software Developer · Maple Software" - which application the resume is for. */
  forText: string;
  current: ResumeChoice | null;
  onClose: () => void;
  onPick: (choice: ResumeChoice) => void;
}) {
  const api = useApi();
  const toast = useToast();
  const { busy, run } = useAction();
  const [options, setOptions] = useState<ResumeOptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fresh choices every time the popup opens (a new submission may have been added).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    api
      .resumeOptions()
      .then((o) => {
        if (!alive) return;
        setOptions(o);
        setError(null);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [visible, api]);

  const currentResume = current?.kind === 'resume' ? current.resume : null;

  const upload = async () => {
    const file = await pickResumeFile().catch((e) => {
      toast((e as Error).message, 'danger');
      return null;
    });
    if (!file) return;
    const r = await run('upload', () => api.uploadResume(file), `Read ${file.name}`);
    if (r) onPick({ kind: 'resume', resume: r, source: 'upload' });
  };

  const pickProfile = async () => {
    const ok = await run('profile', () => api.profilePreview());
    if (ok) onPick({ kind: 'profile' });
  };

  const pickSubmitted = async (entry: SubmittedResume) => {
    const r = await run(entry.tailored_id, () => api.resumeFromTailored(entry.tailored_id));
    if (r) onPick({ kind: 'resume', resume: r, source: 'submitted' });
  };

  const editProfile = () => {
    onClose();
    router.push('/profile');
  };

  return (
    <Dialog
      visible={visible}
      title="Choose a resume"
      onClose={onClose}
      wide
      footer={<Button title="Cancel" variant="ghost" onPress={onClose} />}
    >
      <Muted>For: {forText}</Muted>

      <View style={styles.tiles}>
        <View style={[styles.tile, styles.uploadTile]}>
          <View style={styles.tileHead}>
            <View style={[styles.tileIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Upload a new resume</Text>
              <Muted>PDF, DOCX or TXT, up to 10 MB</Muted>
            </View>
          </View>
          <Button title="Choose file" icon="document-attach-outline" loading={busy === 'upload'} onPress={upload} />
        </View>

        <View style={styles.tile}>
          <View style={styles.tileHead}>
            <View style={styles.tileIcon}>
              <Ionicons name="person-outline" size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>Use my saved profile</Text>
              <Muted>
                {options === null
                  ? 'Checking your profile…'
                  : options.profile.saved
                    ? `Profile saved${options.profile.updated_at ? ` · ${formatDate(options.profile.updated_at)}` : ''}`
                    : 'No profile yet. Fill in the Profile form first.'}
              </Muted>
            </View>
            {current?.kind === 'profile' ? <Chip label="In use" tone="success" /> : null}
          </View>
          <View style={styles.tileButtons}>
            {options?.profile.saved ? (
              <Button title="Use profile" variant="secondary" loading={busy === 'profile'} onPress={pickProfile} />
            ) : null}
            <Button title={options?.profile.saved ? 'Edit profile' : 'Fill in profile'} variant="ghost" onPress={editProfile} />
          </View>
        </View>
      </View>

      {error ? <Banner tone="danger" message={error} /> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>From submitted applications</Text>
        <Muted>The resume you applied with, in the same order as your Job Tracker (newest on top)</Muted>
        {options === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : options.submitted.length === 0 ? (
          <Text style={styles.empty}>Nothing submitted yet. After you mark an application submitted, its resume shows here.</Text>
        ) : (
          <View style={styles.list}>
            {options.submitted.map((entry, i) => (
              <OptionRow
                key={entry.job_id}
                first={i === 0}
                letter={(entry.company || '?').charAt(0).toUpperCase()}
                title={submittedTitle(entry)}
                line={submittedLine(entry)}
                inUse={currentResume?.from_tailored_id === entry.tailored_id}
                loading={busy === entry.tailored_id}
                onPress={() => pickSubmitted(entry)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent uploads</Text>
        <Muted>Files you uploaded but have not submitted with yet</Muted>
        {options === null ? null : options.uploads.length === 0 ? (
          <Text style={styles.empty}>No other uploads.</Text>
        ) : (
          <View style={styles.list}>
            {options.uploads.map((r, i) => (
              <OptionRow
                key={r.id}
                first={i === 0}
                icon="document-text-outline"
                title={r.name}
                line={`${r.analysis.skills.length} skills · uploaded ${formatDate(r.created_at)}`}
                inUse={currentResume?.id === r.id}
                onPress={() => onPick({ kind: 'resume', resume: r, source: 'upload' })}
              />
            ))}
          </View>
        )}
      </View>
    </Dialog>
  );
}

function OptionRow({
  first,
  letter,
  icon,
  title,
  line,
  inUse,
  loading,
  onPress,
}: {
  first: boolean;
  letter?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  line: string;
  inUse: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Use ${title}`}
      accessibilityState={{ selected: inUse, busy: !!loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowBorder,
        inUse && { backgroundColor: colors.primaryTint },
        pressed && { backgroundColor: colors.primaryTint },
      ]}
    >
      <View style={[styles.rowIcon, icon ? { backgroundColor: colors.background } : null]}>
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.textMuted} />
        ) : (
          <Text style={styles.rowLetter}>{letter}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowLine} numberOfLines={2}>
          {line}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : inUse ? (
        <Chip label="In use" tone="success" />
      ) : (
        <View style={styles.usePill}>
          <Text style={styles.usePillText}>Use</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: 240,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  uploadTile: { borderWidth: 2, borderStyle: 'dashed', backgroundColor: colors.background },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  tileButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  loading: { alignSelf: 'flex-start', marginTop: spacing.sm },
  empty: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs },
  list: { marginTop: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLetter: { color: colors.primaryDark, fontWeight: '800', fontSize: font.h3 },
  rowTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  rowLine: { fontSize: font.small, color: colors.textMuted },
  usePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  usePillText: { fontSize: font.small, fontWeight: '700', color: colors.primaryDark },
});
