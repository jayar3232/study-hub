import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  Award,
  BookOpen,
  Building2,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Mail,
  Palette,
  Save,
  Shield,
  Trophy,
  TrendingUp,
  User,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { resolveMediaUrl } from '../utils/media';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge from './GameRankBadge';
import { CAMPUS_OPTIONS, COURSE_OPTIONS, SCHOOL_LOGO_SRC } from '../utils/academics';
import LoadingSpinner from './LoadingSpinner';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const formatMonthYear = (value) => {
  if (!value) return 'Recently';
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <motion.div
    whileHover={{ y: -6, scale: 1.015 }}
    className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 transition hover:border-pink-200 hover:shadow-2xl hover:shadow-pink-500/15 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10 dark:hover:border-pink-900/60"
  >
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-emerald-400 opacity-80" />
    <div className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-pink-100/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">{value}</p>
        {helper && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>}
      </div>
      <div className="rounded-xl bg-gradient-to-br from-cyan-400 via-pink-500 to-indigo-500 p-3 text-white shadow-lg shadow-pink-500/20">
        <Icon size={22} />
      </div>
    </div>
  </motion.div>
);

export default function Profile() {
  const { user, login, logout } = useAuth();
  const { currentTheme, toggleTheme } = useTheme();

  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [campus, setCampus] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [coverPhoto, setCoverPhoto] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [groups, setGroups] = useState([]);
  const [rankData, setRankData] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (!user) return;

    setName(user.name || '');
    setCourse(user.course || '');
    setCampus(user.campus || '');
    setBio(user.bio || '');
    setAvatar(user.avatar || '');
    setCoverPhoto(user.coverPhoto || '');
    setCoverLoadFailed(false);
    fetchGroups();
    fetchRankings();
    fetchGameSummary();
  }, [user]);

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups');
      setGroups(res.data);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchRankings = async () => {
    try {
      const res = await api.get('/users/rankings/me');
      setRankData(res.data);
    } catch (err) {
      console.error('Error fetching rankings:', err);
    }
  };

  const fetchGameSummary = async () => {
    try {
      const res = await api.get('/games/summary/me');
      setGameData(res.data);
    } catch (err) {
      console.error('Error fetching game summary:', err);
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
      const res = await api.put('/users/profile', { name, course, campus, bio });
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
      const res = await api.post('/users/avatar', formData);
      setAvatar(res.data.avatar);
      login(localStorage.getItem('token'), res.data.user || { ...user, avatar: res.data.avatar });
      toast.success('Avatar updated');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Cover photo must be 5MB or smaller');
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
    setCoverLoadFailed(false);

    const formData = new FormData();
    formData.append('coverPhoto', file);
    setUploadingCover(true);
    try {
      const res = await api.post('/users/cover-photo', formData);
      setCoverPhoto(res.data.coverPhoto);
      setCoverLoadFailed(false);
      login(localStorage.getItem('token'), res.data.user || { ...user, coverPhoto: res.data.coverPhoto });
      toast.success('Cover photo updated');
    } catch (err) {
      setCoverPreview('');
      toast.error(err.response?.data?.msg || 'Cover upload failed');
    } finally {
      setUploadingCover(false);
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
    const fields = [user?.name, user?.email, user?.course, user?.campus, user?.bio, user?.avatar || avatar, user?.coverPhoto || coverPhoto];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [avatar, coverPhoto, user]);

  if (!user) {
    return <LoadingSpinner label="Loading profile" />;
  }

  const avatarSrc = resolveMediaUrl(avatar || user.avatar);
  const resolvedCoverSrc = resolveMediaUrl(coverPhoto || user.coverPhoto);
  const coverSrc = coverPreview || resolvedCoverSrc;
  const memberSince = formatMonthYear(user.createdAt);
  const rankStats = rankData?.me;
  const gameStats = gameData?.stats || gameData?.typingStats;
  const leaderboard = rankData?.leaderboard || [];
  const currentPosition = rankData?.currentUserRank?.position;

  return (
    <div className="mobile-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:space-y-6 sm:px-6 sm:py-4 lg:px-8">
      <section className="mobile-profile-hero overflow-hidden rounded-2xl border border-white/70 bg-white shadow-xl shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
        <div className="relative min-h-[300px] overflow-hidden bg-gray-950 p-6 text-white md:p-8">
          {coverSrc && !coverLoadFailed ? (
            <img
              src={coverSrc}
              alt="Profile cover"
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={() => setCoverLoadFailed(false)}
              onError={() => setCoverLoadFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.32),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.28),transparent_34%),linear-gradient(135deg,#020617,#111827_52%,#172554)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/60 to-black/24" />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-pink-500 to-emerald-300" />
          <label className="absolute right-4 top-4 z-20 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-black uppercase text-white shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:border-pink-200 hover:bg-pink-500/80">
            <Camera size={15} />
            {coverSrc ? 'Change cover' : 'Set cover'}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
          </label>
          {uploadingCover && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 text-sm font-black text-white backdrop-blur-sm">
              Uploading cover photo...
            </div>
          )}

          <div className="relative z-10 flex min-h-[244px] flex-col justify-end gap-6 md:flex-row md:items-end md:justify-between">
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
                  {user.campus && <span className="inline-flex items-center gap-1"><Building2 size={14} /> {user.campus}</span>}
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 md:w-80">
              <div className="rounded-2xl border border-white/15 bg-black/45 p-4 text-white shadow-xl backdrop-blur">
                <div className="flex items-center gap-3">
                  <RankEmblem rank={rankStats?.rank} size="sm" animated />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-pink-100/80">Current rank</p>
                    <p className="truncate text-lg font-black">{rankStats?.rank?.name || 'Rookie Operator'}</p>
                    <p className="text-xs text-white/65">{rankStats?.xp || 0} XP · #{currentPosition || '-'} network rank</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-black/45 p-4 text-white shadow-xl backdrop-blur">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Profile completeness</span>
                  <span>{completion}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-pink-400 transition-all" style={{ width: `${completion}%` }} />
                </div>
                <p className="mt-2 text-xs text-white/65">Add course, campus, bio, avatar, and cover photo for a stronger profile.</p>
              </div>
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

      <div className="mobile-metric-strip grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label="Groups Joined" value={groups.length} helper="Workspaces you can access" />
        <StatCard icon={TrendingUp} label="Total Members" value={totalMembers} helper="Across your joined groups" />
        <StatCard icon={Award} label="Created by You" value={createdGroups.length} helper="Groups you own" />
        <StatCard icon={Trophy} label="Completed Tasks" value={rankStats?.completedTasks || 0} helper={`${rankStats?.xp || 0} career XP`} />
        <StatCard icon={Trophy} label="Arena High Score" value={gameStats?.highScore || 0} helper={`${gameStats?.totalPlays || 0} ranked runs`} />
      </div>

      <section className="mobile-content-stack grid gap-4 lg:grid-cols-2 xl:grid-cols-[0.8fr_0.8fr_1.1fr]">
        <RankBadge stats={rankStats} />
        <GameRankBadge stats={gameStats} />
        <div className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-950 dark:text-white">Network Leaderboard</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top contributors from your shared workspaces.</p>
            </div>
            <Trophy className="text-yellow-500" size={24} />
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map(entry => {
              const itemAvatar = resolveMediaUrl(entry.user?.avatar);
              const isMe = getEntityId(entry.user) === getEntityId(user);

              return (
                <div key={entry.user?._id || entry.position} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isMe ? 'border-pink-200 bg-pink-50 dark:border-pink-900/60 dark:bg-pink-950/20' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50'}`}>
                  <div className="w-7 text-center text-sm font-black text-gray-500 dark:text-gray-400">#{entry.position}</div>
                  <RankEmblem rank={entry.stats?.rank} size="sm" animated />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-bold text-white">
                    {itemAvatar ? <img src={itemAvatar} alt={entry.user?.name || 'User'} className="h-full w-full object-cover" /> : entry.user?.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{entry.user?.name || 'User'}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{entry.stats?.rank?.shortName || 'Rookie'} · {entry.stats?.completedTasks || 0} tasks</p>
                  </div>
                  <div className="text-right text-sm font-black text-gray-950 dark:text-white">{entry.stats?.xp || 0}</div>
                </div>
              );
            })}
            {leaderboard.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-950/50 dark:text-gray-400">
                Complete assigned tasks to start the leaderboard.
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mobile-content-stack grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
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
                <select value={course} onChange={event => setCourse(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                  <option value="">Select course</option>
                  {COURSE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Campus / branch</span>
                <select value={campus} onChange={event => setCampus(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                  <option value="">Select campus</option>
                  {CAMPUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
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
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Campus</p>
                <p className="mt-1 font-semibold text-gray-950 dark:text-white">{user.campus || 'Not set'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Bio</p>
                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">{user.bio || 'No bio yet.'}</p>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-950">
              <img src={SCHOOL_LOGO_SRC} alt="NEMSU logo" className="h-12 w-12 rounded-xl bg-white object-cover p-1 dark:bg-gray-900" />
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-gray-950 dark:text-white">North Eastern Mindanao State University</p>
                <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{user.campus || 'Campus not set'}</p>
              </div>
            </div>
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

          <section className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
            <div className="mb-4 flex items-center gap-2">
              <Activity size={20} className="text-pink-600" />
              <h2 className="font-bold text-gray-950 dark:text-white">Account actions</h2>
            </div>
            <div className="space-y-2">
              <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                <span className="inline-flex items-center gap-2"><Palette size={17} /> Appearance</span>
                <span>{currentTheme?.label || 'Theme'}</span>
              </button>
              <button onClick={logout} className="flex w-full items-center justify-between rounded-lg border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                <span className="inline-flex items-center gap-2"><LogOut size={17} /> Sign out</span>
                <span>Logout</span>
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-600" />
              <h2 className="font-bold text-gray-950 dark:text-white">Profile checklist</h2>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Name added', Boolean(user.name)],
                ['Course added', Boolean(user.course)],
                ['Campus selected', Boolean(user.campus)],
                ['Bio added', Boolean(user.bio)],
                ['Avatar uploaded', Boolean(user.avatar || avatar)],
                ['Cover photo uploaded', Boolean(user.coverPhoto || coverPhoto)]
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

