import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Skeleton, ErrorMessage } from './Feedback';
import { getErrorMessage } from '../utils/errors';

// Admin-only gate. The role is verified against the server (GET /auth/me), not read from localStorage, and every
// /api/admin endpoint independently answers 403 to non-admins, so this is a UX guard, not the security boundary.
function AdminRoute({ children }) {
  const [state, setState] = useState({ status: 'loading', error: '' });

  useEffect(() => {
    let alive = true;
    axiosClient.get('/auth/me')
      .then((res) => { if (alive) setState({ status: res.data?.user?.role === 'admin' ? 'admin' : 'denied', error: '' }); })
      .catch((err) => { if (alive) setState({ status: 'error', error: getErrorMessage(err) }); });
    return () => { alive = false; };
  }, []);

  if (state.status === 'loading') {
    return <div className="max-w-6xl mx-auto px-4 pt-24"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-40 w-full" /></div>;
  }
  if (state.status === 'error') return <div className="max-w-6xl mx-auto px-4 pt-24"><ErrorMessage message={state.error} /></div>;
  if (state.status === 'denied') return <Navigate to="/dashboard" replace />;
  return children;
}

export default AdminRoute;
