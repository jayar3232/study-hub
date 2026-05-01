import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SCHOOL_LOGO_SRC } from '../utils/academics';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-gray-950 dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[1fr_0.95fr]">
        <section className="hidden border-r border-gray-200 bg-white px-10 py-12 dark:border-gray-800 dark:bg-gray-900 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo placeholder" className="h-12 w-12 rounded-2xl bg-gray-100 object-cover p-1 dark:bg-gray-800" />
            <div>
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">WorkLoop</div>
              <p className="text-xs font-semibold uppercase text-gray-400">NEMSU workspace</p>
            </div>
          </div>
          <div className="max-w-lg">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-pink-500">Study workspace</p>
            <h1 className="text-5xl font-bold leading-tight tracking-normal text-gray-950 dark:text-white">
              Organize groups, tasks, files, and messages in one place.
            </h1>
            <p className="mt-5 text-lg leading-8 text-gray-600 dark:text-gray-300">
              A focused dashboard for student collaboration with realtime chat, shared work, and cleaner group coordination.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-gray-600 dark:text-gray-300">
            {['Groups', 'Tasks', 'Realtime chat'].map(item => (
              <div key={item} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
                {item}
              </div>
            ))}
          </div>
        </section>

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
              <div className="mb-7">
                <h2 className="text-2xl font-bold tracking-normal text-gray-950 dark:text-white">Welcome back</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sign in to continue to your workspace.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-gray-950/15 transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-pink-200"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                New to StudyHub?{' '}
                <Link to="/register" className="font-semibold text-pink-600 hover:text-pink-700 dark:text-pink-400">
                  Create an account
                </Link>
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
