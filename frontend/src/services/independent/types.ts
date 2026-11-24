/** Shapes returned by the Irish backend (see backend/api). */

export type JobStatus = 'Applied' | 'Interview in progress' | 'Rejected' | 'Successful';
export const JOB_STATUSES: JobStatus[] = ['Applied', 'Interview in progress', 'Rejected', 'Successful'];

export type LlmProvider = 'ollama' | 'groq' | 'gemini' | 'stub';

export interface Location {
  city: string | null;
  province: string | null;
}

export interface Resume {
  id: string;
  name: string;
  text?: string;
  /** upload = file, tailored = copy of a submitted application's resume, text = old pasted resume */
  source?: 'upload' | 'tailored' | 'text';
  from_tailored_id?: string;
  created_at: string;
  analysis: {
    skills: string[];
    word_count: number;
    location: Location;
    contact?: { email: string | null; phone: string | null };
    sections?: string[];
  };
}

export interface Posting {
  id: string;
  title: string | null;
  company: string | null;
  city: string | null;
  province: string | null;
  url: string | null;
  source: 'link' | 'text' | 'image';
  text?: string;
  ocr_confidence?: number | null;
  created_at: string;
  analysis: {
    skills: string[];
    word_count: number;
    location: Location;
    years_experience_required?: number | null;
  };
}

export interface RelatedSkill {
  missing: string;
  related_skill_you_have: string;
  relation: string;
}

export interface MatchResult {
  matched: string[];
  missing: string[];
  extra: string[];
  score: number;
  related: RelatedSkill[];
  role_skills: { title: string | null; skills: string[] };
  graph_backend: string;
}

export interface TailorResult {
  id: string;
  tailored_resume: string;
  analysis: MatchResult;
  llm: { provider: string; model: string };
  warning: string | null;
}

export interface Tailored {
  id: string;
  text: string;
  company: string | null;
  title: string | null;
  score: number;
  llm: { provider: string; model: string };
  saved_path?: string;
  posting_id?: string;
  resume_id?: string | null;
  created_at: string;
}

// ---- Applications in progress (Tailor tab -> "Application progress") ----

/** Where the selected resume came from (the "Choose a resume" popup). */
export type ResumeSource = 'upload' | 'submitted' | 'profile';

export interface Application {
  id: string;
  status: 'in_progress' | 'submitted';
  resume_id: string | null;
  resume_source: ResumeSource | null;
  resume_name: string | null;
  posting_id: string | null;
  title: string | null;
  company: string | null;
  city: string | null;
  province: string | null;
  url: string | null;
  match_score: number | null;
  tailored_id: string | null;
  credential_id: string | null;
  /** Set when "Open job portal" was pressed -> "Waiting to submit". */
  portal_opened_at: string | null;
  submitted_at: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  // Worked out by the backend
  step: number;
  total_steps: number;
  step_label: string;
  waiting_to_submit: boolean;
  progress: number;
}

export interface ApplicationDetail extends Application {
  resume: Resume | null;
  posting: Posting | null;
  tailored: Tailored | null;
}

export type ApplicationChanges = Partial<
  Pick<Application, 'resume_id' | 'resume_source' | 'posting_id' | 'tailored_id' | 'match_score' | 'credential_id'>
>;

/** The resume used in one submitted application (same order as the Job Tracker). */
export interface SubmittedResume {
  job_id: string;
  tailored_id: string;
  title: string | null;
  company: string | null;
  city: string | null;
  province: string | null;
  status: JobStatus | null;
  applied_at: string;
  score: number | null;
}

export interface ResumeOptions {
  submitted: SubmittedResume[];
  uploads: Resume[];
  profile: { saved: boolean; full_name: string | null; updated_at: string | null };
}

export interface HistoryItem {
  company: string;
  file_name: string;
  path: string;
  format: 'pdf' | 'docx' | 'txt';
  size_bytes: number;
  modified: number;
}

export interface TrackerEmail {
  id: string;
  job_id: string;
  subject: string;
  sender: string;
  link: string | null;
  received_at: string;
  detected_status: JobStatus | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  city: string | null;
  province: string | null;
  url: string | null;
  status: JobStatus;
  applied_at: string;
  notes: string;
  resume_id: string | null;
  status_history: { status: JobStatus; at: string; by: 'user' | 'agent' }[];
  emails?: TrackerEmail[];
  prompt_success_options?: SuccessAction[] | null;
  created_at: string;
  updated_at?: string;
}

export type SuccessAction = 'delete_history' | 'save_zip' | 'stop_tracker';

export interface JobList {
  jobs: Job[];
  filters: { companies: string[]; cities: string[]; provinces: string[]; statuses: string[] };
  state: { enabled: boolean };
}

export interface EmailResult {
  is_job: boolean;
  status: JobStatus | null;
  confidence?: number;
  job_id?: string;
  job_created?: boolean;
  status_changed?: boolean;
  skipped?: string;
  reason?: string;
}

export interface Credential {
  id: string;
  company: string;
  site_url: string;
  domain: string | null;
  username: string;
  username_masked: string;
  password_masked: string;
  permission_to_apply: boolean;
  updated_at: string;
}

export interface Experience {
  title: string;
  company: string;
  location?: string | null;
  start: string;
  end?: string | null;
  bullets: string[];
}
export interface Education {
  credential: string;
  institution: string;
  start: string;
  end?: string | null;
}
export interface Project {
  name: string;
  description: string;
  technologies: string[];
}

export interface Profile {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  linkedin?: string | null;
  github?: string | null;
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  certifications: string[];
}

export const EMPTY_PROFILE: Profile = {
  full_name: '',
  email: '',
  phone: '',
  city: '',
  province: '',
  linkedin: '',
  github: '',
  summary: '',
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
};

export interface Health {
  status: string;
  app: string;
  llm: { provider: string; model: string };
  llm_fallback_to_stub: boolean;
  graph: string;
  database: string;
  ocr: string;
}
