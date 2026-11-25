import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { isLoggedIn } from '../utils/auth';
import AuthShell from '../components/auth/AuthShell';
import { TextField, PasswordField, PasswordStrength, SubmitButton, Banner, FieldError } from '../components/auth/AuthFields';
import { MailIcon, LockIcon, UserIcon } from '../components/auth/authIcons';
import { nameError, emailError, passwordError, describeAuthFailure } from '../components/auth/authRules';

const FIELD_ORDER = ['name', 'email', 'password', 'confirm', 'terms'];

function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const termsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (window.matchMedia?.('(min-width: 1024px)').matches) nameRef.current?.focus();
  }, []);

  if (isLoggedIn()) return <Navigate to="/home" replace />;

  const focusFirst = (errs) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    // Fields are disabled while a request is in flight; wait for the re-render before moving focus.
    setTimeout(() => ({ name: nameRef, email: emailRef, password: passwordRef, confirm: confirmRef, terms: termsRef })[first]?.current?.focus(), 60);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setBanner('');

    const next = {};
    const n = nameError(name);
    if (n) next.name = n;
    const em = emailError(email);
    if (em) next.email = em;
    const pw = passwordError(password, { name, email });
    if (pw) next.password = pw;
    if (!confirm) next.confirm = 'Please confirm your password.';
    else if (confirm !== password) next.confirm = 'Passwords do not match.';
    if (!terms) next.terms = 'Please agree to the Terms & Privacy Policy to continue.';
    setErrors(next);
    if (Object.keys(next).length) {
      setPasswordTouched(true);
      return focusFirst(next);
    }

    setLoading(true);
    try {
      await axiosClient.post('/auth/signup', { name: name.trim(), email: email.trim(), password, acceptTerms: true });
      navigate('/login', { state: { signedUp: true } });
    } catch (err) {
      const failure = describeAuthFailure(err, 'Signup failed. Please try again.');
      const serverErrors = { name: failure.fields.name, email: failure.fields.email, password: failure.fields.password };
      setErrors(serverErrors);
      setBanner(failure.banner || (Object.values(serverErrors).some(Boolean) ? 'Please fix the highlighted fields and try again.' : ''));
      focusFirst(serverErrors);
      setLoading(false);
    }
  };

  const clear = (...fields) => setErrors((prev) => {
    if (!fields.some((f) => prev[f])) return prev;
    const copy = { ...prev };
    fields.forEach((f) => { copy[f] = undefined; });
    return copy;
  });

  const showStrength = passwordTouched || password.length > 0;

  return (
    <AuthShell>
      <Banner>{banner}</Banner>

      <form onSubmit={handleSubmit} noValidate aria-label="Create account" className="flex flex-col gap-3.5">
        <TextField
          ref={nameRef}
          id="signup-name"
          label="Full name"
          icon={UserIcon}
          name="name"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => { setName(e.target.value); clear('name'); }}
          error={errors.name}
          disabled={loading}
          required
        />
        <TextField
          ref={emailRef}
          id="signup-email"
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
        <div>
          <PasswordField
            ref={passwordRef}
            id="signup-password"
            label="Password"
            icon={LockIcon}
            name="password"
            autoComplete="new-password"
            describedBy="signup-password-rules"
            value={password}
            onChange={(e) => { setPassword(e.target.value); clear('password'); }}
            onFocus={() => setPasswordTouched(true)}
            error={errors.password}
            disabled={loading}
            required
          />
          {showStrength && <PasswordStrength id="signup-password-rules" password={password} name={name} email={email} />}
        </div>
        <PasswordField
          ref={confirmRef}
          id="signup-confirm"
          label="Confirm password"
          icon={LockIcon}
          name="confirmPassword"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); clear('confirm'); }}
          error={errors.confirm || (confirm && password && confirm !== password && confirm.length >= password.length ? 'Passwords do not match.' : '')}
          disabled={loading}
          required
        />

        <div>
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-gray-600">
            <input
              ref={termsRef}
              type="checkbox"
              name="acceptTerms"
              checked={terms}
              onChange={(e) => { setTerms(e.target.checked); clear('terms'); }}
              aria-invalid={errors.terms ? 'true' : undefined}
              aria-describedby={errors.terms ? 'signup-terms-error' : undefined}
              disabled={loading}
              required
              className="focus-ring h-5 w-5 shrink-0 cursor-pointer rounded accent-[#235347]"
            />
            <span>
              I agree to the{' '}
              <span className="font-semibold text-primary">Terms</span>
              {' '}&amp;{' '}
              <span className="font-semibold text-primary">Privacy Policy</span>
            </span>
          </label>
          <FieldError id="signup-terms-error" message={errors.terms} />
        </div>

        <SubmitButton loading={loading} loadingText="Creating account...">Create account</SubmitButton>
      </form>

      <p className="mt-5 text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="focus-ring inline-flex min-h-10 items-center font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

export default Signup;
