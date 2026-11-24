import { Link } from 'react-router-dom';
import { getUser } from '../utils/auth';

const features = [
  { name: 'Job Discovery', desc: 'Search and save jobs that match your goals.', path: '/jobs', ai: false },
  { name: 'Dashboard', desc: 'Track your saved jobs and applications.', path: '/dashboard', ai: false },
  { name: 'Resume Analyzer', desc: 'Get AI feedback on your resume, general or job-specific.', path: '/resume', ai: true },
  { name: 'Cover Letter Generator', desc: 'Generate a tailored cover letter in seconds.', path: '/cover-letter', ai: true },
  { name: 'Referrals', desc: 'Find employees willing to refer you, or manage requests you receive.', path: '/referrals', ai: false },
];

function Home() {
  const user = getUser();

  return (
    <div className="min-h-screen bg-bg px-6 py-10">
      <h1 className="text-3xl font-bold text-primary mb-2 text-center">
        Hi, {user?.name?.split(' ')[0] || 'there'} 👋
      </h1>
      <p className="text-charcoal text-center mb-10">Welcome back to your AI Career Platform.</p>

      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
        {features.map((f) => (
          <Link
            key={f.path}
            to={f.path}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-charcoal">{f.name}</h2>
              {f.ai && (
                <span className="text-xs font-bold text-white bg-accent px-2 py-0.5 rounded-full">✨ AI</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Home;
