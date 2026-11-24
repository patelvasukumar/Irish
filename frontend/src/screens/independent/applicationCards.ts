/** Pure text helpers for the Tailor tab's "Application progress" cards and resume popup. */
import { formatDate, place } from '../../services/independent/format';
import type { Application, Resume, ResumeSource, SubmittedResume } from '../../services/independent/types';

export function cardTitle(app: Pick<Application, 'title'>): string {
  return app.title || 'New application';
}

export function cardSubtitle(app: Pick<Application, 'company' | 'city' | 'province'>): string {
  if (!app.company) return 'No job posting yet';
  return [app.company, place(app.city, app.province)].filter(Boolean).join(' · ');
}

/** "Step 4 of 5 · Tailored resume" or "Waiting to submit". */
export function stepText(app: Pick<Application, 'step' | 'total_steps' | 'step_label' | 'waiting_to_submit'>): string {
  if (app.waiting_to_submit) return 'Waiting to submit';
  return `Step ${app.step} of ${app.total_steps} · ${app.step_label}`;
}

export function cardInitial(app: Pick<Application, 'company'>): string {
  return app.company ? app.company.trim().charAt(0).toUpperCase() : '+';
}

export function progressSummary(apps: Pick<Application, 'waiting_to_submit'>[]): string {
  if (!apps.length) return 'No applications in progress. Press + to start one.';
  const waiting = apps.filter((a) => a.waiting_to_submit).length;
  const count = `${apps.length} ${apps.length === 1 ? 'application' : 'applications'} not submitted yet`;
  return waiting ? `${count} · ${waiting} waiting for you to submit on the portal` : count;
}

export function submittedTitle(entry: Pick<SubmittedResume, 'title' | 'company'>): string {
  return [entry.title, entry.company].filter(Boolean).join(' · ') || 'Submitted application';
}

/** "Tailored resume · submitted Nov 22, 2026 · 81% match" */
export function submittedLine(entry: Pick<SubmittedResume, 'applied_at' | 'score'>): string {
  const parts = ['Tailored resume', `submitted ${formatDate(entry.applied_at)}`];
  if (entry.score != null) parts.push(`${entry.score}% match`);
  return parts.join(' · ');
}

/** Line under the selected resume's name. */
export function resumeMeta(source: ResumeSource, resume?: Pick<Resume, 'analysis'> | null): string {
  if (source === 'profile') return 'Irish writes the resume from your Profile form';
  const skills = resume?.analysis.skills.length ?? 0;
  const found = `${skills} ${skills === 1 ? 'skill' : 'skills'} found`;
  return source === 'submitted' ? `From a submitted application · ${found}` : `Uploaded file · ${found}`;
}
