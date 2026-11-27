/* eslint-disable react-refresh/only-export-components -- shared admin UI kit: small components plus class-name constants */
import { NavLink } from 'react-router-dom';

export const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/companies', label: 'Companies' },
  { to: '/admin/programs', label: 'Programs' },
  { to: '/admin/support', label: 'Support' },
];

// Sub-navigation shared by every admin page.
function AdminNav() {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-2 mb-6">
      {ADMIN_LINKS.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `focus-ring px-4 py-2 rounded-xl text-sm border transition ${isActive ? 'bg-primary text-white border-primary font-medium' : 'bg-white text-primary border-sage/50 hover:bg-mint'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AdminPage({ title, subtitle, actions, children }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">{title}</h1>
          {subtitle && <p className="text-sm text-ink/70 mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <AdminNav />
      {children}
    </div>
  );
}

const AVAIL_STYLES = {
  open: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  closed: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-600',
};

export function AvailabilityBadge({ value }) {
  return <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${AVAIL_STYLES[value] || 'bg-gray-100 text-gray-600'}`}>{value === 'open' ? 'active' : value}</span>;
}

export const inputClass = 'focus-ring w-full border border-sage/60 rounded-xl px-3 py-2.5 text-sm bg-white text-ink';
export const btnPrimary = 'focus-ring inline-flex items-center justify-center rounded-xl bg-primary text-white px-4 py-2.5 text-sm font-medium hover:bg-primary-dark disabled:opacity-50';
export const btnGhost = 'focus-ring inline-flex items-center justify-center rounded-xl border border-sage/60 bg-white text-primary px-3 py-2 text-sm hover:bg-mint disabled:opacity-50';

export default AdminNav;
