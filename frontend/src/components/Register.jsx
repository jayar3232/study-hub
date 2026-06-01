import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  User
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CAMPUS_OPTIONS, COURSE_OPTIONS } from '../utils/academics';
import { AppLogoMark } from './AppLogo';
import { AuthBackground, AuthShowcasePanel } from './AuthBackground';

const registerHighlights = [
  ['Chat', MessageCircle, 'text-sky-600'],
  ['Course', GraduationCap, 'text-blue-600'],
  ['Market', ShoppingBag, 'text-indigo-600']
];

const RegisterShowcase = () => (
  <AuthShowcasePanel
    eyebrow="Syncrova"
    title="Create a cleaner student profile."
    subtitle="Register once for campus conversations, marketplace access, group workspaces, and developer-reviewed safety controls."
    highlights={registerHighlights}
    AppLogoMark={AppLogoMark}
  >
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wider text-blue-600">Identity</p>
        <p className="mt-1 text-lg font-black text-slate-900">Student profile</p>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 backdrop-blur">
        <p className="text-xs font-black uppercase tracking-wider text-blue-600">Protection</p>
        <p className="mt-1 text-lg font-black text-slate-900">Developer review</p>
      </div>
    </div>
  </AuthShowcasePanel>
);

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [course, setCourse] = useState('');
  const [campus, setCampus] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/register', { name, email, password, course, campus, adminCode });
      login(res.data.token, res.data.user);
      toast.success('Account created');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[100svh] overflow-y-auto bg-white px-4 py-6 text-slate-950 sm:px-6 lg:px-10">
      <AuthBackground />
      <div className="relative mx-auto grid min-h-full max-w-7xl items-center gap-6 lg:grid-cols-[0.96fr_1.04fr]">
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
                <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700">New Syncrova account</span>
                <h2 className="mt-3 bg-gradient-to-r from-slate-900 via-blue-800 to-sky-600 bg-clip-text text-[1.95rem] font-black leading-tight text-transparent">Create student account</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Set up your campus profile in under a minute.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="relative mt-8 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Name</span>
                  <div className="group relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                    <input
                      type="text"
                      className="h-12 w-full rounded-xl border border-blue-100 bg-white/80 pl-12 pr-4 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      placeholder="Full name"
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>

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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Campus</span>
                  <div className="group relative">
                    <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                    <select
                      className="h-12 w-full appearance-none rounded-xl border border-blue-100 bg-white/80 pl-12 pr-4 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                      value={campus}
                      onChange={event => setCampus(event.target.value)}
                      required
                    >
                      <option value="">Select campus</option>
                      {CAMPUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-black text-slate-700">Course</span>
                  <div className="group relative">
                    <GraduationCap size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                    <select
                      className="h-12 w-full appearance-none rounded-xl border border-blue-100 bg-white/80 pl-12 pr-4 text-sm font-black text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                      value={course}
                      onChange={event => setCourse(event.target.value)}
                      required
                    >
                      <option value="">Select course</option>
                      {COURSE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Password</span>
                <div className="group relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="h-12 w-full rounded-xl border border-blue-100 bg-white/80 pl-12 pr-12 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Minimum 6 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 transition hover:text-blue-700" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Developer setup code <span className="font-bold text-slate-400">(optional)</span></span>
                <div className="group relative">
                  <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 transition group-focus-within:text-blue-600" />
                  <input
                    type="password"
                    className="h-12 w-full rounded-xl border border-blue-100 bg-white/80 pl-12 pr-4 text-sm font-bold text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:bg-white focus:shadow-lg focus:shadow-blue-200/60 focus:ring-4 focus:ring-blue-100"
                    value={adminCode}
                    onChange={event => setAdminCode(event.target.value)}
                    placeholder="Only for assigned developer accounts"
                    autoComplete="off"
                  />
                </div>
              </label>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -2 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 px-4 text-sm font-black text-white shadow-xl shadow-blue-500/40 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative inline-flex items-center gap-2">
                  {loading ? 'Creating account...' : 'Create account'}
                  {!loading && <ArrowRight size={17} className="transition group-hover:translate-x-1" />}
                </span>
              </motion.button>
            </form>

            <div className="relative mt-6 grid grid-cols-3 gap-2">
              {[
                ['Verified', ShieldCheck],
                ['Campus', Building2],
                ['Secure', CheckCircle2]
              ].map(([label, Icon]) => (
                <span key={label} className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50 px-3 py-2 text-xs font-black text-slate-700 shadow-sm">
                  <Icon size={14} className="text-blue-600" />
                  {label}
                </span>
              ))}
            </div>

            <p className="relative mt-5 text-center text-sm font-semibold text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="font-black text-blue-700 transition hover:text-blue-900 hover:underline">
                Sign in
              </Link>
            </p>
          </motion.section>
        </main>

        <RegisterShowcase />
      </div>
    </div>
  );
}
