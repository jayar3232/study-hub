import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20"
      >
        <div className="text-center mb-8">
          <LogIn className="w-12 h-12 text-white mx-auto mb-2" />
          <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
          <p className="text-purple-200 mt-2">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-purple-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white p-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </motion.button>
        </form>
        <p className="text-center mt-6 text-purple-200">
          Don't have an account? <Link to="/register" className="text-white font-semibold hover:underline">Register</Link>
        </p>
      </motion.div>
    </div>
  );
}