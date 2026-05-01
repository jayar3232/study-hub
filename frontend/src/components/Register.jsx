import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, BookOpen, Building2, Lock, Mail, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CAMPUS_OPTIONS, COURSE_OPTIONS, SCHOOL_LOGO_SRC } from '../utils/academics';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [course, setCourse] = useState('');
  const [campus, setCampus] = useState('');
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1fr]">
        <main className="flex items-center justify-center px-4 py-10 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            className="w-full max-w-md"
          >
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo placeholder" className="h-10 w-10 rounded-2xl bg-white object-cover p-1 dark:bg-gray-900" />
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">WorkLoop</div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/60 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/20 sm:p-8">
              <div className="mb-7 flex items-start gap-3">
                <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo placeholder" className="h-12 w-12 shrink-0 rounded-2xl bg-gray-100 object-cover p-1 dark:bg-gray-800" />
                <div>
                <h2 className="text-2xl font-bold tracking-normal text-gray-950 dark:text-white">Create your account</h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">For North Eastern Mindanao State University workspaces.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Full name</span>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                      value={name}
                      onChange={event => setName(event.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Course</span>
                  <div className="relative">
                    <BookOpen size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
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
                  <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Campus / Branch</span>
                  <div className="relative">
                    <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-300 focus:bg-white focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-pink-500"
                      value={campus}
                      onChange={event => setCampus(event.target.value)}
                      required
                    >
                      <option value="">Select campus</option>
                      {CAMPUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-950/15 transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-pink-200"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-pink-600 hover:text-pink-700 dark:text-pink-400">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </main>

        <section className="hidden border-l border-gray-200 bg-white px-10 py-12 dark:border-gray-800 dark:bg-gray-900 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo placeholder" className="h-12 w-12 rounded-2xl bg-gray-100 object-cover p-1 dark:bg-gray-800" />
            <div>
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">WorkLoop</div>
              <p className="text-xs font-semibold uppercase text-gray-400">NEMSU workspace</p>
            </div>
          </div>
          <div className="max-w-lg">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-pink-500">Collaborative learning</p>
            <h1 className="text-5xl font-bold leading-tight tracking-normal text-gray-950 dark:text-white">
              Build a calmer place for group work.
            </h1>
            <p className="mt-5 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Create groups, assign tasks, share files, and keep conversations connected to your class work.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            Your dashboard is ready immediately after signup.
          </div>
        </section>
      </div>
    </div>
  );
}
