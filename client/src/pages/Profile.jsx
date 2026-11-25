import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { setSession, updateStoredUser, getUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, Skeleton } from '../components/Feedback';
import ProfileNav from '../components/profile/ProfileNav';
import SummaryPanel from '../components/profile/SummaryPanel';
import AccountSection from '../components/profile/AccountSection';
import PersonalSection from '../components/profile/PersonalSection';
import EducationSection from '../components/profile/EducationSection';
import ExperienceSection from '../components/profile/ExperienceSection';
import SkillsSection from '../components/profile/SkillsSection';
import InterestsSection from '../components/profile/InterestsSection';
import ResumesSection from '../components/profile/ResumesSection';
import { JobPreferences, ReferralOptIn } from '../components/profile/PreferencesSection';

// The session copy of the user matches the login payload (no resumeSummary, which only /auth/me adds).
const forStorage = (u) => {
  const copy = { ...u };
  delete copy.resumeSummary;
  return copy;
};

function Profile() {
  const [user, setUser] = useState(null);
  const [completeness, setCompleteness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumesVersion, setResumesVersion] = useState(0);

  const loadCompleteness = useCallback(() => {
    axiosClient.get('/dashboard/overview', { params: { range: '30d' } })
      .then((res) => setCompleteness(res.data?.stats?.profileComplete || null))
      .catch(() => setCompleteness(null));
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await axiosClient.get('/auth/me');
      setUser(res.data.user);
      updateStoredUser(forStorage(res.data.user));
    } catch { /* keep what we have */ }
    loadCompleteness();
  }, [loadCompleteness]);

  useEffect(() => {
    axiosClient.get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        updateStoredUser(forStorage(res.data.user));
        loadCompleteness();
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load your profile')))
      .finally(() => setLoading(false));
  }, [loadCompleteness]);

  // Deep links such as /profile#resumes scroll to their section once the page has rendered.
  useEffect(() => {
    if (!user || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(user)]);

  // Called by every section after a successful save.
  const onSaved = useCallback((data) => {
    if (data.token) setSession(data.token, forStorage(data.user));
    else updateStoredUser({ ...(getUser() || {}), ...forStorage(data.user) });
    setUser((prev) => ({ ...data.user, resumeSummary: prev?.resumeSummary }));
    refreshMe();
  }, [refreshMe]);

  const onInterestsSaved = useCallback((data) => {
    onSaved(data);
    setResumesVersion((v) => v + 1); // role slots / un-assigned resumes changed
  }, [onSaved]);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]" aria-label="Loading profile">
        <Skeleton className="h-72" />
        <div className="grid gap-5"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
      </div>
    );
  }
  if (!user) {
    return <div className="max-w-xl mx-auto px-4 py-10"><ErrorMessage message={error || 'Could not load your profile'} /></div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      <h1 className="sr-only">Your profile</h1>
      <div className="grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_320px] items-start">
        <div className="min-w-0 lg:sticky lg:top-20 lg:self-start"><ProfileNav user={user} /></div>

        <div className="grid gap-5 grid-cols-[minmax(0,1fr)] min-w-0">
          <div className="xl:hidden"><SummaryPanel user={user} completeness={completeness} /></div>
          <AccountSection user={user} onSaved={onSaved} />
          <PersonalSection user={user} onSaved={onSaved} />
          <EducationSection user={user} onSaved={onSaved} />
          <ExperienceSection user={user} onSaved={onSaved} />
          <SkillsSection user={user} onSaved={onSaved} />
          <InterestsSection user={user} onSaved={onInterestsSaved} />
          <ResumesSection user={user} version={resumesVersion} onChanged={refreshMe} />
          <JobPreferences user={user} onSaved={onSaved} />
          <ReferralOptIn user={user} onSaved={onSaved} />
        </div>

        <div className="hidden xl:block xl:sticky xl:top-20"><SummaryPanel user={user} completeness={completeness} /></div>
      </div>
    </div>
  );
}

export default Profile;
