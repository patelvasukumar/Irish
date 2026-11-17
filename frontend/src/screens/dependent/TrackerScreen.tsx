/** Job Application Tracker panel (C7, demo step 6). */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  colors,
  Dialog,
  EmptyState,
  font,
  Label,
  Loading,
  Muted,
  platform,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  spacing,
  StatusBadge,
  TextField,
  useToast,
} from '@common/dependent';

import { useAction } from '../../services/dependent/hooks';
import { useApi } from '../../services/dependent/settings';
import { formatDate, place, timeAgo } from '../../services/independent/format';
import { JOB_STATUSES, JobList } from '../../services/independent/types';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  FilterState,
  TIME_OPTIONS,
  TimeValue,
  toggle,
  toQuery,
} from '../independent/trackerFilters';

export default function TrackerScreen() {
  const api = useApi();
  const toast = useToast();
  const { busy, run } = useAction();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<JobList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.jobs(toQuery(filters)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  // Loads on open, when a filter changes, and when coming back from a job.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const set = (patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch }));
  const enabled = data?.state.enabled ?? true;
  const count = activeFilterCount(filters);

  const toggleTracker = async (value: boolean) => {
    const r = await run('toggle', () => api.setTrackerEnabled(value), value ? 'Tracker started' : 'Tracker stopped');
    if (r) load();
  };

  const checkMailbox = async () => {
    const r = await run('mailbox', () => api.checkMailbox());
    if (r) {
      toast(`Checked ${r.checked} emails, ${r.job_emails} about jobs`, 'success');
      load();
    }
  };

  const exportZip = () =>
    run('zip', () => platform.saveDownload(api.exportUrl(), 'irish_tracker_history.zip'), 'ZIP archive ready');

  return (
    <Screen
      title="Job Application Tracker"
      subtitle="Every job you applied to, newest first. Statuses update from your emails."
      refreshing={loading && !!data}
      onRefresh={load}
      actions={
        <>
          <Button title="Add job" icon="add" small onPress={() => setAddOpen(true)} />
          <Button title="Test email" icon="mail-outline" variant="secondary" small onPress={() => setEmailOpen(true)} />
        </>
      }
    >
      <Card>
        <View style={styles.toolbar}>
          <View style={styles.switchRow}>
            <Switch
              value={enabled}
              onValueChange={toggleTracker}
              disabled={busy === 'toggle'}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              accessibilityLabel="Tracker on or off"
            />
            <Label>{enabled ? 'Tracker is on' : 'Tracker is stopped'}</Label>
          </View>
          <Row gap={spacing.sm}>
            <Button title="Check mailbox" icon="sync-outline" variant="ghost" small loading={busy === 'mailbox'} onPress={checkMailbox} />
            <Button title="Save ZIP" icon="archive-outline" variant="ghost" small loading={busy === 'zip'} onPress={exportZip} />
            <Button
              title={count ? `Filters (${count})` : 'Filters'}
              icon="options-outline"
              variant={showFilters || count ? 'secondary' : 'ghost'}
              small
              onPress={() => setShowFilters((s) => !s)}
            />
          </Row>
        </View>

        {showFilters && data && (
          <View style={{ gap: spacing.md }}>
            <TextField
              placeholder="Search title or company"
              value={filters.search}
              onChangeText={(search) => set({ search })}
              autoCorrect={false}
            />
            <Segmented<TimeValue>
              value={filters.time}
              onChange={(time) => set({ time })}
              options={TIME_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <FilterChips label="Status" values={JOB_STATUSES} selected={filters.status} onSelect={(v) => set({ status: toggle(filters.status, v) })} />
            <FilterChips label="Company" values={data.filters.companies} selected={filters.company} onSelect={(v) => set({ company: toggle(filters.company, v) })} />
            <FilterChips label="City" values={data.filters.cities} selected={filters.city} onSelect={(v) => set({ city: toggle(filters.city, v) })} />
            <FilterChips label="Province" values={data.filters.provinces} selected={filters.province} onSelect={(v) => set({ province: toggle(filters.province, v) })} />
            {count > 0 && <Button title="Clear filters" variant="ghost" small icon="close" onPress={() => setFilters(EMPTY_FILTERS)} />}
          </View>
        )}
      </Card>

      {!enabled && (
        <Banner tone="warning" message="The tracker is stopped. New emails are not read until you turn it back on." />
      )}
      {error && <Banner tone="danger" message={error} />}
      {loading && !data ? (
        <Loading label="Loading jobs…" />
      ) : data && data.jobs.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title={count ? 'No jobs match these filters' : 'No applications yet'}
          message={
            count
              ? 'Try clearing a filter.'
              : 'Apply from the Tailor tab, add a job by hand, or send a test email.'
          }
        />
      ) : (
        data?.jobs.map((job) => (
          <Card key={job.id} onPress={() => router.push(`/tracker/${job.id}`)} style={styles.jobCard}>
            <View style={styles.jobRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(job.company || '?').slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  {job.title}
                </Text>
                <Muted numberOfLines={1}>
                  {[job.company, place(job.city, job.province)].filter(Boolean).join(' · ')}
                </Muted>
                <View style={styles.metaRow}>
                  <StatusBadge status={job.status} />
                  <Text style={styles.meta}>
                    Applied {formatDate(job.applied_at)} · updated {timeAgo(job.updated_at ?? job.created_at)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        ))
      )}

      <AddJobDialog visible={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <TestEmailDialog visible={emailOpen} onClose={() => setEmailOpen(false)} onDone={load} />
    </Screen>
  );
}

function FilterChips({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: readonly string[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  // Only places / companies that exist in the list are shown (proposal: Ottawa only if you applied there).
  if (!values.length) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <SectionTitle>{label}</SectionTitle>
      <ChipRow>
        {values.map((v) => (
          <Chip key={v} label={v} selected={selected === v} onPress={() => onSelect(v)} />
        ))}
      </ChipRow>
    </View>
  );
}

function AddJobDialog({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const { busy, run } = useAction();
  const [form, setForm] = useState({ title: '', company: '', city: '', province: '', url: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.company.trim();

  const save = async () => {
    const r = await run(
      'add',
      () =>
        api.addJob({
          title: form.title.trim(),
          company: form.company.trim(),
          city: form.city.trim() || null,
          province: form.province.trim() || null,
          url: form.url.trim() || null,
        }),
      'Job added',
    );
    if (r) {
      setForm({ title: '', company: '', city: '', province: '', url: '' });
      onClose();
      onSaved();
    }
  };

  return (
    <Dialog
      visible={visible}
      title="Add a job"
      onClose={onClose}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Add job" icon="add" disabled={!valid} loading={busy === 'add'} onPress={save} />
        </>
      }
    >
      <TextField label="Job title *" value={form.title} onChangeText={set('title')} />
      <TextField label="Company *" value={form.company} onChangeText={set('company')} />
      <Row>
        <View style={{ flex: 1, minWidth: 140 }}>
          <TextField label="City" placeholder="Ottawa" value={form.city} onChangeText={set('city')} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <TextField label="Province" placeholder="Ontario" value={form.province} onChangeText={set('province')} />
        </View>
      </Row>
      <TextField label="Application link" placeholder="https://…" value={form.url} onChangeText={set('url')} autoCapitalize="none" keyboardType="url" />
      <Muted>The first version tracks jobs in Canada only.</Muted>
    </Dialog>
  );
}

const SAMPLE_EMAILS = [
  { label: 'Interview', subject: 'Interview invitation', snippet: 'We would like to schedule an interview with you next week.' },
  { label: 'Rejection', subject: 'Update on your application', snippet: 'Unfortunately, we have decided to move forward with other candidates.' },
  { label: 'Offer', subject: 'Job offer', snippet: 'Congratulations! We are pleased to offer you the position.' },
  { label: 'Received', subject: 'Thank you for applying', snippet: 'We have received your application.' },
];

function TestEmailDialog({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const { busy, run } = useAction();
  const [subject, setSubject] = useState(SAMPLE_EMAILS[0].subject);
  const [sender, setSender] = useState('Maple Software Careers <jobs@maplesoftware.ca>');
  const [snippet, setSnippet] = useState(SAMPLE_EMAILS[0].snippet);

  const send = async () => {
    const r = await run('send', () => api.sendEmail({ subject, sender, snippet }));
    if (!r) return;
    if (!r.is_job) toast(r.skipped ?? 'The agent decided this email is not about a job.', 'info');
    else if (r.job_created) toast(`New job added to the tracker (${r.status ?? 'Applied'})`, 'success');
    else if (r.status_changed) toast(`Status changed to ${r.status}`, 'success');
    else toast('Email linked to the job (status unchanged)', 'info');
    onClose();
    onDone();
  };

  return (
    <Dialog
      visible={visible}
      title="Send a test email to the agent"
      onClose={onClose}
      footer={
        <>
          <Button title="Cancel" variant="ghost" onPress={onClose} />
          <Button title="Send" icon="send" loading={busy === 'send'} disabled={!subject.trim() || !sender.trim()} onPress={send} />
        </>
      }
    >
      <Muted>The job tracker agent (C7) decides if the email is about a job, finds the job by company and updates its status.</Muted>
      <ChipRow>
        {SAMPLE_EMAILS.map((s) => (
          <Chip
            key={s.label}
            label={s.label}
            selected={subject === s.subject}
            onPress={() => {
              setSubject(s.subject);
              setSnippet(s.snippet);
            }}
          />
        ))}
      </ChipRow>
      <TextField label="From" value={sender} onChangeText={setSender} autoCapitalize="none" />
      <TextField label="Subject" value={subject} onChangeText={setSubject} />
      <TextField label="First lines of the email" lines={3} value={snippet} onChangeText={setSnippet} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  jobCard: { paddingVertical: spacing.md },
  jobRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: font.h2 },
  jobTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  meta: { fontSize: font.tiny, color: colors.textMuted },
});
