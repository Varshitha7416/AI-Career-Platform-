import { useEffect } from 'react';
import useDashboard from '../hooks/useDashboard';
import { ErrorMessage } from '../components/Feedback';
import DashboardHero from '../components/dashboard/DashboardHero';
import StatsRow from '../components/dashboard/StatsRow';
import ApplicationOverview from '../components/dashboard/ApplicationOverview';
import RecentActivity from '../components/dashboard/RecentActivity';
import CareerProgressCard from '../components/dashboard/CareerProgressCard';
import RecentApplications from '../components/dashboard/RecentApplications';
import SavedJobsPreview from '../components/dashboard/SavedJobsPreview';
import UpcomingInterviews from '../components/dashboard/UpcomingInterviews';
import ProgramsPreview from '../components/dashboard/ProgramsPreview';
import CareerTip from '../components/dashboard/CareerTip';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';

// Dashboard overview. Everything comes from GET /api/dashboard/overview (scoped to the logged-in user).
function Dashboard() {
  const { data, loading, error, range, setRange, rangeLoading, refetch } = useDashboard();

  useEffect(() => {
    document.title = 'Dashboard | CareerNest';
    return () => { document.title = 'CareerNest'; };
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-primary">We couldn&apos;t load your dashboard</h1>
        <ErrorMessage message={error || 'Something went wrong. Please try again.'} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <DashboardHero firstName={data.user?.firstName} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {error && <ErrorMessage message={error} onRetry={refetch} />}

        <StatsRow stats={data.stats} />

        {/* Overview + progress + activity. DOM order is the mobile order; xl re-orders to overview | activity | progress. */}
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-12">
          <ApplicationOverview
            overview={data.applicationOverview}
            range={range}
            onRangeChange={setRange}
            busy={rangeLoading}
            className="xl:col-span-5"
          />
          <CareerProgressCard progress={data.careerProgress} className="xl:col-span-3 xl:order-3" />
          <RecentActivity items={data.recentActivity.slice(0, 6)} className="lg:col-span-2 xl:col-span-4 xl:order-2" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <RecentApplications items={data.recentApplications} />
          <SavedJobsPreview items={data.savedJobs} />
          <UpcomingInterviews items={data.upcomingInterviews} className="lg:col-span-2 xl:col-span-1" />
        </div>

        <ProgramsPreview items={data.programs} />

        <CareerTip tip={data.tip} />
      </div>
    </div>
  );
}

export default Dashboard;
