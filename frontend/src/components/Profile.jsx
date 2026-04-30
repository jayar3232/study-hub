import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  Award,
  BookOpen,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  Moon,
  Save,
  Shield,
  Sun,
  TrendingUp,
  User,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { resolveMediaUrl } from '../utils/media';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const formatMonthYear = (value) => {
  if (!value) return 'Recently';
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">{value}</p>
        {helper && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>}
      </div>
      <div className="rounded-lg bg-gray-100 p-3 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
        <Icon size={22} />
      </div>
    </div>
  </div>
);

export default function Profile() {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!user) return;

    setName(user.name || '');
    setCourse(user.course || '');
    setBio(user.bio || '');
    setAvatar(user.avatar || '');
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.put('/users/profile', { name, course, bio });
      login(localStorage.getItem('token'), res.data);
      toast.success('Profile updated');
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Update failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be 5MB or smaller');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);
    setUploading(true);
    try {
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAvatar(res.data.avatar);
      login(localStorage.getItem('token'), res.data.user || { ...user, avatar: res.data.avatar });
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Complete all password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/users/password', { currentPassword, newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Password change failed');
    } finally {
      setChangingPassword(false);
    }
  };

  const createdGroups = useMemo(
    () => groups.filter(group => getEntityId(group.creator) === getEntityId(user)),
    [groups, user]
  );

  const totalMembers = useMemo(
    () => groups.reduce((sum, group) => sum + (group.members?.length || 0), 0),
    [groups]
  );

  const completion = useMemo(() => {
    const fields = [user?.name, user?.email, user?.course, user?.bio, user?.avatar || avatar];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [avatar, user]);

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
      </div>
    );
  }

  const avatarSrc = resolveMediaUrl(avatar || user.avatar);
  const memberSince = formatMonthYear(user.createdAt);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="bg-gray-950 p-6 text-white dark:bg-black md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="h-28 w-28 overflow-hidden rounded-xl border-4 border-white/20 bg-gray-800 shadow-xl">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white">
                      <User size={42} />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-pink-600 text-white shadow-lg transition hover:bg-pink-700">
                  <Camera size={18} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55 text-xs font-semibold text-white">
                    Uploading
                  </div>
                )}
              </div>

              <div className="min-w-0 pb-1">
                <p className="text-sm font-semibold uppercase text-pink-200">Account profile</p>
                <h1 className="mt-1 break-words text-3xl font-bold md:text-4xl">{user.name}</h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/75">
                  <span className="inline-flex items-center gap-1"><Mail size={14} /> {user.email}</span>
                  {user.course && <span className="inline-flex items-center gap-1"><BookOpen size={14} /> {user.course}</span>}
                </div>
              </div>
            </div>

            <div className="w-full rounded-xl bg-white/10 p-4 backdrop-blur md:w-72">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Profile completeness</span>
                <span>{completion}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-pink-400 transition-all" style={{ width: `${completion}%` }} />
              </div>
              <p className="mt-2 text-xs text-white/65">Add course, bio, and avatar for a stronger profile.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800 md:grid-cols-3">
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Member since</p>
            <p className="mt-1 font-semibold text-gray-950 dark:text-white">{memberSince}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Groups joined</p>
            <p className="mt-1 font-semibold text-gray-950 dark:text-white">{groups.length}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Security</p>
            <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-300">Password protected</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Groups Joined" value={groups.length} helper="Workspaces you can access" />
        <StatCard icon={TrendingUp} label="Total Members" value={totalMembers} helper="Across your joined groups" />
        <StatCard icon={Award} label="Created by You" value={createdGroups.length} helper="Groups you own" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">Personal information</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Keep your visible profile accurate for classmates and group members.</p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                Edit profile
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Full name</span>
                <input value={name} onChange={event => setName(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Course or program</span>
                <input value={course} onChange={event => setCourse(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Bio</span>
                <textarea value={bio} onChange={event => setBio(event.target.value)} rows="4" className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950" placeholder="Write a short professional intro..." />
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditing(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <X size={16} /> Cancel
                </button>
                <button type="submit" disabled={savingProfile} className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
                  <Save size={16} /> {savingProfile ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Name</p>
                <p className="mt-1 font-semibold text-gray-950 dark:text-white">{user.name}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Email</p>
                <p className="mt-1 break-words font-semibold text-gray-950 dark:text-white">{user.email}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Course</p>
                <p className="mt-1 font-semibold text-gray-950 dark:text-white">{user.course || 'Not set'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Bio</p>
                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">{user.bio || 'No bio yet.'}</p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Shield size={20} className="text-pink-600" />
              <div>
                <h2 className="font-bold text-gray-950 dark:text-white">Security</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Update your password anytime.</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              {['currentPassword', 'newPassword', 'confirmPassword'].map(field => (
                <label key={field} className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {field === 'currentPassword' ? 'Current password' : field === 'newPassword' ? 'New password' : 'Confirm password'}
                  </span>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={passwordForm[field]}
                      onChange={event => setPasswordForm(prev => ({ ...prev, [field]: event.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                  </div>
                </label>
              ))}
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setShowPasswords(value => !value)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 transition hover:text-gray-800 dark:hover:text-gray-200">
                  {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showPasswords ? 'Hide' : 'Show'}
                </button>
                <button type="submit" disabled={changingPassword} className="rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
                  {changingPassword ? 'Updating...' : 'Change password'}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <Activity size={20} className="text-pink-600" />
              <h2 className="font-bold text-gray-950 dark:text-white">Account actions</h2>
            </div>
            <div className="space-y-2">
              <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                <span className="inline-flex items-center gap-2">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />} Appearance</span>
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <button onClick={logout} className="flex w-full items-center justify-between rounded-lg border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                <span className="inline-flex items-center gap-2"><LogOut size={17} /> Sign out</span>
                <span>Logout</span>
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-600" />
              <h2 className="font-bold text-gray-950 dark:text-white">Profile checklist</h2>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Name added', Boolean(user.name)],
                ['Course added', Boolean(user.course)],
                ['Bio added', Boolean(user.bio)],
                ['Avatar uploaded', Boolean(user.avatar || avatar)]
              ].map(([label, done]) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-950">
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                  <span className={done ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-400'}>{done ? 'Done' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
