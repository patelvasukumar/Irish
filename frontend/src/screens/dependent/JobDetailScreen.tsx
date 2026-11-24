/**
 * One job in the tracker: status (by hand), notes, resume used, emails in
 * time order, and the three choices offered when a job becomes Successful.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

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
  Loading,
  MarkdownView,
  Muted,
  platform,
  Row,
  Screen,
  SectionTitle,
  spacing,
  StatusBadge,
  statusColors,
  TextField,
  useToast,
} from '@common/dependent';

import { useAction, useLoader } from '../../services/dependent/hooks';
import { useApi } from '../../services/dependent/settings';
import { formatDate, place } from '../../services/independent/format';
import { Job, JOB_STATUSES, JobStatus, SimilarJobs, Tailored, TrackerEmail } from '../../services/independent/types';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const toast = useToast();
  const { busy, run } = useAction();
  const { data: job, setData: setJob, error, loading, reload } = useLoader(useCallback(() => api.job(id), [api, id]));
  const [successOpen, setSuccessOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [moveEmail, setMoveEmail] = useState<TrackerEmail | null>(null);

  if (loading && !job) return <Loading label="Loading job…" />;
  if (!job) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Job not found" message={error ?? undefined}>
          <Button title="Back to tracker" onPress={() => router.replace('/tracker')} />
        </EmptyState>
      </Screen>
    );
  }

  const changeStatus = async (status: JobStatus) => {
    if (status === job.status) return;
    const updated = await run('status', () => api.updateJob(job.id, { status }), `Status: ${status}`);
    if (updated) {
      setJob({ ...job, ...updated, emails: job.emails });
      if (updated.prompt_success_options?.length) setSuccessOpen(true);
    }
  };

  const deleteJob = async () => {
    const ok = await run('delete', () => api.deleteJob(job.id), 'Job deleted');
    if (ok) router.replace('/tracker');
  };

  const emails = job.emails ?? [];

  return (
    <Screen
      title={job.title}
      subtitle={[job.company, place(job.city, job.province)].filter(Boolean).join(' · ')}
      refreshing={loading}
      onRefresh={reload}
    >
      <Stack.Screen options={{ title: job.company || 'Job' }} />

      <Card title="Status" icon="flag-outline" action={<StatusBadge status={job.status} />}>
        <Muted>Change it by hand at any time. The agent only moves a status forward.</Muted>
        <ChipRow>
          {JOB_STATUSES.map((s) => (
            <Chip
              key={s}
              label={s}
              icon={statusColors[s].icon as keyof typeof Ionicons.glyphMap}
              selected={job.status === s}
              onPress={() => changeStatus(s)}
            />
          ))}
        </ChipRow>
        {job.status === 'Successful' && (
          <Button title="Tracker options" icon="trophy-outline" variant="secondary" small onPress={() => setSuccessOpen(true)} />
        )}
      </Card>

      <Card title="Details" icon="information-circle-outline">
        <Info label="Applied" value={formatDate(job.applied_at, true)} />
        <Info label="Location" value={place(job.city, job.province) || 'Not set'} />
        <Row>
          {job.url ? (
            <Button title="Open application page" variant="secondary" icon="open-outline" small onPress={() => Linking.openURL(job.url!)} />
          ) : null}
          {job.resume_id ? (
            <Button title="Resume used" variant="secondary" icon="document-text-outline" small onPress={() => setResumeOpen(true)} />
          ) : (
            <Muted>No resume linked to this job.</Muted>
          )}
        </Row>
      </Card>

      <SimilarJobsCard key={job.id} jobId={job.id} />

      <NotesCard
        key={`${job.id}:${job.notes ?? ''}`}
        job={job}
        onSaved={(updated) => setJob({ ...job, ...updated, emails: job.emails })}
      />

      <Card title={`Emails (${emails.length})`} icon="mail-outline" subtitle="Oldest first. Only the subject, sender, time and link are kept.">
        {emails.length === 0 ? (
          <Muted>No emails linked yet.</Muted>
        ) : (
          emails.map((e, i) => (
            <View key={e.id} style={styles.emailRow}>
              <View style={styles.timeline}>
                <View style={styles.dot} />
                {i < emails.length - 1 && <View style={styles.line} />}
              </View>
              <View style={{ flex: 1, gap: 3, paddingBottom: spacing.md }}>
                <Text style={styles.emailSubject}>{e.subject}</Text>
                <Muted>
                  {e.sender} · {formatDate(e.received_at, true)}
                </Muted>
                <Row gap={spacing.sm}>
                  {e.detected_status ? <StatusBadge status={e.detected_status} /> : null}
                  {e.link ? <Button title="Open email" variant="ghost" small icon="open-outline" onPress={() => Linking.openURL(e.link!)} /> : null}
                  <Button title="Wrong job?" variant="ghost" small icon="swap-horizontal" onPress={() => setMoveEmail(e)} />
                </Row>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card title="Status history" icon="time-outline">
        {(job.status_history ?? []).map((h, i) => (
          <View key={i} style={styles.histRow}>
            <StatusBadge status={h.status} />
            <Muted>
              {formatDate(h.at, true)} · by {h.by === 'agent' ? 'the tracker agent' : 'you'}
            </Muted>
          </View>
        ))}
      </Card>

      <Button title="Delete this job" variant="danger" icon="trash-outline" onPress={() => setConfirmDelete(true)} />

      <Dialog
        visible={confirmDelete}
        title="Delete this job?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button title="Cancel" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete" variant="danger" icon="trash-outline" loading={busy === 'delete'} onPress={deleteJob} />
          </>
        }
      >
        <Muted>The job and its linked emails are removed from the tracker. This cannot be undone.</Muted>
      </Dialog>

      <SuccessDialog visible={successOpen} onClose={() => setSuccessOpen(false)} />
      {job.resume_id ? <ResumeDialog visible={resumeOpen} tailoredId={job.resume_id} onClose={() => setResumeOpen(false)} /> : null}
      <MoveEmailDialog
        email={moveEmail}
        currentJob={job}
        onClose={() => setMoveEmail(null)}
        onMoved={() => {
          setMoveEmail(null);
          toast('Email moved', 'success');
          reload();
        }}
      />
    </Screen>
  );
}

/** Keyed by the saved notes, so it restarts from the server value after a save or reload. */
function NotesCard({ job, onSaved }: { job: Job; onSaved: (job: Job) => void }) {
  const api = useApi();
  const { busy, run } = useAction();
  const [notes, setNotes] = useState(job.notes ?? '');
  const save = async () => {
    const updated = await run('notes', () => api.updateJob(job.id, { notes }), 'Notes saved');
    if (updated) onSaved(updated);
  };
  return (
    <Card title="Notes" icon="create-outline">
      <TextField lines={4} placeholder="Interview date, contact person, salary…" value={notes} onChangeText={setNotes} />
      <Button
        title="Save notes"
        icon="save-outline"
        small
        disabled={notes === (job.notes ?? '')}
        loading={busy === 'notes'}
        onPress={save}
      />
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/** Proposal: when a job becomes Successful, offer delete history / save ZIP / stop tracker. */
function SuccessDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useApi();
  const { busy, run } = useAction();
  const [confirm, setConfirm] = useState(false);

  const saveZip = () =>
    run('zip', () => platform.saveDownload(api.exportUrl(), 'irish_tracker_history.zip'), 'ZIP archive saved');

  const stop = async () => {
    const r = await run('stop', () => api.successAction('stop_tracker'), 'Tracker stopped');
    if (r) onClose();
  };

  const del = async () => {
    const r = await run('del', () => api.successAction('delete_history', true), 'Tracker history deleted');
    if (r) {
      setConfirm(false);
      onClose();
      router.replace('/tracker');
    }
  };

  return (
    <Dialog
      visible={visible}
      title={confirm ? 'Delete all tracker history?' : 'Congratulations! 🎉'}
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
    >
      {confirm ? (
        <>
          <Banner tone="danger" message="Every job and email in the tracker will be deleted. This cannot be undone." />
          <Muted>Tip: save a ZIP archive first.</Muted>
          <Row>
            <Button title="Save ZIP first" variant="secondary" icon="archive-outline" loading={busy === 'zip'} onPress={saveZip} />
            <Button title="Yes, delete everything" variant="danger" icon="trash-outline" loading={busy === 'del'} onPress={del} />
          </Row>
          <Button title="Go back" variant="ghost" onPress={() => setConfirm(false)} />
        </>
      ) : (
        <>
          <Muted>You got the job. What would you like to do with the tracker?</Muted>
          <Option icon="archive-outline" title="Save as ZIP archive" text="Download every job and email link as a ZIP file." loading={busy === 'zip'} onPress={saveZip} />
          <Option icon="pause-circle-outline" title="Stop the tracker" text="Keep the history but stop reading new emails." loading={busy === 'stop'} onPress={stop} />
          <Option icon="trash-outline" title="Delete tracker history" text="Remove every job and email from the tracker." danger onPress={() => setConfirm(true)} />
          <Button title="Keep tracking" variant="ghost" onPress={onClose} />
        </>
      )}
    </Dialog>
  );
}

function Option(props: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Card onPress={props.loading ? undefined : props.onPress} style={{ paddingVertical: spacing.md }}>
      <View style={styles.optionRow}>
        <Ionicons name={props.icon} size={24} color={props.danger ? colors.danger : colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTitle, props.danger && { color: colors.danger }]}>
            {props.loading ? 'Working…' : props.title}
          </Text>
          <Muted>{props.text}</Muted>
        </View>
      </View>
    </Card>
  );
}

function ResumeDialog({ visible, tailoredId, onClose }: { visible: boolean; tailoredId: string; onClose: () => void }) {
  const api = useApi();
  const [data, setData] = useState<Tailored | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || data) return;
    api.getTailored(tailoredId).then(setData).catch((e) => setError((e as Error).message));
  }, [visible, tailoredId, api, data]);

  return (
    <Dialog visible={visible} title="Resume used for this job" onClose={onClose} wide>
      {error ? <Banner tone="danger" message={error} /> : data ? (
        <>
          <Muted>
            {data.llm.provider} · {data.llm.model} · match {data.score}% · {formatDate(data.created_at, true)}
          </Muted>
          <MarkdownView text={data.text} />
        </>
      ) : (
        <Loading />
      )}
    </Dialog>
  );
}

function MoveEmailDialog({
  email,
  currentJob,
  onClose,
  onMoved,
}: {
  email: TrackerEmail | null;
  currentJob: Job;
  onClose: () => void;
  onMoved: () => void;
}) {
  const api = useApi();
  const { busy, run } = useAction();
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    if (email) api.jobs().then((l) => setJobs(l.jobs.filter((j) => j.id !== currentJob.id))).catch(() => setJobs([]));
  }, [email, api, currentJob.id]);

  const move = async (jobId: string) => {
    if (!email) return;
    const r = await run(jobId, () => api.relinkEmail(email.id, jobId));
    if (r) onMoved();
  };

  return (
    <Dialog visible={!!email} title="Move email to another job" onClose={onClose}>
      <Muted>“{email?.subject}”</Muted>
      <SectionTitle>Choose the right job</SectionTitle>
      {jobs.length === 0 ? (
        <Muted>There are no other jobs in the tracker.</Muted>
      ) : (
        jobs.map((j) => (
          <Card
            key={j.id}
            title={j.title}
            subtitle={j.company}
            onPress={() => move(j.id)}
            action={busy === j.id ? <Loading /> : <StatusBadge status={j.status} />}
          />
        ))
      )}
    </Dialog>
  );
}

/** Past applications that look like this one (semantic match) and how they went. */
function SimilarJobsCard({ jobId }: { jobId: string }) {
  const api = useApi();
  const [data, setData] = useState<SimilarJobs | null>(null);

  useEffect(() => {
    let live = true;
    api
      .similarJobs(jobId)
      .then((d) => live && setData(d))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, [api, jobId]);

  // Hidden when semantic match is off or there is nothing similar yet.
  if (!data?.available || data.jobs.length === 0) return null;
  const summary = Object.entries(data.summary)
    .map(([status, n]) => `${n} ${status}`)
    .join(' · ');
  return (
    <Card title="Similar past applications" icon="git-compare-outline" subtitle={summary}>
      {data.jobs.map((j) => (
        <Card
          key={j.job_id}
          title={j.title}
          subtitle={`${j.company} · applied ${formatDate(j.applied_at)} · ${j.fit}% similar`}
          action={<StatusBadge status={j.status} />}
          onPress={() => router.push(`/tracker/${j.job_id}`)}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', gap: spacing.md },
  infoLabel: { width: 90, fontSize: font.small, color: colors.textMuted },
  infoValue: { flex: 1, fontSize: font.small, color: colors.text, fontWeight: '500' },
  emailRow: { flexDirection: 'row', gap: spacing.md },
  timeline: { alignItems: 'center', width: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: colors.primarySoft, marginTop: 2 },
  emailSubject: { fontSize: font.body, fontWeight: '600', color: colors.text },
  histRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
});
