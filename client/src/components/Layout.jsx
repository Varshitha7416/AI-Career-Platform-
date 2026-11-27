import Sidebar from './Sidebar';
import TopBar from './TopBar';
import VerifyEmailBanner from './VerifyEmailBanner';

// Shared application shell for every protected page: collapsible sidebar + top bar + content.
// Pages render only their own content (no navbars of their own).
function Layout({ children }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>
      <Sidebar />
      <TopBar />
      <VerifyEmailBanner />
      <main id="main">{children}</main>
    </div>
  );
}

export default Layout;
