// Formatting helpers shared by the Jobs pages.

const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£', SGD: 'S$', AED: 'AED ', CAD: 'C$', AUD: 'A$' };

export const WORK_MODE_LABEL = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Onsite' };
export const EMPLOYMENT_LABEL = { 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', internship: 'Internship' };

export const EXPERIENCE_OPTIONS = [
  { value: '', label: 'Any experience' },
  { value: 'fresher', label: 'Fresher' },
  { value: 'entry', label: 'Entry-level (0-2 yrs)' },
  { value: '1-2', label: '1-2 years' },
  { value: '2-4', label: '2-4 years' },
  { value: '4-6', label: '4-6 years' },
  { value: '6-10', label: '6-10 years' },
  { value: '10+', label: '10+ years' },
];

export const SALARY_OPTIONS = [
  { value: '', label: 'Any salary' },
  { value: '5', label: '₹5 LPA+' },
  { value: '10', label: '₹10 LPA+' },
  { value: '20', label: '₹20 LPA+' },
  { value: '30', label: '₹30 LPA+' },
  { value: '50', label: '₹50 LPA+' },
];

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'newest', label: 'Newest first' },
  { value: 'salary-high', label: 'Salary: high to low' },
  { value: 'salary-low', label: 'Salary: low to high' },
  { value: 'experience-low', label: 'Experience: low to high' },
];

export function formatExperience(job) {
  const min = job.experienceMinYears;
  const max = job.experienceMaxYears;
  if (min === undefined || min === null) return job.experienceLevel === 'fresher' ? 'Fresher' : `${job.yearsRequired || 0}+ years`;
  if (min === 0 && (max ?? 0) <= 1) return 'Fresher';
  if (min === 0) return `0-${max} years`;
  return `${min}-${max} years`;
}

const trim1 = (n) => String(+n.toFixed(1));
const thousands = (n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

// Returns e.g. "₹8-12 LPA", "₹15k-20k / month", "$61k-84k / year" or '' when not available.
export function formatSalary(job) {
  const { salaryMin, salaryMax, salaryCurrency = 'INR', salaryPeriod = 'year' } = job;
  if (!salaryMax) return '';
  const symbol = CURRENCY_SYMBOL[salaryCurrency] || `${salaryCurrency} `;
  if (salaryCurrency === 'INR' && salaryPeriod === 'year') {
    const crore = salaryMax >= 10000000;
    const div = crore ? 10000000 : 100000;
    const hi = trim1(salaryMax / div);
    const lo = salaryMin ? trim1(salaryMin / div) : '';
    return `₹${lo ? `${lo}-` : ''}${hi}${crore ? ' Cr' : ' LPA'}`;
  }
  const lo = salaryMin ? thousands(salaryMin) : '';
  return `${symbol}${lo ? `${lo}-` : ''}${thousands(salaryMax)} / ${salaryPeriod === 'month' ? 'month' : 'year'}`;
}

export function formatLocation(job) {
  // City 'Remote' means no fixed office; otherwise always show the real city (work mode is shown separately).
  if (job.city === 'Remote') return `Remote, ${job.country || 'India'}`;
  return `${job.city}, ${job.country || 'India'}`;
}

export function timeAgo(date) {
  if (!date) return '';
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return 'Posted today';
  if (days === 1) return 'Posted yesterday';
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return `Posted ${months} month${months > 1 ? 's' : ''} ago`;
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const isDemo = (job) => job?.source === 'demo';
