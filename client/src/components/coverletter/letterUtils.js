import { getErrorMessage } from '../../utils/errors';

// Friendly messages for the AI error codes in the contract.
export function aiErrorMessage(err, fallback) {
  const code = err?.response?.data?.code;
  if (code === 'AI_QUOTA') return 'The AI service has reached its usage limit. Please try again later.';
  if (code === 'RATE_LIMIT') return 'You have used all your AI requests for this hour. Please try again a little later.';
  if (code === 'AI_UNAVAILABLE') return 'AI features are not available right now. Please try again later.';
  if (code === 'AI_BAD_RESPONSE' || code === 'AI_ERROR') return 'The AI could not produce a usable letter this time. Nothing was saved, please try again.';
  return getErrorMessage(err, fallback);
}

export const MAX_LETTER_CHARS = 12000;

export function jobLabel(letter) {
  const snap = letter?.job || letter?.jobSnapshot;
  const title = letter?.job?.title || letter?.jobSnapshot?.title || 'Untitled role';
  const company = letter?.job?.company?.name || letter?.job?.company || snap?.company || '';
  return { title, company: typeof company === 'string' ? company : '' };
}

export function resumeLabel(letter) {
  const r = letter?.resume || letter?.resumeSnapshot;
  const name = r?.name || r?.fileName || 'Resume';
  return letter?.resumeDeleted || !letter?.resume ? `${name} (deleted)` : name;
}

export function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Reads a blob error body (axios responseType blob) and returns its message if any.
export async function blobErrorMessage(err) {
  try {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      const parsed = JSON.parse(await blob.text());
      if (parsed?.message) return parsed.message;
    }
  } catch {
    // ignore parse errors
  }
  return 'Could not download the letter. Please try again.';
}

export function filenameFromHeaders(headers, fallback) {
  const cd = headers?.['content-disposition'] || '';
  const m = /filename="?([^";]+)"?/i.exec(cd);
  return m ? m[1] : fallback;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
