// Client-side checks that mirror the server's admin validation (the server stays the authority).

export function isHttpUrl(v) {
  if (!v) return true;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

// `form` holds strings straight from inputs. Returns { field: message }. `today` is injectable for tests.
export function validateJobForm(form, { today = new Date(), originalDeadline = '' } = {}) {
  const e = {};
  if (!String(form.title || '').trim()) e.title = 'Title is required';
  if (!form.company) e.company = 'Choose a company';
  if (!String(form.city || '').trim()) e.city = 'City is required';
  if (!String(form.jobDescription || '').trim()) e.jobDescription = 'Description is required';
  if (String(form.category || '').trim().length > 80) e.category = 'Category must be at most 80 characters';
  if (!isHttpUrl(String(form.applyUrl || '').trim())) e.applyUrl = 'Apply URL must start with http:// or https://';

  const min = num(form.experienceMinYears);
  const max = num(form.experienceMaxYears);
  if (min !== null && (!Number.isFinite(min) || min < 0 || min > 50)) e.experienceMinYears = 'Enter 0-50';
  if (max !== null && (!Number.isFinite(max) || max < 0 || max > 60)) e.experienceMaxYears = 'Enter 0-60';
  if (!e.experienceMinYears && !e.experienceMaxYears && min !== null && max !== null && max < min) e.experienceMaxYears = 'Maximum cannot be lower than minimum';

  const smin = num(form.salaryMin);
  const smax = num(form.salaryMax);
  if (smin !== null && (!Number.isFinite(smin) || smin < 0)) e.salaryMin = 'Enter a number of 0 or more';
  if (smax !== null && (!Number.isFinite(smax) || smax < 0)) e.salaryMax = 'Enter a number of 0 or more';
  if (!e.salaryMin && !e.salaryMax && smin !== null && smax !== null && smax < smin) e.salaryMax = 'Maximum cannot be lower than minimum';

  if (form.applicationDeadline) {
    const d = new Date(form.applicationDeadline);
    if (Number.isNaN(d.getTime())) e.applicationDeadline = 'Enter a valid date';
    else if (form.applicationDeadline !== originalDeadline) {
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (d < startOfToday) e.applicationDeadline = 'Deadline cannot be in the past';
    }
  }
  return e;
}

export function validateCompanyForm(form) {
  const e = {};
  const name = String(form.name || '').trim();
  if (name.length < 2 || name.length > 120) e.name = 'Name must be 2-120 characters';
  if (!isHttpUrl(String(form.website || '').trim())) e.website = 'Website must start with http:// or https://';
  if (!isHttpUrl(String(form.logoUrl || '').trim())) e.logoUrl = 'Logo URL must start with http:// or https://';
  return e;
}
