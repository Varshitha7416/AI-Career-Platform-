import { NavLink, Link, useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../utils/auth';

const links = [
  { to: '/home', label: 'Home' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/resume', label: 'Resume AI' },
  { to: '/cover-letter', label: 'Cover Letter' },
  { to: '/referrals', label: 'Referrals' },
  { to: '/about', label: 'About' },
  { to: '/profile', label: 'Profile' },
];

function Navbar() {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between flex-wrap gap-3">
      <Link to="/home" className="text-xl font-bold text-primary">
        AI Career Platform
      </Link>

      <div className="flex items-center gap-x-5 gap-y-2 text-sm flex-wrap">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `transition pb-0.5 border-b-2 ${
                isActive
                  ? 'text-primary font-semibold border-primary'
                  : 'text-charcoal border-transparent hover:text-primary'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
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
