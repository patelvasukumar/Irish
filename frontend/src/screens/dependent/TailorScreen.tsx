/**
 * Main flow (demo steps 2-5). Each application is saved as you go, so it can
 * be continued later from its card in the "Application progress" tab.
 *   1. Resume: popup with upload / saved profile / submitted / recent uploads -> C1
 *   2. Job posting (link / text / screenshot)                                 -> C1, C3
 *   3. Matching + missing skills, graph context                               -> C1, C4
 *   4. Tailored resume: write, edit, save to History                          -> C2
 *   5. Submit on the job portal, then "Mark as submitted" -> Job Tracker      -> C7, C8
 */
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  Dialog,
  Label,
  MarkdownView,
  Muted,
  platform,
  Row,
  ScoreRing,
  Screen,
  SectionTitle,
  Segmented,
  spacing,
  TextField,
  useToast,
} from '@common/dependent';

import { useAction } from '../../services/dependent/hooks';
import { pickScreenshot } from '../../services/dependent/pickers';
import { useApi } from '../../services/dependent/settings';
import { isValidUrl, place, safeFileName } from '../../services/independent/format';
import type {
  Application,
  ApplicationChanges,
  ApplicationDetail,
  Credential,
  LlmProvider,
  MatchResult,
  Posting,
  TailorResult,
} from '../../services/independent/types';
import { cardSubtitle, cardTitle } from '../independent/applicationCards';
import { ApplicationProgressPanel } from './ApplicationProgressPanel';
import { ResumeChoice, ResumePickerDialog } from './ResumePickerDialog';
import { SelectedResumePanel } from './SelectedResumePanel';

type Tab = 'resume' | 'progress';
type PostingMode = 'link' | 'text' | 'image';
type Draft = Pick<TailorResult, 'id' | 'tailored_resume' | 'llm' | 'warning'>;
/** The application on screen. `id` stays null until its first step is saved. */
type Slot = { id: string | null };

const PROVIDERS: { value: LlmProvider | 'default'; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'stub', label: 'Offline' },
];

function resumeChanges(c: ResumeChoice | null): ApplicationChanges {
  if (!c) return { resume_source: null, resume_id: null };
  if (c.kind === 'profile') return { resume_source: 'profile', resume_id: null };
  return { resume_source: c.source, resume_id: c.resume.id };
}

function choiceFrom(d: ApplicationDetail): ResumeChoice | null {
  if (d.resume_source === 'profile') return { kind: 'profile' };
  if (d.resume && d.resume_source) return { kind: 'resume', resume: d.resume, source: d.resume_source };
  return null;
}

export default function TailorScreen() {
  const api = useApi();
  const toast = useToast();
  const { busy, run } = useAction();
  const { width } = useWindowDimensions();

  // ---- the two tabs + applications in progress
  const [tab, setTab] = useState<Tab>('resume');
  const [apps, setApps] = useState<Application[] | null>(null);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [submitted, setSubmitted] = useState<{ jobId: string; text: string } | null>(null);

  // ---- step 1: resume, step 2: posting
  const [choice, setChoice] = useState<ResumeChoice | null>(null);
  const [postingMode, setPostingMode] = useState<PostingMode>('link');
  const [link, setLink] = useState('');
  const [postingText, setPostingText] = useState('');
  const [posting, setPosting] = useState<Posting | null>(null);
  const [postingError, setPostingError] = useState<string | null>(null);
  const [busyPosting, setBusyPosting] = useState(false);

  // ---- steps 3, 4, 5
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [instructions, setInstructions] = useState('');
  const [provider, setProvider] = useState<LlmProvider | 'default'>('default');
  const [result, setResult] = useState<Draft | null>(null);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState(true);
  const [format, setFormat] = useState<'pdf' | 'docx' | 'txt'>('pdf');
  const [fileName, setFileName] = useState('');
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const dirty = !!result && draft !== result.tailored_resume;

  const slot = useRef<Slot>({ id: null });
  /** Latest resume + posting, for handlers that finish after an await. */
  const inputs = useRef<{ choice: ResumeChoice | null; posting: Posting | null }>({ choice: null, posting: null });
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const matchToken = useRef(0);
  const booted = useRef(false);

  // ------------------------------------------------------------ saving steps
  const upsertCard = useCallback((a: Application) => {
    setApps((list) => {
      const rest = (list ?? []).filter((x) => x.id !== a.id);
      return a.status === 'in_progress' ? [a, ...rest] : rest;
    });
  }, []);

  const showSlot = useCallback((id: string | null) => {
    slot.current = { id };
    setAppId(id);
  }, []);

  /**
   * Save one step of an application (the one on screen by default). The
   * first save creates it. Saves run one at a time, in order.
   */
  const saveStep = useCallback(
    (changes: ApplicationChanges, target: Slot = slot.current): Promise<Application | null> => {
      const job = saveQueue.current.then(async () => {
        try {
          const a = target.id ? await api.updateApplication(target.id, changes) : await api.createApplication(changes);
          target.id = a.id;
          if (slot.current === target) setAppId(a.id);
          upsertCard(a);
          return a;
        } catch (e) {
          toast(`Could not save this step: ${(e as Error).message}`, 'danger');
          return null;
        }
      });
      saveQueue.current = job;
      return job;
    },
    [api, toast, upsertCard],
  );

  const loadCredentials = useCallback(() => {
    api.credentials().then(setCredentials).catch(() => setCredentials([]));
  }, [api]);

  /** Step 3 runs by itself when the resume and the posting are both ready. */
  const runMatch = useCallback(
    (c: ResumeChoice | null, p: Posting | null, savedScore: number | null = null) => {
      const token = ++matchToken.current;
      const target = slot.current;
      setMatch(null);
      if (!c || !p) return;
      run('match', () => api.match(p.id, c.kind === 'resume' ? c.resume.id : null)).then((m) => {
        if (!m || token !== matchToken.current) return;
        setMatch(m);
        if (m.score !== savedScore) saveStep({ match_score: m.score }, target);
      });
    },
    [api, run, saveStep],
  );

  /** A new resume or posting clears the later steps (the backend does the same). */
  const applyInputs = useCallback(
    (c: ResumeChoice | null, p: Posting | null) => {
      inputs.current = { choice: c, posting: p };
      setChoice(c);
      setPosting(p);
      setResult(null);
      setDraft('');
      setSavedPath(null);
      setWaiting(false);
      runMatch(c, p);
    },
    [runMatch],
  );

  const selectResume = (c: ResumeChoice) => {
    setPickerOpen(false);
    setSubmitted(null);
    applyInputs(c, inputs.current.posting);
    saveStep(resumeChanges(c));
  };

  const selectPosting = (p: Posting | null) => {
    applyInputs(inputs.current.choice, p);
    saveStep({ posting_id: p?.id ?? null });
  };

  // ------------------------------------------------------ switching application
  const startBlank = useCallback(() => {
    showSlot(null);
    matchToken.current += 1;
    inputs.current = { choice: null, posting: null };
    setChoice(null);
    setPosting(null);
    setMatch(null);
    setResult(null);
    setDraft('');
    setSavedPath(null);
    setWaiting(false);
    setCredentialId(null);
    setLink('');
    setPostingText('');
    setPostingError(null);
    setInstructions('');
    setFileName('');
    setOpening(false);
  }, [showSlot]);

  /** Continue where you left off: load an application's saved steps. */
  const openApplication = useCallback(
    async (id: string) => {
      if (slot.current.id === id) return;
      startBlank();
      showSlot(id);
      setOpening(true);
      try {
        const d = await api.application(id);
        if (slot.current.id !== id) return;
        const c = choiceFrom(d);
        inputs.current = { choice: c, posting: d.posting };
        setChoice(c);
        setPosting(d.posting);
        if (d.posting) setFileName(safeFileName(d.posting.title ?? 'resume') + '_tailored');
        if (d.tailored) {
          setResult({ id: d.tailored.id, tailored_resume: d.tailored.text, llm: d.tailored.llm, warning: null });
          setDraft(d.tailored.text);
          setPreview(true);
          setSavedPath(d.tailored.saved_path ?? null);
          loadCredentials();
        }
        setCredentialId(d.credential_id);
        setWaiting(d.waiting_to_submit);
        runMatch(c, d.posting, d.match_score);
      } catch (e) {
        toast((e as Error).message, 'danger');
      } finally {
        if (slot.current.id === id) setOpening(false);
      }
    },
    [api, loadCredentials, runMatch, showSlot, startBlank, toast],
  );

  // Refresh the cards whenever the tab gets focus; on the first visit, open
  // the application you worked on last.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .applications()
        .then((list) => {
          if (!alive) return;
          setApps(list);
          setAppsError(null);
          if (!booted.current) {
            booted.current = true;
            const untouched = !slot.current.id && !inputs.current.choice && !inputs.current.posting;
            if (list.length && untouched) openApplication(list[0].id);
          }
        })
        .catch((e) => alive && setAppsError((e as Error).message));
      return () => {
        alive = false;
      };
    }, [api, openApplication]),
  );

  const newApplication = () => {
    setSubmitted(null);
    const alreadyBlank = !slot.current.id && !inputs.current.choice && !inputs.current.posting;
    if (!alreadyBlank) startBlank();
    setTab('resume');
    setPickerOpen(true);
  };

  const openCard = (a: Application) => {
    setSubmitted(null);
    setTab('resume');
    openApplication(a.id);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    await saveQueue.current;
    const r = await run('delete', () => api.deleteApplication(target.id), 'Application deleted');
    if (!r) return;
    setApps((list) => (list ?? []).filter((a) => a.id !== target.id));
    setDeleteTarget(null);
    if (slot.current.id === target.id) startBlank();
  };

  // ---------------------------------------------------------------- actions
  const readPosting = async (fn: () => Promise<Posting>) => {
    const target = slot.current;
    setPostingError(null);
    setBusyPosting(true);
    try {
      const p = await fn();
      if (slot.current !== target) return; // another application was opened meanwhile
      selectPosting(p);
      setFileName(safeFileName(`${p.title ?? 'resume'}`) + '_tailored');
      toast('Job posting read', 'success');
    } catch (e) {
      setPostingError((e as Error).message);
    } finally {
      setBusyPosting(false);
    }
  };

  const postingFromImage = async (source: 'library' | 'camera') => {
    try {
      const img = await pickScreenshot(source);
      if (img) await readPosting(() => api.postingFromImage(img));
    } catch (e) {
      setPostingError((e as Error).message);
    }
  };

  const tailor = async () => {
    if (!posting) return;
    const target = slot.current;
    const r = await run('tailor', () =>
      api.tailor(posting.id, choice?.kind === 'resume' ? choice.resume.id : null, instructions, provider === 'default' ? null : provider),
    );
    if (!r) return;
    saveStep({ tailored_id: r.id }, target);
    if (slot.current !== target) return;
    setResult(r);
    setDraft(r.tailored_resume);
    setPreview(true);
    setSavedPath(null);
    setWaiting(false);
    loadCredentials();
  };

  const saveEdits = async () => {
    if (!result) return;
    const t = await run('edit', () => api.editTailored(result.id, draft), 'Changes saved');
    if (t) setResult({ ...result, tailored_resume: t.text });
  };

  const saveFile = async () => {
    if (!result) return;
    if (dirty) await saveEdits();
    const s = await run(
      'save',
      () => api.saveTailored(result.id, format, fileName.trim() || undefined),
      `Saved to history as ${format.toUpperCase()}`,
    );
    if (s) setSavedPath(s.saved);
  };

  const download = async () => {
    if (!savedPath) return;
    const name = savedPath.split('/').pop() ?? `resume.${format}`;
    await run('download', () => platform.saveDownload(api.historyDownloadUrl(savedPath), name));
  };

  /** Step 5: open the portal; the card shows "Waiting to submit" until marked submitted. */
  const openPortal = async () => {
    if (!result) return;
    if (dirty) await saveEdits();
    await saveQueue.current;
    const id = slot.current.id;
    if (!id) return;
    const r = await run('portal', () => api.openPortal(id, credentialId));
    if (!r) return;
    upsertCard(r.application);
    setWaiting(true);
    if (r.open_url) Linking.openURL(r.open_url).catch(() => toast('Could not open the job posting link', 'danger'));
  };

  const markSubmitted = async () => {
    await saveQueue.current;
    const id = slot.current.id;
    if (!id) return;
    const r = await run('submit', () => api.submitApplication(id), 'Submitted – moved to the Job Tracker');
    if (!r) return;
    setApps((list) => (list ?? []).filter((a) => a.id !== id));
    startBlank();
    setSubmitted({ jobId: r.job.id, text: [r.job.title, r.job.company].filter(Boolean).join(' · ') });
    setTab('progress');
  };

  const permitted = credentials.filter((c) => c.permission_to_apply);
  const forText = posting
    ? [posting.title || 'Untitled job', posting.company].filter(Boolean).join(' · ')
    : 'New application (no job posting yet)';
  const narrow = width < 560;

  // ---------------------------------------------------------------- render
  return (
    <Screen
      title="Tailor your resume"
      subtitle="Pick a resume and a job posting. Irish finds the matching skills and rewrites your resume for the job."
      actions={<Button title="New application" variant="ghost" icon="add" small onPress={newApplication} />}
    >
      {submitted && (
        <View style={{ gap: spacing.sm }}>
          <Banner tone="success" title="Submitted – moved to the Job Tracker" message={submitted.text} />
          <Row gap={spacing.sm}>
            <Button
              title="View in tracker"
              variant="secondary"
              icon="list-outline"
              small
              onPress={() => router.push(`/tracker/${submitted.jobId}`)}
            />
            <Button title="Dismiss" variant="ghost" small onPress={() => setSubmitted(null)} />
          </Row>
        </View>
      )}

      {/* TWO TABS: Selected resume / Application progress */}
      <Card>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'resume', label: 'Selected resume', icon: 'document-text-outline' },
            {
              value: 'progress',
              label: narrow ? 'In progress' : 'Application progress',
              icon: 'time-outline',
              badge: apps ? apps.length : undefined,
            },
          ]}
        />
        {tab === 'resume' ? (
          <SelectedResumePanel choice={choice} forText={forText} loading={opening} onChoose={() => setPickerOpen(true)} />
        ) : (
          <ApplicationProgressPanel
            apps={apps}
            currentId={appId}
            error={appsError}
            onNew={newApplication}
            onOpen={openCard}
            onDelete={setDeleteTarget}
          />
        )}
      </Card>

      {/* STEP 2 */}
      <Card
        step={2}
        done={!!posting}
        title="Job posting"
        subtitle={
          posting
            ? [posting.title, posting.company, place(posting.city, posting.province)].filter(Boolean).join(' · ')
            : 'Paste a link, the text, or a screenshot of the posting'
        }
        action={posting ? <Button title="Change" variant="ghost" small onPress={() => selectPosting(null)} /> : null}
      >
        {posting ? (
          <>
            {posting.source === 'image' && posting.ocr_confidence != null ? (
              <Muted>Read from screenshot (OCR confidence {posting.ocr_confidence}%).</Muted>
            ) : null}
            {posting.analysis.years_experience_required ? (
              <Muted>Asks for {posting.analysis.years_experience_required}+ years of experience.</Muted>
            ) : null}
            <SkillList skills={posting.analysis.skills} />
          </>
        ) : (
          <>
            <Segmented
              value={postingMode}
              onChange={(m) => {
                setPostingMode(m);
                setPostingError(null);
              }}
              options={[
                { value: 'link', label: 'Link', icon: 'link-outline' },
                { value: 'text', label: 'Text', icon: 'reader-outline' },
                { value: 'image', label: 'Screenshot', icon: 'image-outline' },
              ]}
            />
            {postingMode === 'link' && (
              <>
                <TextField
                  label="Job posting link"
                  placeholder="https://…"
                  value={link}
                  onChangeText={setLink}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  onSubmitEditing={() => isValidUrl(link) && readPosting(() => api.postingFromLink(link.trim()))}
                />
                <Button
                  title="Read posting"
                  icon="globe-outline"
                  disabled={!isValidUrl(link)}
                  loading={busyPosting}
                  onPress={() => readPosting(() => api.postingFromLink(link.trim()))}
                />
              </>
            )}
            {postingMode === 'text' && (
              <>
                <TextField
                  label="Job posting text"
                  placeholder="Paste the job title, company, location and description…"
                  lines={8}
                  value={postingText}
                  onChangeText={setPostingText}
                />
                <Button
                  title="Use this posting"
                  icon="checkmark"
                  disabled={postingText.trim().length < 30}
                  loading={busyPosting}
                  onPress={() => readPosting(() => api.postingFromText(postingText))}
                />
              </>
            )}
            {postingMode === 'image' && (
              <View style={styles.center}>
                <Muted>Irish reads the text from the image (C3, Tesseract OCR).</Muted>
                <Row>
                  <Button title="Choose screenshot" icon="images-outline" loading={busyPosting} onPress={() => postingFromImage('library')} />
                  {Platform.OS !== 'web' && (
                    <Button title="Take photo" variant="secondary" icon="camera-outline" onPress={() => postingFromImage('camera')} />
                  )}
                </Row>
              </View>
            )}
            {postingError ? <Banner tone="danger" message={postingError} /> : null}
          </>
        )}
      </Card>

      {/* STEP 3 */}
      <Card
        step={3}
        done={!!match}
        title="Skill match"
        subtitle={match ? `Graph: ${match.graph_backend}` : 'Appears when the resume and the job posting are both ready'}
      >
        {busy === 'match' && <Muted>Comparing skills…</Muted>}
        {match && <MatchView match={match} />}
      </Card>

      {/* STEP 4 */}
      <Card step={4} done={!!savedPath} title="Tailored resume" subtitle="Written by a free AI model (C2)">
        {!match ? (
          <Muted>Finish the steps above first.</Muted>
        ) : (
          <>
            <TextField
              label="Extra instructions (optional)"
              placeholder="e.g. keep it to one page, focus on my React projects"
              value={instructions}
              onChangeText={setInstructions}
            />
            <View style={{ gap: spacing.xs }}>
              <Label>AI model</Label>
              <Segmented value={provider} onChange={setProvider} options={PROVIDERS} />
            </View>
            <Button
              title={result ? 'Write again' : 'Write tailored resume'}
              icon="sparkles-outline"
              loading={busy === 'tailor'}
              onPress={tailor}
            />
            {busy === 'tailor' && <Muted>Writing… a local model can take up to a minute.</Muted>}
          </>
        )}

        {result && (
          <View style={{ gap: spacing.md }}>
            {result.warning ? <Banner tone="warning" title="Used the offline writer" message={result.warning} /> : null}
            <SectionTitle
              right={
                <View style={styles.viewToggle}>
                  <Segmented
                    value={preview ? 'preview' : 'edit'}
                    onChange={(v) => setPreview(v === 'preview')}
                    options={[
                      { value: 'preview', label: 'Preview', icon: 'eye-outline' },
                      { value: 'edit', label: 'Edit', icon: 'create-outline' },
                    ]}
                  />
                </View>
              }
            >
              {`${result.llm.provider} · ${result.llm.model}`}
            </SectionTitle>
            {preview ? (
              <MarkdownView text={draft} />
            ) : (
              <TextField lines={18} value={draft} onChangeText={setDraft} style={styles.mono} />
            )}
            {dirty && (
              <Row>
                <Button title="Save changes" icon="save-outline" small loading={busy === 'edit'} onPress={saveEdits} />
                <Button title="Undo changes" variant="ghost" small onPress={() => setDraft(result.tailored_resume)} />
              </Row>
            )}

            <SectionTitle>Save to history</SectionTitle>
            <Segmented
              value={format}
              onChange={setFormat}
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'docx', label: 'DOCX' },
                { value: 'txt', label: 'TXT' },
              ]}
            />
            <TextField label="File name" value={fileName} onChangeText={setFileName} autoCapitalize="none" />
            <Row>
              <Button title="Save" icon="download-outline" loading={busy === 'save'} onPress={saveFile} />
              {savedPath && (
                <Button title="Download" variant="secondary" icon="share-outline" loading={busy === 'download'} onPress={download} />
              )}
            </Row>
            {savedPath ? <Banner tone="success" message={`Saved in history/${savedPath}`} /> : null}
          </View>
        )}
      </Card>

      {/* STEP 5 */}
      <Card
        step={5}
        done={false}
        title="Submit on the job portal"
        subtitle={waiting ? 'Waiting for you to submit' : 'Stays in Application progress until it is submitted'}
      >
        {!result ? (
          <Muted>Finish the steps above first.</Muted>
        ) : waiting ? (
          <>
            <Banner
              tone="warning"
              title="Waiting for you to submit"
              message="Finish the application on the portal. When it is sent, mark it submitted: Irish adds it to the Job Tracker and takes it out of Application progress."
            />
            <Row>
              <Button title="Mark as submitted" icon="checkmark-done" loading={busy === 'submit'} onPress={markSubmitted} />
              {posting?.url ? (
                <Button
                  title="Open portal again"
                  variant="secondary"
                  icon="open-outline"
                  onPress={() => Linking.openURL(posting.url!).catch(() => toast('Could not open the link', 'danger'))}
                />
              ) : null}
            </Row>
          </>
        ) : (
          <>
            {permitted.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Muted>Sign in with a saved login (only sites you gave permission for):</Muted>
                <ChipRow>
                  <Chip label="Apply by hand" selected={credentialId === null} onPress={() => setCredentialId(null)} />
                  {permitted.map((c) => (
                    <Chip
                      key={c.id}
                      icon="key-outline"
                      label={c.company}
                      selected={credentialId === c.id}
                      onPress={() => setCredentialId(c.id)}
                    />
                  ))}
                </ChipRow>
              </View>
            ) : (
              <Muted>Tip: save a company login with permission in Logins to let Irish sign in for you.</Muted>
            )}
            <Button
              title={posting?.url ? 'Open job portal to apply' : 'I am applying now'}
              icon={posting?.url ? 'open-outline' : 'paper-plane-outline'}
              loading={busy === 'portal'}
              onPress={openPortal}
            />
            {!posting?.url ? (
              <Muted>This posting has no link. Apply on the company&apos;s site, then mark it submitted here.</Muted>
            ) : null}
          </>
        )}
      </Card>

      <ResumePickerDialog
        visible={pickerOpen}
        forText={forText}
        current={choice}
        onClose={() => setPickerOpen(false)}
        onPick={selectResume}
      />

      <Dialog
        visible={!!deleteTarget}
        title="Delete this application?"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button title="Cancel" variant="ghost" onPress={() => setDeleteTarget(null)} />
            <Button title="Delete" variant="danger" icon="trash-outline" loading={busy === 'delete'} onPress={confirmDelete} />
          </>
        }
      >
        {deleteTarget ? <Label>{[cardTitle(deleteTarget), cardSubtitle(deleteTarget)].join(' · ')}</Label> : null}
        <Muted>
          Its job posting, skill match and tailored draft are removed from Application progress. Your uploaded resume
          files and History stay. This cannot be undone.
        </Muted>
      </Dialog>
    </Screen>
  );
}

function SkillList({ skills }: { skills: string[] }) {
  if (!skills.length) return <Muted>No known skills found.</Muted>;
  return (
    <ChipRow>
      {skills.map((s) => (
        <Chip key={s} label={s} />
      ))}
    </ChipRow>
  );
}

function MatchView({ match }: { match: MatchResult }) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.matchTop}>
        <ScoreRing score={match.score} />
        <View style={{ flex: 1, gap: 4, minWidth: 180 }}>
          <Label>
            {match.matched.length} of {match.matched.length + match.missing.length} skills in the posting are on your resume
          </Label>
          {match.role_skills.title ? (
            <Muted>
              Closest role in the skill graph: {match.role_skills.title} ({match.role_skills.skills.join(', ')})
            </Muted>
          ) : null}
        </View>
      </View>
      <SectionTitle>Matching skills</SectionTitle>
      {match.matched.length ? (
        <ChipRow>
          {match.matched.map((s) => (
            <Chip key={s} label={s} tone="success" icon="checkmark" />
          ))}
        </ChipRow>
      ) : (
        <Muted>None yet.</Muted>
      )}
      <SectionTitle>Missing skills</SectionTitle>
      {match.missing.length ? (
        <ChipRow>
          {match.missing.map((s) => (
            <Chip key={s} label={s} tone="danger" icon="close" />
          ))}
        </ChipRow>
      ) : (
        <Muted>You have every skill the posting lists.</Muted>
      )}
      {match.related.length > 0 && (
        <>
          <SectionTitle>Related skills you have (Graph RAG)</SectionTitle>
          <View style={{ gap: 6 }}>
            {match.related.map((r, i) => (
              <View key={i} style={styles.relRow}>
                <Chip label={r.related_skill_you_have} tone="success" />
                <Muted>{r.relation} →</Muted>
                <Chip label={r.missing} tone="info" />
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'flex-start', gap: spacing.md },
  viewToggle: { width: 210 },
  matchTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.lg },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13 },
});
