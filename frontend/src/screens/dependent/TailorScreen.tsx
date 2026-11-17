/**
 * Main flow (demo steps 2-5):
 *   1. Resume (upload / paste / saved / profile)      -> C1
 *   2. Job posting (link / text / screenshot)        -> C1, C3
 *   3. Matching + missing skills, graph context      -> C1, C4
 *   4. Tailored resume: write, edit, save, apply     -> C2, C7, C8
 */
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
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
import { pickResumeFile, pickScreenshot } from '../../services/dependent/pickers';
import { useApi } from '../../services/dependent/settings';
import { formatDate, isValidUrl, place, safeFileName } from '../../services/independent/format';
import type {
  Credential,
  LlmProvider,
  MatchResult,
  Posting,
  Resume,
  TailorResult,
} from '../../services/independent/types';

type ResumeMode = 'upload' | 'paste' | 'saved' | 'profile';
type PostingMode = 'link' | 'text' | 'image';
type ResumeChoice = { kind: 'resume'; resume: Resume } | { kind: 'profile' } | null;

const PROVIDERS: { value: LlmProvider | 'default'; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'stub', label: 'Offline' },
];

export default function TailorScreen() {
  const api = useApi();
  const toast = useToast();
  const { busy, run } = useAction();

  // ---- step 1: resume
  const [resumeMode, setResumeMode] = useState<ResumeMode>('upload');
  const [resumeText, setResumeText] = useState('');
  const [savedResumes, setSavedResumes] = useState<Resume[] | null>(null);
  const [choice, setChoice] = useState<ResumeChoice>(null);

  // ---- step 2: posting
  const [postingMode, setPostingMode] = useState<PostingMode>('link');
  const [link, setLink] = useState('');
  const [postingText, setPostingText] = useState('');
  const [posting, setPosting] = useState<Posting | null>(null);
  const [postingError, setPostingError] = useState<string | null>(null);
  const [busyPosting, setBusyPosting] = useState(false);

  // ---- step 3 + 4
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [instructions, setInstructions] = useState('');
  const [provider, setProvider] = useState<LlmProvider | 'default'>('default');
  const [result, setResult] = useState<TailorResult | null>(null);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState(true);
  const [format, setFormat] = useState<'pdf' | 'docx' | 'txt'>('pdf');
  const [fileName, setFileName] = useState('');
  const [saved, setSaved] = useState<{ saved: string; download_url: string } | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ jobId: string; openUrl: string | null; automation: string } | null>(null);

  const dirty = !!result && draft !== result.tailored_resume;

  // Changing the resume or the posting clears the later steps and,
  // when both are ready, runs step 3 (skill match) automatically.
  const matchToken = useRef(0);
  const applyInputs = useCallback(
    (c: ResumeChoice, p: Posting | null) => {
      setChoice(c);
      setPosting(p);
      setMatch(null);
      setResult(null);
      setSaved(null);
      setApplied(null);
      const token = ++matchToken.current;
      if (c && p) {
        run('match', () => api.match(p.id, c.kind === 'resume' ? c.resume.id : null)).then((m) => {
          if (m && token === matchToken.current) setMatch(m);
        });
      }
    },
    [api, run],
  );
  const selectResume = (c: ResumeChoice) => applyInputs(c, posting);
  const selectPosting = (p: Posting | null) => applyInputs(choice, p);

  const changeResumeMode = (mode: ResumeMode) => {
    setResumeMode(mode);
    if (mode === 'saved') {
      api.listResumes().then(setSavedResumes).catch(() => setSavedResumes([]));
    }
  };

  // ---------------------------------------------------------------- actions
  const uploadResume = async () => {
    const file = await pickResumeFile().catch((e) => {
      toast((e as Error).message, 'danger');
      return null;
    });
    if (!file) return;
    const r = await run('resume', () => api.uploadResume(file), `Read ${file.name}`);
    if (r) {
      selectResume({ kind: 'resume', resume: r });
      setSavedResumes(null);
    }
  };

  const pasteResume = async () => {
    const r = await run('resume', () => api.pasteResume(resumeText), 'Resume added');
    if (r) {
      selectResume({ kind: 'resume', resume: r });
      setSavedResumes(null);
    }
  };

  const useProfile = async () => {
    const ok = await run('resume', () => api.profilePreview());
    if (ok) selectResume({ kind: 'profile' });
  };

  const readPosting = async (fn: () => Promise<Posting>) => {
    setPostingError(null);
    setBusyPosting(true);
    try {
      const p = await fn();
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
    const r = await run('tailor', () =>
      api.tailor(posting.id, choice?.kind === 'resume' ? choice.resume.id : null, instructions, provider === 'default' ? null : provider),
    );
    if (r) {
      setResult(r);
      setDraft(r.tailored_resume);
      setPreview(true);
      setSaved(null);
      setApplied(null);
      api.credentials().then(setCredentials).catch(() => setCredentials([]));
    }
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
    if (s) setSaved(s);
  };

  const download = async () => {
    if (!saved) return;
    const name = saved.saved.split('/').pop() ?? `resume.${format}`;
    await run('download', () => platform.saveDownload(`${api.baseUrl}${saved.download_url}`, name));
  };

  const apply = async () => {
    if (!result) return;
    if (dirty) await saveEdits();
    const r = await run('apply', () => api.apply(result.id, credentialId), 'Added to the Job Application Tracker');
    if (r) setApplied({ jobId: r.job.id, openUrl: r.open_url, automation: r.automation });
  };

  const resetAll = () => {
    applyInputs(null, null);
    setLink('');
    setPostingText('');
    setResumeText('');
    setInstructions('');
  };

  const permitted = credentials.filter((c) => c.permission_to_apply);

  // ---------------------------------------------------------------- render
  return (
    <Screen
      title="Tailor your resume"
      subtitle="Give a resume and a job posting. Irish finds the matching skills and rewrites your resume for the job."
      actions={
        choice || posting ? <Button title="Start over" variant="ghost" icon="refresh" small onPress={resetAll} /> : null
      }
    >
      {/* STEP 1 */}
      <Card
        step={1}
        done={!!choice}
        title="Your resume"
        subtitle={
          choice?.kind === 'resume'
            ? `${choice.resume.name} · ${choice.resume.analysis.skills.length} skills found`
            : choice?.kind === 'profile'
              ? 'Using the details from your profile form'
              : 'Upload a file, paste text, pick a saved one, or use your profile'
        }
        action={choice ? <Button title="Change" variant="ghost" small onPress={() => selectResume(null)} /> : null}
      >
        {choice?.kind === 'resume' ? (
          <SkillList skills={choice.resume.analysis.skills} />
        ) : choice?.kind === 'profile' ? null : (
          <>
            <Segmented
              value={resumeMode}
              onChange={changeResumeMode}
              options={[
                { value: 'upload', label: 'Upload', icon: 'cloud-upload-outline' },
                { value: 'paste', label: 'Paste', icon: 'clipboard-outline' },
                { value: 'saved', label: 'Saved', icon: 'folder-open-outline' },
                { value: 'profile', label: 'Profile', icon: 'person-outline' },
              ]}
            />
            {resumeMode === 'upload' && (
              <View style={styles.center}>
                <Muted>PDF, DOCX or TXT, up to 10 MB.</Muted>
                <Button title="Choose resume file" icon="document-attach-outline" loading={busy === 'resume'} onPress={uploadResume} />
              </View>
            )}
            {resumeMode === 'paste' && (
              <>
                <TextField
                  label="Resume text"
                  placeholder="Paste your full resume here…"
                  lines={8}
                  value={resumeText}
                  onChangeText={setResumeText}
                />
                <Button
                  title="Use this resume"
                  icon="checkmark"
                  disabled={resumeText.trim().length < 30}
                  loading={busy === 'resume'}
                  onPress={pasteResume}
                />
              </>
            )}
            {resumeMode === 'saved' && (
              <View style={{ gap: spacing.sm }}>
                {savedResumes === null ? (
                  <Muted>Loading…</Muted>
                ) : savedResumes.length === 0 ? (
                  <Muted>No saved resumes yet. Upload or paste one first.</Muted>
                ) : (
                  savedResumes.map((r) => (
                    <Card
                      key={r.id}
                      icon="document-text-outline"
                      title={r.name}
                      subtitle={`${r.analysis.skills.length} skills · ${formatDate(r.created_at)}`}
                      onPress={() => selectResume({ kind: 'resume', resume: r })}
                    />
                  ))
                )}
              </View>
            )}
            {resumeMode === 'profile' && (
              <View style={styles.center}>
                <Muted>No resume? Irish writes one from your profile form.</Muted>
                <Row>
                  <Button title="Use my profile" icon="person-circle-outline" loading={busy === 'resume'} onPress={useProfile} />
                  <Button title="Edit profile" variant="secondary" onPress={() => router.push('/profile')} />
                </Row>
              </View>
            )}
          </>
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
        subtitle={match ? `Graph: ${match.graph_backend}` : 'Appears when steps 1 and 2 are done'}
      >
        {busy === 'match' && <Muted>Comparing skills…</Muted>}
        {match && <MatchView match={match} />}
      </Card>

      {/* STEP 4 */}
      <Card step={4} done={!!saved} title="Tailored resume" subtitle="Written by a free AI model (C2)">
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
              {saved && (
                <Button title="Download" variant="secondary" icon="share-outline" loading={busy === 'download'} onPress={download} />
              )}
            </Row>
            {saved ? <Banner tone="success" message={`Saved in history/${saved.saved}`} /> : null}

            <SectionTitle>Apply</SectionTitle>
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
            <Button title="Apply & add to tracker" icon="paper-plane-outline" loading={busy === 'apply'} onPress={apply} />
            {applied && (
              <View style={{ gap: spacing.sm }}>
                <Banner
                  tone="success"
                  title="Added to the tracker with status Applied"
                  message={
                    applied.automation === 'manual'
                      ? 'Open the posting to finish your application.'
                      : 'Permission given: open the site to finish applying.'
                  }
                />
                <Row>
                  {applied.openUrl ? (
                    <Button title="Open job posting" variant="secondary" icon="open-outline" small onPress={() => Linking.openURL(applied.openUrl!)} />
                  ) : null}
                  <Button title="View in tracker" variant="secondary" icon="list-outline" small onPress={() => router.push(`/tracker/${applied.jobId}`)} />
                </Row>
              </View>
            )}
          </View>
        )}
      </Card>
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
