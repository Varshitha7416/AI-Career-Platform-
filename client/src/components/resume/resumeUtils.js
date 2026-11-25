// Shared helpers for the Resume Analyzer UI (plain JS, no components).
export const MAX_RESUME_SIZE = 5 * 1024 * 1024;
export const ALLOWED_EXT = ['pdf', 'docx', 'txt'];

export function fileExt(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

// Returns an error message, or '' when the file is acceptable.
export function validateResumeFile(file) {
  if (!file) return 'Please choose a file.';
  if (!ALLOWED_EXT.includes(fileExt(file.name))) return 'Unsupported file type. Please upload a PDF, DOCX or TXT file.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_RESUME_SIZE) return 'File is too large. The maximum size is 5 MB.';
  return '';
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Friendly message for AI-related failures (codes from the API contract).
export function aiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const code = err?.response?.data?.code;
  if (code === 'AI_QUOTA') return 'The AI service has reached its usage limit. Please try again later.';
  if (code === 'RATE_LIMIT') return 'You have reached the hourly limit for AI requests. Please try again in a while.';
  if (code === 'AI_UNAVAILABLE') return 'The AI service is not available right now. Please try again later.';
  if (code === 'AI_BAD_RESPONSE') return 'The AI returned an unusable answer. Nothing was saved. Please try again.';
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the backend is running.';
  return fallback;
}

export function jobLabel(job) {
  if (!job) return '';
  const company = job.company?.name || job.company;
  return company && typeof company === 'string' ? `${job.title} - ${company}` : job.title;
}

export function snapshotJobLabel(a) {
  const j = a.job ? { title: a.job.title, company: a.job.company?.name || a.job.company } : a.jobSnapshot;
  if (!j?.title) return '';
  return j.company ? `${j.title} - ${j.company}` : j.title;
}

export function snapshotResumeName(a) {
  const r = a.resume || a.resumeSnapshot;
  return r?.name || r?.fileName || 'Resume';
}
