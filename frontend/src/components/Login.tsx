import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppLogoMark } from './AppLogo';
import { AuthBackground, AuthShowcasePanel } from './AuthBackground';

const loginHighlights = [
  ['Posts', BookOpen, 'text-blue-600'],
  ['Chats', MessageCircle, 'text-sky-600'],
  ['Market', ShoppingBag, 'text-indigo-600']
];

const AuthShowcase = ({ title, eyebrow = 'Syncrova' }) => (
  <AuthShowcasePanel
    eyebrow={eyebrow}
    title={title}
    subtitle="One secure account for campus posts, verified marketplace activity, friends, and realtime Messenger conversations."
    highlights={loginHighlights}
    AppLogoMark={AppLogoMark}
  >
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wider text-blue-600">Security</p>
        <p className="mt-1 text-lg font-black text-slate-900">Protected sign-in</p>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wider text-blue-600">Status</p>
        <p className="mt-1 text-lg font-black text-slate-900">Realtime online</p>
      </div>
    </div>
  </AuthShowcasePanel>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
  const backendWarmupRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incomingResetToken = params.get('resetToken');
    const incomingResetEmail = params.get('resetEmail');

    if (incomingResetToken) {
      setForgotOpen(true);
      setResetStep('reset');
      setResetToken(incomingResetToken);
      setResetEmail(incomingResetEmail || '');
      navigate('/login', { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    let cancelled = false;
    backendWarmupRef.current = api.get('/ping', { timeout: 12000 })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) backendWarmupRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const canReset = useMemo(() => (
    resetToken.trim() && newPassword.length >= 6 && newPassword === confirmPassword
  ), [confirmPassword, newPassword, resetToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      if (backendWarmupRef.current) {
        await Promise.race([
          backendWarmupRef.current,
          new Promise(resolve => setTimeout(resolve, 900))
        ]);
      }
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

  const requestPasswordReset = async (event) => {
    event.preventDefault();
    setResetLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email: resetEmail || email });
      toast.success(res.data?.msg || 'Password reset prepared');
      setResetStep('reset');
      if (res.data?.resetToken) setResetToken(res.data.resetToken);
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
    <div className="relative h-[100svh] overflow-y-auto bg-white px-4 py-6 text-slate-950 sm:px-6 lg:px-10">
      <AuthBackground />
      <div className="relative mx-auto grid min-h-full max-w-7xl items-center gap-6 lg:grid-cols-[1.04fr_0.96fr]">
        <AuthShowcase title="Sign in to your campus marketplace." />

        <main className="flex items-center justify-center">
          <motion.section
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[535px] overflow-hidden rounded-3xl border border-blue-100/80 bg-white/85 p-6 shadow-[0_30px_80px_-30px_rgba(59,130,246,0.45)] backdrop-blur-xl sm:p-9"
          >
            {/* Decorative glow inside card */}
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gradient-to-br from-blue-400/30 to-sky-300/20 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-tr from-indigo-300/25 to-blue-200/20 blur-3xl" />

            <div className="relative flex items-center gap-4">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <AppLogoMark size="lg" />
              </motion.div>
              <div>
                <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700">Secure sign in</span>
                <h2 className="mt-3 bg-gradient-to-r from-slate-900 via-blue-800 to-sky-600 bg-clip-text text-[1.95rem] font-black leading-tight text-transparent">Welcome back</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Use your Syncrova account to continue.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Email</span>
                <div className="group relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                  <input
                    type="email"
                    className="h-12 w-full rounded-xl border border-blue-100 bg-white/80 pl-12 pr-4 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="student@nemsu.edu.ph"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Password</span>
                <div className="group relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="h-12 w-full rounded-xl border border-blue-100 bg-white/80 pl-12 pr-12 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 transition hover:text-blue-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => { setForgotOpen(true); setResetEmail(email); }} className="text-sm font-black text-blue-700 transition hover:text-blue-900 hover:underline">
                  Forgot password?
                </button>
                <Link to="/register" className="text-sm font-black text-blue-700 transition hover:text-blue-900 hover:underline">
                  Create account
                </Link>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -2 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 px-4 text-sm font-black text-white shadow-xl shadow-blue-500/40 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative inline-flex items-center gap-2">
                  {loading ? 'Signing in...' : 'Sign in'}
                  {!loading && <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
                </span>
              </motion.button>
            </form>

            <div className="relative mt-6 grid grid-cols-3 gap-2">
              {([
                ['Verified', ShieldCheck],
                ['Realtime', MessageCircle],
                ['Campus', CheckCircle2]
              ] as const).map(([label, Icon]) => (
                <span key={label} className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 px-3 py-2 text-xs font-black text-slate-700 shadow-sm">
                  <Icon size={14} className="text-blue-600" />
                  {label}
                </span>
              ))}
            </div>
          </motion.section>
        </main>
      </div>

      <AnimatePresence>
        {forgotOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="w-full max-w-md overflow-hidden rounded-lg border border-blue-100 bg-white p-6 text-slate-950 shadow-2xl"
            >
              <div className="mb-5 flex items-start gap-3">
                <div className="rounded-lg bg-blue-600 p-3 text-white shadow-lg shadow-blue-500/20">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black">{resetStep === 'request' ? 'Reset password' : 'Create new password'}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {resetStep === 'request' ? 'Prepare a secure reset token for your account.' : 'Use the reset token from your link or email.'}
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
                    className="h-12 w-full rounded-md border border-blue-100 bg-blue-50/50 px-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    required
                  />
                  <button disabled={resetLoading} className="h-12 w-full rounded-md bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60">
                    {resetLoading ? 'Preparing...' : 'Prepare reset'}
                  </button>
                </form>
              ) : (
                <form onSubmit={submitNewPassword} className="space-y-3">
                  <input
                    value={resetToken}
                    onChange={event => setResetToken(event.target.value)}
                    placeholder="Reset token"
                    className="h-12 w-full rounded-md border border-blue-100 bg-blue-50/50 px-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    required
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    placeholder="New password"
                    className="h-12 w-full rounded-md border border-blue-100 bg-blue-50/50 px-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    required
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    className="h-12 w-full rounded-md border border-blue-100 bg-blue-50/50 px-4 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    required
                  />
                  <button disabled={resetLoading || !canReset} className="h-12 w-full rounded-md bg-gradient-to-r from-blue-700 to-sky-500 px-4 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-50">
                    {resetLoading ? 'Updating...' : 'Update password'}
                  </button>
                </form>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setResetStep(resetStep === 'request' ? 'reset' : 'request')} className="text-sm font-black text-blue-700 transition hover:text-blue-900">
                  {resetStep === 'request' ? 'I have a token' : 'Request new token'}
                </button>
                <button type="button" onClick={() => setForgotOpen(false)} className="text-sm font-black text-slate-500 transition hover:text-slate-900">
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
