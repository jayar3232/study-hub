import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, BookOpen, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, User, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CAMPUS_OPTIONS, COURSE_OPTIONS, SCHOOL_LOGO_SRC } from '../utils/academics';

const authBaseUrl = () => (api.defaults.baseURL || '/api').replace(/\/$/, '');

const SocialButton = ({ provider, loading, onClick }) => {
  const isGoogle = provider === 'google';
  return (
    <button
      type="button"
      onClick={() => onClick(provider)}
      disabled={loading}
      className="group inline-flex h-12 items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-xl hover:shadow-pink-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-pink-900/70"
    >
      <span className={`grid h-7 w-7 place-items-center rounded-full text-base font-black ${isGoogle ? 'bg-white text-pink-600 ring-1 ring-gray-200' : 'bg-pink-600 text-white'}`}>
        {isGoogle ? 'G' : 'f'}
      </span>
      {isGoogle ? 'Google' : 'Facebook'}
    </button>
  );
};

const InfoPill = ({ icon: Icon, text, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: 'spring', damping: 22, stiffness: 240 }}
    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-black text-white shadow-lg shadow-black/10 backdrop-blur"
  >
    <Icon size={17} className="text-cyan-200" />
    {text}
  </motion.div>
);

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [course, setCourse] = useState('');
  const [campus, setCampus] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/register', { name, email, password, course, campus });
      login(res.data.token, res.data.user);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Registration failed');
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

  return (
    <div className="min-h-screen overflow-hidden bg-gray-950 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#061b24_0%,#11182a_42%,#1a1028_74%,#09111f_100%)]" />
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative grid min-h-screen lg:grid-cols-[0.96fr_1.04fr]">
        <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 24, stiffness: 240 }}
            className="w-full max-w-[470px]"
          >
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo" className="h-12 w-12 rounded-2xl bg-white object-cover p-1" />
              <div className="text-3xl font-black">Student<span className="text-pink-500">Hub</span></div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 p-6 text-gray-950 shadow-2xl shadow-cyan-500/20 dark:bg-gray-900/95 dark:text-white sm:p-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-cyan-400 to-pink-500" />
              <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-tr-[2rem] border-r-2 border-t-2 border-cyan-300/80 shadow-[14px_-14px_45px_rgba(34,211,238,0.22)]" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-bl-[2rem] border-b-2 border-l-2 border-pink-300/80 shadow-[-14px_14px_45px_rgba(236,72,153,0.22)]" />

              <div className="relative mb-6 flex items-start gap-4">
                <motion.img
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  src={SCHOOL_LOGO_SRC}
                  alt="NEMSU logo"
                  className="h-16 w-16 shrink-0 rounded-2xl bg-gray-950 object-cover p-1 shadow-xl shadow-pink-500/20 dark:bg-white"
                />
                <div>
                  <p className="text-xs font-black uppercase text-pink-500">Student workspace access</p>
                  <h2 className="mt-1 text-3xl font-black tracking-normal">Create account</h2>
                  <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">For North Eastern Mindanao State University teams.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="relative space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">Full name</span>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
                    <input
                      type="text"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-cyan-500"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      placeholder="Your complete name"
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">Student Email</span>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500" />
                    <input
                      type="email"
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-pink-500"
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
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-12 text-sm font-semibold outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-indigo-500"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-pink-500" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">Course</span>
                    <div className="relative">
                      <BookOpen size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
                      <select
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-cyan-300 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-cyan-500"
                        value={course}
                        onChange={event => setCourse(event.target.value)}
                        required
                      >
                        <option value="">Select course</option>
                        {COURSE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-300">Campus</span>
                    <div className="relative">
                      <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500" />
                      <select
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-pink-500"
                        value={campus}
                        onChange={event => setCampus(event.target.value)}
                        required
                      >
                        <option value="">Select campus</option>
                        {CAMPUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-pink-500 to-indigo-500 px-4 py-3.5 text-sm font-black text-white shadow-xl shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-pink-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                  {!loading && <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
                </button>
              </form>

              <div className="relative my-6 flex items-center gap-3 text-xs font-black uppercase text-gray-400">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                Or sign up with
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SocialButton provider="google" loading={Boolean(socialLoading)} onClick={startSocialLogin} />
                <SocialButton provider="facebook" loading={Boolean(socialLoading)} onClick={startSocialLogin} />
              </div>

              <p className="mt-6 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                Already registered?{' '}
                <Link to="/login" className="font-black text-pink-600 transition hover:text-cyan-600 dark:text-pink-300">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </main>

        <section className="hidden min-h-screen px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <motion.img
              animate={{ y: [0, -5, 0], rotate: [0, 1, -1, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              src={SCHOOL_LOGO_SRC}
              alt="NEMSU logo"
              className="h-14 w-14 rounded-2xl bg-white object-cover p-1 shadow-2xl shadow-pink-500/20"
            />
            <div>
              <div className="text-3xl font-black tracking-normal">Nex<span className="bg-gradient-to-r from-pink-300 to-cyan-300 bg-clip-text text-transparent">us</span></div>
              <p className="text-xs font-black uppercase text-white/45">NEMSU workspace network</p>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase text-pink-100 backdrop-blur">
              <Sparkles size={14} />
              build your workspace identity
            </div>
            <h1 className="mt-6 text-6xl font-black leading-[1.02] tracking-normal">
              Join your campus team network.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-white/65">
              Create your profile once, then connect with workspaces, friends, chat, reports, and project rankings.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <InfoPill icon={Users} text="Workspace-ready" delay={0.1} />
            <InfoPill icon={ShieldCheck} text="Protected accounts" delay={0.18} />
            <InfoPill icon={CheckCircle2} text="Course and campus fixed" delay={0.26} />
          </div>
        </section>
      </div>
    </div>
  );
}
