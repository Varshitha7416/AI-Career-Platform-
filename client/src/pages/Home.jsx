import { getUser } from '../utils/auth';
import SiteFooter from '../components/site/SiteFooter';
import useHomeData from '../components/home/useHomeData';
import HomeHero from '../components/home/HomeHero';
import FeaturesSection from '../components/home/FeaturesSection';
import ProgressSection from '../components/home/ProgressSection';
import WhySection from '../components/home/WhySection';

// Home: four sections (hero + shortcuts, features, real-data progress, why + contact) and the shared footer.
function Home() {
  const stored = getUser();
  const { overview, overviewLoading, overviewError, refetchOverview, me, rec, reloadRec } = useHomeData();
  const name = me?.name || stored?.name || '';
  const firstName = name.trim().split(/\s+/)[0] || '';

  return (
    <div className="bg-bg">
      <HomeHero firstName={firstName} />
      <FeaturesSection />
      <ProgressSection
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        onRetry={refetchOverview}
        me={me}
        stored={stored}
        rec={rec}
        onRetryRec={reloadRec}
      />
      <WhySection />
      <SiteFooter />
    </div>
  );
}

export default Home;
