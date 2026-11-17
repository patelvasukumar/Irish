/** Profile form. Used to write a resume when the user has none. */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import {
  Banner,
  Button,
  Card,
  Dialog,
  Loading,
  MarkdownView,
  Muted,
  Row,
  Screen,
  spacing,
  TextField,
} from '@common/dependent';

import { useAction, useLoader } from '../../services/dependent/hooks';
import { useApi } from '../../services/dependent/settings';
import { splitList } from '../../services/independent/format';
import { EMPTY_PROFILE, Education, Experience, Profile, Project } from '../../services/independent/types';

const half = { flex: 1, minWidth: 160 } as const;

export default function ProfileScreen() {
  const api = useApi();
  const { data, error, loading } = useLoader(useCallback(() => api.profile(), [api]));

  if (loading && !data) return <Loading label="Loading profile…" />;
  // The form starts from the saved profile; it reloads only when the screen opens again.
  return <ProfileForm key={data ? 'loaded' : 'empty'} initial={{ ...EMPTY_PROFILE, ...(data ?? {}) } as Profile} error={error} />;
}

function ProfileForm({ initial, error }: { initial: Profile; error: string | null }) {
  const api = useApi();
  const { busy, run } = useAction();
  const [p, setP] = useState<Profile>(initial);
  // Comma-separated text boxes keep what the user types (incl. trailing commas).
  const [skillsText, setSkillsText] = useState(initial.skills.join(', '));
  const [certsText, setCertsText] = useState(initial.certifications.join(', '));
  const [preview, setPreview] = useState<string | null>(null);

  const set = <K extends keyof Profile>(k: K) => (v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
    const body: Profile = {
      ...p,
      skills: splitList(skillsText),
      certifications: splitList(certsText),
      experience: p.experience.map((e) => ({ ...e, bullets: clean(e.bullets) })),
      projects: p.projects.map((pr) => ({ ...pr, technologies: clean(pr.technologies) })),
    };
    const saved = await run('save', () => api.saveProfile(body), 'Profile saved');
    if (saved) setP({ ...EMPTY_PROFILE, ...saved });
  };

  const showPreview = async () => {
    await save();
    const r = await run('preview', () => api.profilePreview());
    if (r) setPreview(r.text);
  };

  return (
    <Screen
      title="Profile"
      subtitle="Your details. If you have no resume, Irish writes one from this form."
      actions={
        <>
          <Button title="Preview resume" variant="secondary" icon="eye-outline" small loading={busy === 'preview'} disabled={!p.full_name.trim()} onPress={showPreview} />
          <Button title="Save" icon="save-outline" small loading={busy === 'save'} onPress={save} />
        </>
      }
    >
      {error && <Banner tone="danger" message={error} />}

      <Card title="Contact" icon="person-outline">
        <TextField label="Full name *" value={p.full_name} onChangeText={set('full_name')} autoComplete="name" />
        <Row>
          <View style={half}>
            <TextField label="Email" value={p.email ?? ''} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          </View>
          <View style={half}>
            <TextField label="Phone" value={p.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
          </View>
        </Row>
        <Row>
          <View style={half}>
            <TextField label="City" placeholder="Ottawa" value={p.city ?? ''} onChangeText={set('city')} />
          </View>
          <View style={half}>
            <TextField label="Province" placeholder="ON" value={p.province ?? ''} onChangeText={set('province')} />
          </View>
        </Row>
        <Row>
          <View style={half}>
            <TextField label="LinkedIn" value={p.linkedin ?? ''} onChangeText={set('linkedin')} autoCapitalize="none" />
          </View>
          <View style={half}>
            <TextField label="GitHub" value={p.github ?? ''} onChangeText={set('github')} autoCapitalize="none" />
          </View>
        </Row>
      </Card>

      <Card title="Summary and skills" icon="sparkles-outline">
        <TextField label="Summary" lines={3} value={p.summary} onChangeText={set('summary')} placeholder="Two or three sentences about you" />
        <TextField label="Skills" hint="Separate with commas" value={skillsText} onChangeText={setSkillsText} placeholder="Python, React, SQL, Teamwork" />
        <TextField label="Certifications" hint="Separate with commas" value={certsText} onChangeText={setCertsText} />
      </Card>

      <ListCard<Experience>
        title="Work experience"
        icon="briefcase-outline"
        items={p.experience}
        onChange={set('experience')}
        empty={{ title: '', company: '', location: '', start: '', end: '', bullets: [] }}
        addLabel="Add job"
        render={(e, update) => (
          <>
            <Row>
              <View style={half}><TextField label="Job title" value={e.title} onChangeText={(title) => update({ title })} /></View>
              <View style={half}><TextField label="Company" value={e.company} onChangeText={(company) => update({ company })} /></View>
            </Row>
            <Row>
              <View style={half}><TextField label="Start" placeholder="2023" value={e.start} onChangeText={(start) => update({ start })} /></View>
              <View style={half}><TextField label="End" placeholder="Present" value={e.end ?? ''} onChangeText={(end) => update({ end })} /></View>
              <View style={half}><TextField label="Location" value={e.location ?? ''} onChangeText={(location) => update({ location })} /></View>
            </Row>
            <TextField
              label="What you did"
              hint="One point per line"
              lines={4}
              value={e.bullets.join('\n')}
              onChangeText={(t) => update({ bullets: t.split('\n') })}
            />
          </>
        )}
      />

      <ListCard<Education>
        title="Education"
        icon="school-outline"
        items={p.education}
        onChange={set('education')}
        empty={{ credential: '', institution: '', start: '', end: '' }}
        addLabel="Add education"
        render={(e, update) => (
          <>
            <Row>
              <View style={half}><TextField label="Credential" placeholder="Computer Programming Diploma" value={e.credential} onChangeText={(credential) => update({ credential })} /></View>
              <View style={half}><TextField label="School" placeholder="Algonquin College" value={e.institution} onChangeText={(institution) => update({ institution })} /></View>
            </Row>
            <Row>
              <View style={half}><TextField label="Start" value={e.start} onChangeText={(start) => update({ start })} /></View>
              <View style={half}><TextField label="End" placeholder="Present" value={e.end ?? ''} onChangeText={(end) => update({ end })} /></View>
            </Row>
          </>
        )}
      />

      <ListCard<Project>
        title="Projects"
        icon="construct-outline"
        items={p.projects}
        onChange={set('projects')}
        empty={{ name: '', description: '', technologies: [] }}
        addLabel="Add project"
        render={(pr, update) => (
          <>
            <TextField label="Project name" value={pr.name} onChangeText={(name) => update({ name })} />
            <TextField label="Description" lines={2} value={pr.description} onChangeText={(description) => update({ description })} />
            <TextField
              label="Technologies"
              hint="Separate with commas"
              value={pr.technologies.join(', ')}
              onChangeText={(t) => update({ technologies: t.split(',').map((x) => x.trimStart()) })}
            />
          </>
        )}
      />

      <Button title="Save profile" icon="save-outline" loading={busy === 'save'} onPress={save} />

      <Dialog visible={preview !== null} title="Resume from your profile" onClose={() => setPreview(null)} wide>
        <Muted>This is the resume Irish uses when you pick “Profile” in the Tailor tab.</Muted>
        {preview ? <MarkdownView text={preview} /> : null}
      </Dialog>
    </Screen>
  );
}

/** Editable list of items (jobs, schools, projects) with add / remove. */
function ListCard<T>({
  title,
  icon,
  items,
  onChange,
  empty,
  addLabel,
  render,
}: {
  title: string;
  icon: React.ComponentProps<typeof Card>['icon'];
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  addLabel: string;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <Card title={title} icon={icon} action={<Button title={addLabel} icon="add" variant="ghost" small onPress={() => onChange([...items, { ...empty }])} />}>
      {items.length === 0 ? <Muted>Nothing added yet.</Muted> : null}
      {items.map((item, i) => (
        <View key={i} style={{ gap: spacing.sm, paddingTop: i ? spacing.md : 0, borderTopWidth: i ? 1 : 0, borderTopColor: '#E5ECE8' }}>
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <Button title="Remove" variant="ghost" icon="trash-outline" small onPress={() => onChange(items.filter((_, j) => j !== i))} />
        </View>
      ))}
    </Card>
  );
}
