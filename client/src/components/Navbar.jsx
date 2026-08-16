import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('resumeId');
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between flex-wrap gap-3">
      <Link to="/home" className="text-xl font-bold text-primary">
        AI Career Platform
      </Link>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <Link to="/jobs" className="text-charcoal hover:text-primary transition">Jobs</Link>
        <Link to="/dashboard" className="text-charcoal hover:text-primary transition">Dashboard</Link>
        <Link to="/resume" className="text-charcoal hover:text-primary transition">Resume Analyzer</Link>
        <Link to="/cover-letter" className="text-charcoal hover:text-primary transition">Cover Letter</Link>
        <Link to="/referrals" className="text-charcoal hover:text-primary transition">Referrals</Link>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-charcoal">Hi, {user?.name?.split(' ')[0] || 'there'}</span>
        <button
          onClick={handleLogout}
          className="text-sm border border-primary text-primary px-4 py-1.5 rounded-lg hover:bg-primary hover:text-white transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;