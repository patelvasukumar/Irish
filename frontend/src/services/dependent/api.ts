/**
 * Typed client for the Irish backend. Every screen talks to the backend
 * through this class only.
 */
import { platform, PickedFile } from '@common/dependent';

import type {
  Credential,
  EmailResult,
  Health,
  HistoryItem,
  Job,
  JobList,
  JobStatus,
  LlmProvider,
  MatchResult,
  Posting,
  Profile,
  Resume,
  SuccessAction,
  Tailored,
  TailorResult,
} from '../independent/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface JobFilters {
  days?: number | null;
  company?: string | null;
  city?: string | null;
  province?: string | null;
  status?: string | null;
  search?: string | null;
}

export class ApiClient {
  constructor(public baseUrl: string) {}

  url(path: string, query?: Query): string {
    const q = Object.entries(query ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `${this.baseUrl}/api${path}${q ? `?${q}` : ''}`;
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    let res: Response;
    try {
      res = await fetch(this.url(path, query), {
        method,
        headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(
        `Cannot reach the Irish backend at ${this.baseUrl}. Is it running? (Check Settings.)`,
        0,
      );
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new ApiError(extractError(data) || `Request failed (HTTP ${res.status})`, res.status);
    }
    return data as T;
  }

  private get = <T>(path: string, query?: Query) => this.request<T>('GET', path, undefined, query);
  private post = <T>(path: string, body?: unknown, query?: Query) => this.request<T>('POST', path, body, query);
  private put = <T>(path: string, body?: unknown) => this.request<T>('PUT', path, body);
  private patch = <T>(path: string, body?: unknown) => this.request<T>('PATCH', path, body);
  private del = <T>(path: string, query?: Query) => this.request<T>('DELETE', path, undefined, query);

  private upload<T>(path: string, file: PickedFile): Promise<T> {
    const form = new FormData();
    platform.appendFile(form, 'file', file);
    return this.post<T>(path, form);
  }

  // ---- system
  health = () => this.get<Health>('/health');

  // ---- resumes (C1)
  uploadResume = (file: PickedFile) => this.upload<Resume>('/resumes/upload', file);
  pasteResume = (text: string, name = 'Pasted resume') => this.post<Resume>('/resumes/text', { text, name });
  listResumes = () => this.get<Resume[]>('/resumes');
  deleteResume = (id: string) => this.del<{ deleted: string }>(`/resumes/${id}`);

  // ---- postings (C1, C3)
  postingFromLink = (url: string) => this.post<Posting>('/postings/link', { url });
  postingFromText = (text: string, url?: string) => this.post<Posting>('/postings/text', { text, url: url || null });
  postingFromImage = (file: PickedFile) => this.upload<Posting>('/postings/image', file);
  listPostings = () => this.get<Posting[]>('/postings');
  getPosting = (id: string) => this.get<Posting>(`/postings/${id}`);

  // ---- match (C1 + C4) and tailor (C2)
  match = (posting_id: string, resume_id: string | null) =>
    this.post<MatchResult>('/match', { posting_id, resume_id });
  tailor = (posting_id: string, resume_id: string | null, instructions: string, provider: LlmProvider | null) =>
    this.post<TailorResult>('/tailor', { posting_id, resume_id, instructions, provider });
  getTailored = (id: string) => this.get<Tailored>(`/tailored/${id}`);
  editTailored = (id: string, text: string) => this.put<Tailored>(`/tailored/${id}`, { text });
  saveTailored = (id: string, format: 'pdf' | 'docx' | 'txt', file_name?: string, company?: string) =>
    this.post<{ saved: string; download_url: string }>(`/tailored/${id}/save`, {
      format,
      file_name: file_name || null,
      company: company || null,
    });
  apply = (tailored_id: string, credential_id: string | null) =>
    this.post<{ job: Job; automation: string; open_url: string | null }>('/apply', { tailored_id, credential_id });

  // ---- history
  history = () => this.get<HistoryItem[]>('/history');
  historyDownloadUrl = (path: string) => this.url('/history/download', { path });
  deleteHistory = (target: string) => this.del<{ deleted: string[] }>('/history', { target });

  // ---- tracker (C7)
  jobs = (filters: JobFilters = {}) => this.get<JobList>('/tracker/jobs', filters as Query);
  job = (id: string) => this.get<Job>(`/tracker/jobs/${id}`);
  addJob = (job: Partial<Job>) => this.post<Job>('/tracker/jobs', job);
  updateJob = (id: string, changes: Partial<Pick<Job, 'status' | 'notes' | 'title' | 'company' | 'city' | 'province' | 'url'>>) =>
    this.patch<Job>(`/tracker/jobs/${id}`, changes);
  deleteJob = (id: string) => this.del<{ deleted: string }>(`/tracker/jobs/${id}`);
  sendEmail = (email: { subject: string; sender: string; snippet?: string }) =>
    this.post<EmailResult>('/tracker/emails', email);
  relinkEmail = (emailId: string, jobId: string) => this.patch(`/tracker/emails/${emailId}`, { job_id: jobId });
  checkMailbox = () =>
    this.post<{ checked: number; job_emails: number }>('/tracker/check-mailbox');
  setTrackerEnabled = (enabled: boolean) => this.put<{ enabled: boolean }>('/tracker/state', { enabled });
  exportUrl = () => this.url('/tracker/export');
  successAction = (action: SuccessAction, confirm = false) =>
    this.post<Record<string, unknown>>('/tracker/success-action', { action, confirm });

  // ---- credentials (C8)
  credentials = () => this.get<Credential[]>('/credentials');
  addCredential = (c: { company: string; site_url: string; username: string; password: string; permission_to_apply: boolean }) =>
    this.post<Credential>('/credentials', c);
  updateCredential = (id: string, changes: Partial<{ company: string; site_url: string; username: string; password: string; permission_to_apply: boolean }>) =>
    this.patch<Credential>(`/credentials/${id}`, changes);
  deleteCredential = (id: string) => this.del<{ deleted: string }>(`/credentials/${id}`);

  // ---- profile
  profile = () => this.get<Partial<Profile>>('/profile');
  saveProfile = (p: Profile) => this.put<Profile>('/profile', p);
  profilePreview = () => this.get<{ text: string }>('/profile/resume-preview');
}

/** FastAPI errors: {"detail": "msg"} or {"detail": [{"loc":[...], "msg": "..."}]} */
function extractError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return typeof data === 'string' ? data.slice(0, 300) : null;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = d.loc?.filter((x) => x !== 'body').join('.') ?? '';
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('\n');
  }
  return null;
}

export type { JobStatus };
