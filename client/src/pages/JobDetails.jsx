import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import useJobActions from '../hooks/useJobActions';
import { getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import CompanyLogo from '../components/CompanyLogo';
import ApplyFlow from '../components/ApplyFlow';
import { Skeleton, ErrorMessage, SuccessMessage } from '../components/Feedback';
import { ArrowLeft, BookmarkIcon, PinIcon, BriefcaseIcon, UsersIcon, WalletIcon, ClockIcon, TagIcon, ExternalIcon } from '../components/Icons';
import { formatExperience, formatSalary, formatLocation, timeAgo, formatDate, WORK_MODE_LABEL, EMPLOYMENT_LABEL, isDemo } from '../utils/jobs';

function Section({ title, children }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-xl font-bold text-primary mb-3">{title}</h2>
      {children}
    </section>
  );
}

function BulletList({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5 text-ink/85 leading-relaxed">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-sage shrink-0" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items, variant = 'solid' }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className={`text-sm px-3 py-1 rounded-full ${variant === 'solid' ? 'bg-mint text-primary font-medium' : 'border border-sage text-primary/85'}`}>{s}</span>
      ))}
    </div>
  );
}

function Fact({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-lg bg-mint text-primary flex items-center justify-center shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-ink/50">{label}</p>
        <p className="text-sm font-medium text-ink break-words">{children}</p>
      </div>
    </div>
  );
}

function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { savedIds, feedback, busyId, toggleSave } = useJobActions();

  const [job, setJob] = useState(null);
  const [application, setApplication] = useState(null);
  const [more, setMore] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  const fetchJob = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jobRes, appsRes] = await Promise.all([
        axiosClient.get(`/jobs/${id}`),
        axiosClient.get(`/applications/${user.id}`),
      ]);
      setJob(jobRes.data.job);
      setApplication(appsRes.data.applications.find((a) => a?.job?._id === id) || null);
      document.title = `${jobRes.data.job.title} at ${jobRes.data.job.company?.name} | CareerNest`;
      // other jobs from the same company
      axiosClient.get('/jobs', { params: { q: jobRes.data.job.company?.name, limit: 5 } })
        .then((r) => setMore(r.data.jobs.filter((j) => j._id !== id && j.company?._id === jobRes.data.job.company?._id).slice(0, 4)))
        .catch(() => {});
    } catch (err) {
      setError(err.response?.status === 404 ? 'This job no longer exists or has been removed.' : getErrorMessage(err, 'Could not load this job'));
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch on route change
    fetchJob();
    return () => { document.title = 'CareerNest'; };
  }, [fetchJob]);

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/jobs'));
  const saved = job && savedIds.has(job._id);
  const salary = job ? formatSalary(job) : '';

  return (
    <div className="min-h-screen bg-bg">
      <div className="hero-bg border-b border-sage/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <button type="button" onClick={goBack} className="focus-ring inline-flex items-center gap-1.5 text-sm text-primary hover:underline rounded">
            <ArrowLeft size={16} /> Back to Job Discovery
          </button>

          {loading && (
            <div className="mt-5 bg-white rounded-2xl p-6 border border-sage/30">
              <div className="flex gap-4"><Skeleton className="w-16 h-16" /><div className="flex-1"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-1/3 mt-3" /></div></div>
              <Skeleton className="h-4 w-full mt-6" /><Skeleton className="h-4 w-5/6 mt-2" />
            </div>
          )}

          {!loading && error && (
            <div className="mt-5 space-y-3">
              <ErrorMessage message={error} onRetry={error.includes('no longer exists') ? undefined : fetchJob} />
              <Link to="/jobs" className="inline-block bg-primary text-white px-5 py-2 rounded-xl text-sm hover:bg-primary-dark transition">Browse jobs</Link>
            </div>
          )}

          {!loading && job && (
            <div className="mt-5 flex flex-col md:flex-row md:items-start gap-5 md:justify-between">
              <div className="flex gap-4 min-w-0">
                <CompanyLogo company={job.company} size={64} />
                <div className="min-w-0">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary leading-tight">{job.title}</h1>
                  <p className="text-lg text-ink/80 mt-0.5">{job.company?.name}</p>
                  <div className="flex flex-wrap gap-2 mt-3 text-xs">
                    <span className="px-3 py-1 rounded-full bg-accent text-white font-medium">{WORK_MODE_LABEL[job.workMode] || 'Onsite'}</span>
                    <span className="px-3 py-1 rounded-full bg-white border border-sage/50 text-primary">{EMPLOYMENT_LABEL[job.employmentType] || 'Full-time'}</span>
                    <span className="px-3 py-1 rounded-full bg-white border border-sage/50 text-primary">{formatExperience(job)}</span>
                    {isDemo(job) && <span className="px-3 py-1 rounded-full border border-sage text-primary/80">Demo listing</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  {job.availability && job.availability !== 'open' && !application ? (
                    <p role="status" className="rounded-xl bg-amber-100 text-amber-700 px-4 py-2.5 text-sm font-medium">
                      {job.availability === 'expired' ? 'The application deadline has passed.' : job.availability === 'closed' ? 'This job is closed.' : 'This job is no longer listed.'}
                    </p>
                  ) : (
                    <ApplyFlow job={job} application={application} onApplied={(a) => { setApplication(a); setApplied(true); }} />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSave(job._id)}
                    disabled={busyId === job._id}
                    aria-pressed={saved}
                    className={`focus-ring inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium border transition disabled:opacity-50 ${saved ? 'bg-mint border-accent text-primary' : 'bg-white border-primary text-primary hover:bg-mint'}`}
                  >
                    <BookmarkIcon size={16} filled={saved} /> {saved ? 'Saved' : 'Save job'}
                  </button>
                </div>
                <div className="space-y-2 w-full md:w-auto">
                  {applied && <SuccessMessage message="Application added to your tracker." />}
                  {feedback?.type === 'success' && !applied && <SuccessMessage message={feedback.text} />}
                  {feedback?.type === 'error' && <ErrorMessage message={feedback.text} />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!loading && job && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_320px] gap-8">
          <main>
            {isDemo(job) && (
              <div role="note" className="bg-white border border-sage/60 rounded-xl px-4 py-3 text-sm text-ink/80 flex gap-3">
                <TagIcon className="text-accent shrink-0 mt-0.5" />
                <p><strong>Sample listing.</strong> This job was created for the CareerNest demo. It is not a verified live vacancy{job.applyUrl ? ', and its apply link is a placeholder page' : ''}.</p>
              </div>
            )}

            <Section title="About this role">
              <div className="space-y-3 text-ink/85 leading-relaxed">
                {job.jobDescription.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </Section>
            {job.responsibilities?.length > 0 && <Section title="Responsibilities"><BulletList items={job.responsibilities} /></Section>}
            {job.skills?.length > 0 && <Section title="Required skills"><Chips items={job.skills} /></Section>}
            {job.preferredSkills?.length > 0 && <Section title="Preferred skills"><Chips items={job.preferredSkills} variant="outline" /></Section>}
            {job.requirements?.length > 0 && <Section title="Requirements"><BulletList items={job.requirements} /></Section>}
            {job.education?.length > 0 && <Section title="Education"><BulletList items={job.education} /></Section>}
          </main>

          <aside className="space-y-5">
            <div className="bg-white rounded-2xl border border-sage/30 p-5 space-y-4">
              <h2 className="font-display text-lg font-bold text-primary">Job overview</h2>
              <Fact icon={<TagIcon size={16} />} label="Job ID">{job.jobCode || job._id.slice(-8).toUpperCase()}</Fact>
              <Fact icon={<PinIcon size={16} />} label="Location">{formatLocation(job)}</Fact>
              <Fact icon={<BriefcaseIcon size={16} />} label="Employment type">{EMPLOYMENT_LABEL[job.employmentType] || 'Full-time'} · {WORK_MODE_LABEL[job.workMode] || 'Onsite'}</Fact>
              <Fact icon={<UsersIcon size={16} />} label="Experience">{formatExperience(job)}</Fact>
              <Fact icon={<WalletIcon size={16} />} label="Salary">{salary || 'Not disclosed'}</Fact>
              <Fact icon={<ClockIcon size={16} />} label="Posted">{formatDate(job.postedAt || job.createdAt)} <span className="text-ink/50 font-normal">({timeAgo(job.postedAt || job.createdAt).replace('Posted ', '')})</span></Fact>
            </div>

            {job.company && (
              <div className="bg-white rounded-2xl border border-sage/30 p-5">
                <div className="flex items-center gap-3">
                  <CompanyLogo company={job.company} size={44} />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-ink truncate">{job.company.name}</h2>
                    <p className="text-xs text-ink/60">{[job.company.industry, job.company.size].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                {job.company.description && <p className="text-sm text-ink/75 mt-3 leading-relaxed">{job.company.description}</p>}
                {job.company.website && (
                  <a href={job.company.website} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1.5 text-sm text-primary underline mt-3">
                    Company website <ExternalIcon size={14} />
                  </a>
                )}
              </div>
            )}

            {more.length > 0 && (
              <div className="bg-white rounded-2xl border border-sage/30 p-5">
                <h2 className="font-display text-lg font-bold text-primary mb-3">More at {job.company?.name}</h2>
                <ul className="space-y-3">
                  {more.map((j) => (
                    <li key={j._id}>
                      <Link to={`/jobs/${j._id}`} className="focus-ring block hover:text-accent">
                        <span className="text-sm font-medium">{j.title}</span>
                        <span className="block text-xs text-ink/60">{formatLocation(j)} · {formatExperience(j)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-mint/60 rounded-2xl border border-sage/40 p-5">
              <h2 className="font-semibold text-primary mb-1">Prepare your application</h2>
              <p className="text-xs text-ink/70 mb-3">Use CareerNest&apos;s AI tools with this job.</p>
              <div className="flex flex-col gap-2">
                <Link to={`/resume?job=${job._id}`} className="focus-ring text-sm text-center bg-primary text-white rounded-xl py-2 hover:bg-primary-dark transition">Check my resume match</Link>
                <Link to={`/skill-gap-analysis?job=${job._id}`} className="focus-ring text-sm text-center border border-primary text-primary rounded-xl py-2 hover:bg-white transition">Analyze my skill gap</Link>
                <Link to={`/cover-letter?job=${job._id}`} className="focus-ring text-sm text-center border border-primary text-primary rounded-xl py-2 hover:bg-white transition">Write a cover letter</Link>
                <Link to="/referrals" className="focus-ring text-sm text-center border border-sage text-primary rounded-xl py-2 hover:bg-white transition">Find a referral</Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default JobDetails;
