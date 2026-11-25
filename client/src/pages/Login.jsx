import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link, Navigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { setSession, isLoggedIn } from '../utils/auth';
import AuthShell from '../components/auth/AuthShell';
import { TextField, PasswordField, SubmitButton, Banner } from '../components/auth/AuthFields';
import { MailIcon, LockIcon } from '../components/auth/authIcons';
import { emailError, describeAuthFailure } from '../components/auth/authRules';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  useEffect(() => {
    // Focus the first field on desktop only (on phones it would pop the keyboard open over the page).
    if (window.matchMedia?.('(min-width: 1024px)').matches) emailRef.current?.focus();
  }, []);

  if (isLoggedIn()) return <Navigate to="/home" replace />;

  const justSignedUp = location.state?.signedUp;
  const expired = params.get('expired');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setBanner('');

    const next = {};
    const emailMsg = emailError(email);
    if (emailMsg) next.email = emailMsg;
    if (!password) next.password = 'Please enter your password.';
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();

    setLoading(true);
    try {
      const response = await axiosClient.post('/auth/login', { email: email.trim(), password });
      setSession(response.data.token, response.data.user);
      navigate('/home');
    } catch (err) {
      const failure = describeAuthFailure(err, 'Login failed. Please try again.');
      setErrors(failure.fields);
      setBanner(failure.banner);
      if (failure.code === 'INVALID_CREDENTIALS') setTimeout(() => passwordRef.current?.focus(), 60);
      setLoading(false);
    }
  };

  const notice = banner
    ? { tone: 'error', text: banner }
    : justSignedUp
      ? { tone: 'success', text: 'Account created successfully! Please log in.' }
      : expired
        ? { tone: 'error', text: 'Your session expired. Please log in again.' }
        : { tone: 'error', text: '' };

  const clear = (field) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  return (
    <AuthShell>
      <Banner tone={notice.tone}>{notice.text}</Banner>

      <form onSubmit={handleSubmit} noValidate aria-label="Log in" className="flex flex-col gap-4">
        <TextField
          ref={emailRef}
          id="login-email"
          label="Email address"
          icon={MailIcon}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => { setEmail(e.target.value); clear('email'); }}
          error={errors.email}
          disabled={loading}
          required
        />
        <PasswordField
          ref={passwordRef}
          id="login-password"
          label="Password"
          icon={LockIcon}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); clear('password'); }}
          error={errors.password}
          disabled={loading}
          required
        />
        <div className="mt-1">
          <SubmitButton loading={loading} loadingText="Logging in...">Log In</SubmitButton>
        </div>
      </form>

      <p className="mt-6 text-sm text-gray-600">
        Don't have an account?{' '}
        <Link to="/signup" className="focus-ring inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export default Login;
