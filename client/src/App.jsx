import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import Dashboard from './pages/Dashboard';
import ResumeUpload from './pages/ResumeUpload';
import CoverLetter from './pages/CoverLetter';
import Referrals from './pages/Referrals';
import About from './pages/About';
import Profile from './pages/Profile';
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
        <Route path="/home" element={<Protected><Home /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/jobs/:id" element={<Protected><JobDetails /></Protected>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/resume" element={<Protected><ResumeUpload /></Protected>} />
        <Route path="/cover-letter" element={<Protected><CoverLetter /></Protected>} />
        <Route path="/referrals" element={<Protected><Referrals /></Protected>} />
        <Route path="/about" element={<Protected><About /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
