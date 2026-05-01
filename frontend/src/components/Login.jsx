import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SCHOOL_LOGO_SRC } from '../utils/academics';

const decodeBase64Url = (value = '') => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return atob(padded);
};

const authBaseUrl = () => (api.defaults.baseURL || '/api').replace(/\/$/, '');

const AuthMetric = ({ icon: Icon, label, value, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', damping: 22, stiffness: 240 }}
    className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 text-white shadow-lg shadow-black/10 backdrop-blur"
  >
    <Icon size={19} className="text-cyan-200" />
    <p className="mt-3 text-2xl font-black">{value}</p>
    <p className="mt-1 text-xs font-bold uppercase text-white/55">{label}</p>
  </motion.div>
);

const SocialButton = ({ provider, loading, onClick }) => {
  const isGoogle = provider === 'google';
  return (
    <button
      type="button"
      onClick={() => onClick(provider)}
      disabled={loading}
      className="group inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-pink-900/70"
    >
      <span className={`grid h-7 w-7 place-items-center rounded-full text-base font-black ${isGoogle ? 'bg-white text-blue-600 ring-1 ring-gray-200' : 'bg-blue-600 text-white'}`}>
        {isGoogle ? 'G' : 'f'}
      </span>
      {isGoogle ? 'Google' : 'Facebook'}
    </button>
  );
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetStep, setResetStep] = useState('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthToken = params.get('oauthToken');
    const oauthUser = params.get('oauthUser');
    const incomingResetToken = params.get('resetToken');
    const incomingResetEmail = params.get('resetEmail');

    if (oauthToken && oauthUser) {
      try {
        const user = JSON.parse(decodeBase64Url(oauthUser));
        login(oauthToken, user);
        toast.success('Login successful');
        navigate('/dashboard', { replace: true });
      } catch {
        toast.error('Social login response was invalid');
        navigate('/login', { replace: true });
      }
    }

    if (incomingResetToken) {
      setForgotOpen(true);
      setResetStep('reset');
      setResetToken(incomingResetToken);
      setResetEmail(incomingResetEmail || '');
      navigate('/login', { replace: true });
    }
  }, [location.search, login, navigate]);

  const canReset = useMemo(() => (
    resetToken.trim() && newPassword.length >= 6 && newPassword === confirmPassword
  ), [confirmPassword, newPassword, resetToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const startSocialLogin = async (provider) => {
    setSocialLoading(provider);
    try {
      const res = await api.get('/auth/oauth/status');
      if (!res.data?.[provider]) {
        toast.error(`${provider === 'google' ? 'Google' : 'Facebook'} login needs OAuth keys in Render env first`);
        return;
      }
      window.location.href = `${authBaseUrl()}/auth/oauth/${provider}?returnTo=${encodeURIComponent(window.location.origin)}`;
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Social login is not ready yet');
    } finally {
      setSocialLoading('');
    }
  };

  const requestPasswordReset = async (event) => {
    event.preventDefault();
    setResetLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: resetEmail || email });
      toast.success(res.data?.msg || 'Password reset prepared');
      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken);
        setResetStep('reset');
      } else {
        setResetStep('reset');
      }
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not prepare password reset');
    } finally {
      setResetLoading(false);
    }
  };

  const submitNewPassword = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setResetLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token: resetToken.trim(), password: newPassword });
      login(res.data.token, res.data.user);
      toast.success('Password updated');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gray-950 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#08111f_0%,#0d1729_38%,#171026_70%,#061b24_100%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <motion.img
              animate={{ y: [0, -5, 0], rotate: [0, 1, -1, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              src={SCHOOL_LOGO_SRC}
              alt="NEMSU logo"
              className="h-14 w-14 rounded-2xl bg-white object-cover p-1 shadow-2xl shadow-cyan-500/20"
            />
            <div>
              <div className="text-3xl font-black tracking-normal">Work<span className="bg-gradient-to-r from-cyan-300 to-pink-400 bg-clip-text text-transparent">Loop</span></div>
              <p className="text-xs font-black uppercase text-white/45">NEMSU workspace network</p>
            </div>
          </div>

          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase text-cyan-100 backdrop-blur"
            >
              <Sparkles size={14} />
              realtime workspace portal
            </motion.div>
            <h1 className="mt-6 text-6xl font-black leading-[1.02] tracking-normal">
              Sign in to your team command center.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-white/65">
              Manage workspaces, tasks, reports, rankings, media, and realtime messages in one polished school workspace.
            </p>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3">
            <AuthMetric icon={Users} label="Collaboration" value="Live" delay={0.1} />
            <AuthMetric icon={ShieldCheck} label="Protected" value="Secure" delay={0.18} />
            <AuthMetric icon={CheckCircle2} label="Workflows" value="Clean" delay={0.26} />
          </div>
        </section>

        <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 24, stiffness: 240 }}
            className="w-full max-w-[430px]"
          >
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo" className="h-12 w-12 rounded-2xl bg-white object-cover p-1" />
              <div className="text-3xl font-black">Work<span className="text-pink-400">Loop</span></div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 p-6 text-gray-950 shadow-2xl shadow-pink-500/20 dark:bg-gray-900/95 dark:text-white sm:p-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-pink-500 to-emerald-300" />
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-tr-[2rem] border-r-2 border-t-2 border-pink-300/80 shadow-[14px_-14px_45px_rgba(236,72,153,0.25)]" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-bl-[2rem] border-b-2 border-l-2 border-cyan-300/80 shadow-[-14px_14px_45px_rgba(34,211,238,0.18)]" />

              <div className="relative mb-7 text-center">
                <motion.img
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  src={SCHOOL_LOGO_SRC}
                  alt="WorkLoop"
                  className="mx-auto h-16 w-16 rounded-2xl bg-gray-950 object-cover p-1 shadow-xl shadow-cyan-500/20 dark:bg-white"
                />
                <h2 className="mt-5 text-3xl font-black tracking-normal">Welcome back</h2>
                <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Login to continue your workspace flow.</p>
              </div>

              <form onSubmit={handleSubmit} className="relative space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">Student Email</span>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
                    <input
                      type="email"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-cyan-500"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      placeholder="example@nemsu.edu.ph"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">Password</span>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3.5 pl-12 pr-12 text-sm font-semibold outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-pink-500"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-pink-500" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <div className="flex justify-end">
                  <button type="button" onClick={() => { setForgotOpen(true); setResetEmail(email); }} className="text-sm font-black text-pink-600 transition hover:text-cyan-600 dark:text-pink-300 dark:hover:text-cyan-200">
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-pink-500 to-indigo-500 px-4 py-3.5 text-sm font-black text-white shadow-xl shadow-pink-500/25 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                  {!loading && <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
                </button>
              </form>

              <div className="relative my-6 flex items-center gap-3 text-xs font-black uppercase text-gray-400">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                Or sign in with
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SocialButton provider="google" loading={Boolean(socialLoading)} onClick={startSocialLogin} />
                <SocialButton provider="facebook" loading={Boolean(socialLoading)} onClick={startSocialLogin} />
              </div>

              <p className="mt-6 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                No account yet?{' '}
                <Link to="/register" className="font-black text-pink-600 transition hover:text-cyan-600 dark:text-pink-300">
                  Sign up
                </Link>
              </p>
            </div>
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white p-6 text-gray-950 shadow-2xl dark:bg-gray-900 dark:text-white"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-pink-500 p-3 text-white shadow-lg shadow-pink-500/20">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black">{resetStep === 'request' ? 'Reset password' : 'Create new password'}</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {resetStep === 'request' ? 'Prepare a secure reset link for your account.' : 'Use the reset token from your link or email.'}
                  </p>
                </div>
              </div>

              {resetStep === 'request' ? (
                <form onSubmit={requestPasswordReset} className="space-y-3">
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={event => setResetEmail(event.target.value)}
                    placeholder="Account email"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    required
                  />
                  <button disabled={resetLoading} className="w-full rounded-2xl bg-gray-950 px-4 py-3 text-sm font-black text-white transition hover:bg-pink-600 disabled:opacity-60 dark:bg-white dark:text-gray-950">
                    {resetLoading ? 'Preparing...' : 'Prepare reset'}
                  </button>
                </form>
              ) : (
                <form onSubmit={submitNewPassword} className="space-y-3">
                  <input
                    value={resetToken}
                    onChange={event => setResetToken(event.target.value)}
                    placeholder="Reset token"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    required
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    placeholder="New password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    required
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-pink-300 focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    required
                  />
                  <button disabled={resetLoading || !canReset} className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-pink-500 px-4 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50">
                    {resetLoading ? 'Updating...' : 'Update password'}
                  </button>
                </form>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setResetStep(resetStep === 'request' ? 'reset' : 'request')} className="text-sm font-black text-cyan-600 transition hover:text-pink-600 dark:text-cyan-300">
                  {resetStep === 'request' ? 'I have a token' : 'Request new token'}
                </button>
                <button type="button" onClick={() => setForgotOpen(false)} className="text-sm font-black text-gray-500 transition hover:text-gray-900 dark:hover:text-white">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
