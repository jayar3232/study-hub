import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AppLogo, { AppLogoMark } from './AppLogo';

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
    <div className="relative h-[100svh] overflow-y-auto overflow-x-hidden overscroll-contain bg-gray-950 text-white">
      <div className="fixed inset-0 bg-[linear-gradient(135deg,#08111f_0%,#0d1729_38%,#171026_70%,#061b24_100%)]" />
      <div className="fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative grid min-h-full lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-screen px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <AppLogo size="md" wordSize="md" tone="inverse" />

          <div className="max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase text-cyan-100 backdrop-blur"
            >
              <Sparkles size={14} />
              realtime campus portal
            </motion.div>
            <h1 className="mt-6 text-6xl font-black leading-[1.02] tracking-normal">
              Sign in to your team command center.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-white/65">
              Manage marketplace, reports, rankings, media, and realtime messages in one polished school app.
            </p>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3">
            <AuthMetric icon={Users} label="Collaboration" value="Live" delay={0.1} />
            <AuthMetric icon={ShieldCheck} label="Protected" value="Secure" delay={0.18} />
            <AuthMetric icon={CheckCircle2} label="Workflows" value="Clean" delay={0.26} />
          </div>
        </section>

        <main className="flex min-h-full items-center justify-start px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6 sm:py-8 lg:justify-center">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 24, stiffness: 240 }}
            className="w-full max-w-[430px]"
          >
            <div className="mb-6 flex justify-center lg:hidden">
              <AppLogo size="sm" wordSize="sm" tone="inverse" />
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 p-6 text-gray-950 shadow-2xl shadow-pink-500/20 dark:bg-gray-900/95 dark:text-white sm:p-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-pink-500 to-emerald-300" />
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-tr-[2rem] border-r-2 border-t-2 border-pink-300/80 shadow-[14px_-14px_45px_rgba(236,72,153,0.25)]" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-bl-[2rem] border-b-2 border-l-2 border-cyan-300/80 shadow-[-14px_14px_45px_rgba(34,211,238,0.18)]" />

              <div className="relative mb-7 text-center">
                <AppLogoMark size="lg" className="mx-auto" />
                <h2 className="mt-5 text-3xl font-black tracking-normal">Welcome back</h2>
                <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Login to continue your campus flow.</p>
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
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm sm:items-center"
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
