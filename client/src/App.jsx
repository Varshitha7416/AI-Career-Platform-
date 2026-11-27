import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import ApplicationDetails from './pages/ApplicationDetails';
import SavedJobs from './pages/SavedJobs';
import Interviews from './pages/Interviews';
import Programs from './pages/Programs';
import ProgramDetails from './pages/ProgramDetails';
import Settings from './pages/Settings';
import Contact from './pages/Contact';
import ContactHistory from './pages/ContactHistory';
import AdminSupport from './pages/AdminSupport';
import AdminSupportDetail from './pages/AdminSupportDetail';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import CoverLetter from './pages/CoverLetter';
import SkillGapAnalysis from './pages/SkillGapAnalysis';
import Referrals from './pages/Referrals';
import ReferralFind from './pages/ReferralFind';
import ReferralDetails from './pages/ReferralDetails';
import About from './pages/About';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import AdminJobs from './pages/AdminJobs';
import AdminJobForm from './pages/AdminJobForm';
import AdminCompanies from './pages/AdminCompanies';
import AdminPrograms from './pages/AdminPrograms';
import MyPrograms from './pages/MyPrograms';
import AdminRoute from './components/AdminRoute';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { isLoggedIn } from './utils/auth';

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function AdminProtected({ children }) {
  return (
    <ProtectedRoute>
      <Layout><AdminRoute>{children}</AdminRoute></Layout>
    </ProtectedRoute>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3 px-6">
      <h1 className="text-3xl font-bold text-primary">Page not found</h1>
      <Link to={isLoggedIn() ? '/home' : '/login'} className="text-primary underline">
        Go back
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={isLoggedIn() ? '/home' : '/login'} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/home" element={<Protected><Home /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/jobs/:id" element={<Protected><JobDetails /></Protected>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/saved-jobs" element={<Protected><SavedJobs /></Protected>} />
        <Route path="/applications" element={<Protected><Applications /></Protected>} />
        <Route path="/applications/:id" element={<Protected><ApplicationDetails /></Protected>} />
        <Route path="/interviews" element={<Protected><Interviews /></Protected>} />
        <Route path="/programs" element={<Protected><Programs /></Protected>} />
        <Route path="/programs/mine" element={<Protected><MyPrograms /></Protected>} />
        <Route path="/programs/:id" element={<Protected><ProgramDetails /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="/contact" element={<Protected><Contact /></Protected>} />
        <Route path="/contact/history" element={<Protected><ContactHistory /></Protected>} />
        <Route path="/contact/history/:id" element={<Protected><ContactHistory /></Protected>} />
        <Route path="/resume" element={<Protected><ResumeAnalyzer /></Protected>} />
        <Route path="/skill-gap-analysis" element={<Protected><SkillGapAnalysis /></Protected>} />
        <Route path="/cover-letter" element={<Protected><CoverLetter /></Protected>} />
        <Route path="/referrals" element={<Protected><Referrals /></Protected>} />
        <Route path="/referrals/find" element={<Protected><ReferralFind /></Protected>} />
        <Route path="/referrals/:id" element={<Protected><ReferralDetails /></Protected>} />
        <Route path="/about" element={<Protected><About /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/admin" element={<AdminProtected><AdminDashboard /></AdminProtected>} />
        <Route path="/admin/jobs" element={<AdminProtected><AdminJobs /></AdminProtected>} />
        <Route path="/admin/jobs/new" element={<AdminProtected><AdminJobForm /></AdminProtected>} />
        <Route path="/admin/jobs/:id" element={<AdminProtected><AdminJobForm /></AdminProtected>} />
        <Route path="/admin/companies" element={<AdminProtected><AdminCompanies /></AdminProtected>} />
        <Route path="/admin/programs" element={<AdminProtected><AdminPrograms /></AdminProtected>} />
        <Route path="/admin/support" element={<AdminProtected><AdminSupport /></AdminProtected>} />
        <Route path="/admin/support/:id" element={<AdminProtected><AdminSupportDetail /></AdminProtected>} />
        {/* Public: readable logged in (shared Layout) and logged out (LegalPage picks its own shell). */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
