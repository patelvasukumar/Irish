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
  /** Overall fit by meaning (embeddings). Missing on tailor results. */
  fit?: SemanticFit;
}

// ---- Semantic match (embeddings + pgvector)
export type SemanticFit =
  | { available: true; score: number; similarity: number }
  | { available: false; reason: string };

type Unavailable = { available: false; reason: string };

export interface BestResume {
  resume_id: string;
  name: string;
  created_at: string;
  fit: number;
  similarity: number;
  skill_score: number;
}
export type BestResumes = { available: true; resumes: BestResume[] } | Unavailable;

export interface DuplicatePosting {
  posting_id: string;
  title: string | null;
  company: string | null;
  created_at: string;
  similarity: number;
  applications: { job_id: string; status: string; applied_at: string }[];
}
export type Duplicates = { available: true; duplicates: DuplicatePosting[]; already_applied: boolean } | Unavailable;

export interface SimilarJob {
  job_id: string;
  title: string;
  company: string;
  status: string;
  applied_at: string;
  fit: number;
  similarity: number;
}
export type SimilarJobs = { available: true; jobs: SimilarJob[]; summary: Record<string, number> } | Unavailable;

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
  created_at: string;
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
  posting_id?: string | null;
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
