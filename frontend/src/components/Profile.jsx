import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle,
  Eye,
  EyeOff,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Palette,
  PlayCircle,
  Save,
  Settings,
  Shield,
  Smartphone,
  Trophy,
  TrendingUp,
  User,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { optimizeImageFile, resolveMediaUrl } from '../utils/media';
import { formatStoryAge, getStoryListForActiveStory, groupActiveStoriesByOwner } from '../utils/stories';
import RankBadge, { RankEmblem } from './RankBadge';
import GameRankBadge, { getProfileFrameClass } from './GameRankBadge';
import { CAMPUS_OPTIONS, COURSE_OPTIONS, SCHOOL_LOGO_SRC } from '../utils/academics';
import LoadingSpinner from './LoadingSpinner';
import StoryViewer from './StoryViewer';
import VideoThumbnail from './VideoThumbnail';
import { IconBadge, Panel } from './ui/Primitives';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');
const formatMonthYear = (value) => {
  if (!value) return 'Recently';
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <Panel
    as={motion.div}
    whileHover={{ y: -6, scale: 1.015 }}
    className="profile-stat-card p-4 transition hover:border-blue-200 hover:shadow-md dark:hover:border-blue-900/60"
  >
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-3xl font-black text-gray-950 dark:text-white">{value}</p>
        {helper && <p className="mt-1 truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{helper}</p>}
      </div>
      <IconBadge icon={Icon} tone="blue" />
    </div>
  </Panel>
);

const formatProfileTime = (value) => {
  if (!value) return 'Recently';
  try {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recently';
  }
};

const buildAchievementBadges = ({ completion, groups, createdGroups, rankStats, gameStats, storyItems, myStoryCount }) => ([
  {
    id: 'profile-pro',
    title: 'Profile Pro',
    helper: 'Complete profile identity',
    icon: User,
    unlocked: completion >= 90,
    progress: completion
  },
  {
    id: 'workspace-builder',
    title: 'Workspace Builder',
    helper: 'Create or join team spaces',
    icon: Users,
    unlocked: groups.length >= 3 || createdGroups.length >= 1,
    progress: Math.min(100, Math.max(groups.length, createdGroups.length * 3) * 34)
  },
  {
    id: 'task-finisher',
    title: 'Task Finisher',
    helper: 'Complete ranked workspace tasks',
    icon: CheckCircle,
    unlocked: (rankStats?.completedTasks || 0) >= 3,
    progress: Math.min(100, ((rankStats?.completedTasks || 0) / 3) * 100)
  },
  {
    id: 'arena-player',
    title: 'Arena Player',
    helper: 'Save game runs in Fix Arena',
    icon: Trophy,
    unlocked: (gameStats?.totalPlays || 0) >= 5,
    progress: Math.min(100, ((gameStats?.totalPlays || 0) / 5) * 100)
  },
  {
    id: 'story-pulse',
    title: 'Story Pulse',
    helper: 'Keep My Day active',
    icon: PlayCircle,
    unlocked: myStoryCount > 0,
    progress: myStoryCount > 0 ? 100 : Math.min(100, storyItems.length * 20)
  },
  {
    id: 'network-ranked',
    title: 'Network Ranked',
    helper: 'Earn collaboration XP',
    icon: Award,
    unlocked: (rankStats?.xp || 0) >= 250,
    progress: Math.min(100, ((rankStats?.xp || 0) / 250) * 100)
  }
]);

export default function Profile() {
  const { user, login, logout } = useAuth();
  const { currentTheme, toggleTheme, mobileLightOnly } = useTheme();

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
  const [stories, setStories] = useState([]);
  const [storyUploading, setStoryUploading] = useState(false);
  const [activeStory, setActiveStory] = useState(null);
  const [storyCommenting, setStoryCommenting] = useState(false);
  const [storyPrivacy, setStoryPrivacy] = useState(() => localStorage.getItem('syncrova-story-privacy') || 'friends');
  const [profilePrivacy, setProfilePrivacy] = useState(() => localStorage.getItem('syncrova-profile-privacy') || 'friends');
  const [showOnlineStatus, setShowOnlineStatus] = useState(() => localStorage.getItem('syncrova-show-online') !== 'false');
  const [notifyStoryActivity, setNotifyStoryActivity] = useState(() => localStorage.getItem('syncrova-notify-story') !== 'false');
  const [activeProfileTab, setActiveProfileTab] = useState('posts');
  const storyInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('syncrova-story-privacy', storyPrivacy);
  }, [storyPrivacy]);

  useEffect(() => {
    localStorage.setItem('syncrova-profile-privacy', profilePrivacy);
  }, [profilePrivacy]);

  useEffect(() => {
    localStorage.setItem('syncrova-show-online', String(showOnlineStatus));
  }, [showOnlineStatus]);

  useEffect(() => {
    localStorage.setItem('syncrova-notify-story', String(notifyStoryActivity));
  }, [notifyStoryActivity]);

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
    fetchStories(getEntityId(user));
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

  const fetchStories = async (targetUserId = getEntityId(user)) => {
    if (!targetUserId) return;
    try {
      const res = await api.get(`/stories/user/${targetUserId}/grouped`).catch(() => api.get(`/stories/user/${targetUserId}`));
      setStories(Array.isArray(res.data) ? res.data : res.data?.stories || []);
    } catch (err) {
      console.error('Error fetching My Day:', err);
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

    const uploadFile = await optimizeImageFile(file, { maxDimension: 900, quality: 0.86, minBytes: 300 * 1024 });

    if (uploadFile.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be 5MB or smaller');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', uploadFile);
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

    const uploadFile = await optimizeImageFile(file, { maxDimension: 1800, quality: 0.84, minBytes: 500 * 1024 });

    if (uploadFile.size > 5 * 1024 * 1024) {
      toast.error('Cover photo must be 5MB or smaller');
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    const previewUrl = URL.createObjectURL(file);
    setCoverPreview(previewUrl);
    setCoverLoadFailed(false);

    const formData = new FormData();
    formData.append('coverPhoto', uploadFile);
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

  const handleStoryUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const supported = file.type.startsWith('image/') || file.type.startsWith('video/');
    if (!supported) {
      toast.error('My Day supports photos and videos only');
      return;
    }

    const uploadFile = file.type.startsWith('image/')
      ? await optimizeImageFile(file, { maxDimension: 1600, quality: 0.84, minBytes: 700 * 1024 })
      : file;

    if (uploadFile.size > 30 * 1024 * 1024) {
      toast.error('My Day must be 30MB or smaller');
      return;
    }

    const formData = new FormData();
    formData.append('media', uploadFile);
    formData.append('privacy', storyPrivacy);
    setStoryUploading(true);
    try {
      const res = await api.post('/stories', formData);
      setStories(prev => [res.data, ...prev.filter(story => getEntityId(story) !== getEntityId(res.data))]);
      window.dispatchEvent(new CustomEvent('storiesUpdated'));
      toast.success('My Day posted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'My Day upload failed');
    } finally {
      setStoryUploading(false);
    }
  };

  const deleteStory = async (storyId) => {
    try {
      await api.delete(`/stories/${storyId}`);
      setStories(prev => prev.filter(story => getEntityId(story) !== storyId));
      setActiveStory(null);
      window.dispatchEvent(new CustomEvent('storiesUpdated'));
      toast.success('My Day deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Delete failed');
    }
  };

  const syncStory = (updatedStory) => {
    setStories(prev => prev.map(story => getEntityId(story) === getEntityId(updatedStory) ? updatedStory : story));
    setActiveStory(prev => getEntityId(prev) === getEntityId(updatedStory) ? updatedStory : prev);
    window.dispatchEvent(new CustomEvent('storiesUpdated'));
  };

  const openStory = async (story) => {
    setActiveStory(story);
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/view`);
      syncStory(res.data);
    } catch {
      // My Day viewer tracking should never block viewing media.
    }
  };

  const reactToStory = async (story, emoji) => {
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/react`, { emoji });
      syncStory(res.data);
      toast.success('Reaction sent');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Reaction failed');
    }
  };

  const commentOnStory = async (story = activeStory, text = '') => {
    const reply = String(text || '').trim();
    if (!story || !reply || storyCommenting) return;
    setStoryCommenting(true);
    try {
      const res = await api.post(`/stories/${getEntityId(story)}/comment`, { text: reply });
      syncStory(res.data?.story || res.data);
      toast.success('Sent to messages');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Comment failed');
    } finally {
      setStoryCommenting(false);
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
  const storyGroups = groupActiveStoriesByOwner(stories);
  const storyItems = storyGroups.flatMap(group => group.stories);
  const activeStoryList = getStoryListForActiveStory(storyGroups, activeStory);
  const myStoryCount = storyItems.filter(story => getEntityId(story.userId) === getEntityId(user)).length;
  const achievementBadges = buildAchievementBadges({
    completion,
    groups,
    createdGroups,
    rankStats,
    gameStats,
    storyItems,
    myStoryCount
  });
  const unlockedAchievements = achievementBadges.filter(item => item.unlocked).length;
  const profileTimeline = [
    ...storyItems.slice(0, 5).map(story => ({
      id: `story-${getEntityId(story)}`,
      icon: PlayCircle,
      title: `${story.userId?.name || user.name} posted a My Day`,
      detail: story.caption || (story.fileType === 'video' ? 'Video story' : 'Photo story'),
      time: story.createdAt,
      action: () => openStory(story)
    })),
    ...groups.slice(0, 4).map(group => ({
      id: `group-${getEntityId(group)}`,
      icon: Users,
      title: `Joined ${group.name || 'a workspace'}`,
      detail: group.description || `${group.members?.length || 0} members`,
      time: group.createdAt,
      href: `/group/${getEntityId(group)}`
    })),
    {
      id: 'rank-progress',
      icon: Award,
      title: rankStats?.rank?.name || 'Network rank ready',
      detail: `${rankStats?.xp || 0} XP from ${rankStats?.completedTasks || 0} completed tasks`,
      time: user.updatedAt || user.createdAt
    },
    {
      id: 'arena-progress',
      icon: Trophy,
      title: gameStats?.rank?.name || 'Arena season ready',
      detail: `${gameStats?.highScore || 0} high score across ${gameStats?.totalPlays || 0} runs`,
      time: user.updatedAt || user.createdAt,
      href: '/arena'
    }
  ]
    .filter(item => item.title)
    .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))
    .slice(0, 8);
  const profileTabs = [
    { id: 'posts', label: 'Timeline', icon: Activity, count: profileTimeline.length },
    { id: 'about', label: 'About', icon: User, count: completion },
    { id: 'groups', label: 'Workspaces', icon: Users, count: groups.length },
    { id: 'ranks', label: 'Achievements', icon: Trophy, count: unlockedAchievements },
    { id: 'myday', label: 'My Day', icon: PlayCircle, count: myStoryCount },
    { id: 'settings', label: 'Settings', icon: Settings, count: null }
  ];

  const selectProfileTab = (tabId) => {
    setActiveProfileTab(tabId);
    if (tabId !== 'about') setEditing(false);
    if (tabId !== 'about' && tabId !== 'settings') setShowPasswords(false);
  };

  const renderProfileTabs = (extraClassName = '') => (
    <nav className={`profile-tab-bar ${extraClassName} rounded-2xl border border-gray-200 bg-white px-2 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900`} aria-label="Profile sections">
      <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {profileTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeProfileTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectProfileTab(tab.id)}
              className={`profile-tab-button ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className="profile-tab-count">{tab.id === 'about' ? `${tab.count}%` : tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="mobile-page profile-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:space-y-6 sm:px-6 sm:py-4 lg:px-8">
      {renderProfileTabs('profile-tab-bar--mobile mobile-fixed-tabbar md:hidden')}

      <section className="mobile-profile-hero profile-hero-card overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="profile-hero-cover relative min-h-[300px] overflow-hidden bg-gray-950 p-6 text-white md:p-8">
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
          <div className="profile-hero-overlay absolute inset-0 bg-gradient-to-t from-black/88 via-black/50 to-black/18" />
          <label className="absolute right-4 top-4 z-20 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-xs font-black uppercase text-white shadow-xl backdrop-blur transition hover:border-blue-200 hover:bg-[#1877f2]/85">
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
                <div className={`h-28 w-28 overflow-hidden rounded-xl border-4 border-white/20 bg-gray-800 ${getProfileFrameClass(gameStats)}`}>
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white">
                      <User size={42} />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-[#1877f2] text-white shadow-lg transition hover:bg-[#0f63d5]">
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
                <p className="text-sm font-semibold uppercase text-blue-100">Profile</p>
                <h1 className="mt-1 break-words text-3xl font-bold md:text-4xl">{user.name}</h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/75">
                  <span className="inline-flex items-center gap-1"><Mail size={14} /> {user.email}</span>
                  {user.course && <span className="inline-flex items-center gap-1"><BookOpen size={14} /> {user.course}</span>}
                  {user.campus && <span className="inline-flex items-center gap-1"><Building2 size={14} /> {user.campus}</span>}
                </div>
              </div>
            </div>

            <div className="grid w-full gap-3 md:w-80">
              <div className="profile-hero-glass-card rounded-2xl border border-white/15 bg-black/45 p-4 text-white shadow-xl backdrop-blur">
                <div className="flex items-center gap-3">
                  <RankEmblem rank={rankStats?.rank} size="sm" animated />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase text-pink-100/80">Current rank</p>
                    <p className="truncate text-lg font-black">{rankStats?.rank?.name || 'Rookie Operator'}</p>
                    <p className="text-xs text-white/65">{rankStats?.xp || 0} XP - #{currentPosition || '-'} network rank</p>
                  </div>
                </div>
              </div>
              <div className="profile-hero-glass-card rounded-2xl border border-white/15 bg-black/45 p-4 text-white shadow-xl backdrop-blur">
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

        <div className="profile-hero-stat-grid grid gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800 md:grid-cols-3">
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Member since</p>
            <p className="mt-1 font-semibold text-gray-950 dark:text-white">{memberSince}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Workspaces joined</p>
            <p className="mt-1 font-semibold text-gray-950 dark:text-white">{groups.length}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Security</p>
            <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-300">Password protected</p>
          </div>
        </div>
      </section>

      {renderProfileTabs('hidden md:block')}

      {(activeProfileTab === 'posts' || activeProfileTab === 'myday') && (
      <section className="rounded-2xl border border-white/70 bg-white p-4 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
        <input ref={storyInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleStoryUpload} />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-gray-950 dark:text-white">My Day</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stories expire after 24 hours.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-black text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
              <Globe2 size={15} />
              <select value={storyPrivacy} onChange={event => setStoryPrivacy(event.target.value)} className="bg-transparent outline-none">
                <option value="friends">Friends</option>
                <option value="public">Public</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => storyInputRef.current?.click()}
              disabled={storyUploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877f2] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0f63d5] disabled:opacity-60"
            >
              {storyUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {myStoryCount ? 'Add more' : 'Post'}
            </button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => storyInputRef.current?.click()}
            className="relative h-44 w-28 shrink-0 overflow-hidden rounded-2xl border border-dashed border-blue-200 bg-blue-50 text-left dark:border-blue-900/60 dark:bg-blue-950/20"
          >
            <div className="absolute inset-0 grid place-items-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#1877f2] shadow-lg dark:bg-gray-950 dark:text-sky-300">
                {storyUploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="text-sm font-black text-gray-950 dark:text-white">Create My Day</p>
            </div>
          </button>

          {storyGroups.map(group => {
            const story = group.preview;
            const storyUrl = resolveMediaUrl(story.fileUrl);
            const owner = group.owner || story.userId || {};
            return (
              <button
                key={group.ownerId}
                type="button"
                onClick={() => openStory(story)}
                className="relative h-44 w-28 shrink-0 overflow-hidden rounded-2xl bg-gray-950 text-left shadow-lg ring-1 ring-gray-200 dark:ring-gray-800"
              >
                {story.fileType === 'image' ? (
                  <img src={storyUrl} alt={story.caption || 'My Day'} className="h-full w-full object-cover" />
                ) : (
                  <VideoThumbnail src={storyUrl} className="h-full w-full" iconSize={22} label={`${owner.name || 'Member'} story video`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
                <div className="absolute left-2 top-2 h-9 w-9 overflow-hidden rounded-full border-2 border-[#1877f2] bg-[#1877f2] shadow-lg shadow-blue-500/35">
                  {owner.avatar ? (
                    <img src={resolveMediaUrl(owner.avatar)} alt={owner.name || 'User'} className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-xs font-black text-white">{owner.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                {group.count > 1 && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
                    {group.count}
                  </span>
                )}
                {formatStoryAge(story) && (
                  <span className="absolute left-2 top-12 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">
                    {formatStoryAge(story)}
                  </span>
                )}
                {story.fileType === 'video' && <PlayCircle className={`absolute right-2 text-white ${group.count > 1 ? 'top-9' : 'top-3'}`} size={22} />}
                <p className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs font-black text-white">{owner.name || 'Member'}</p>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {activeProfileTab === 'posts' && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-sm font-black text-white">
                  {avatarSrc ? <img src={avatarSrc} alt={user.name} className="h-full w-full object-cover" /> : user.name?.charAt(0)?.toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => storyInputRef.current?.click()}
                  className="min-h-12 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 text-left text-sm font-semibold text-gray-500 transition hover:bg-blue-50 hover:text-blue-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-blue-950/25 dark:hover:text-blue-200"
                >
                  Share a professional update...
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => storyInputRef.current?.click()} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#1877f2] transition hover:bg-blue-100 dark:bg-blue-950/30 dark:text-sky-200">My Day</button>
                <Link to="/groups" className="rounded-xl bg-gray-50 px-3 py-2 text-center text-xs font-black text-gray-700 transition hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800">Workspaces</Link>
                <Link to="/messages" className="rounded-xl bg-gray-50 px-3 py-2 text-center text-xs font-black text-gray-700 transition hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800">Messages</Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-950 dark:text-white">Profile Timeline</h2>
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">My Day, workspace, rank, and arena milestones in one clean feed.</p>
                </div>
                <Activity className="text-[#1877f2]" size={22} />
              </div>
              <div className="space-y-3">
                {profileTimeline.map(item => {
                  const Icon = item.icon || Activity;
                  const content = (
                    <div className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#1877f2] shadow-sm dark:bg-gray-900 dark:text-sky-200">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-gray-950 dark:text-white">{item.title}</span>
                        <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">{item.detail}</span>
                        <span className="mt-2 block text-[11px] font-black uppercase text-gray-400">{formatProfileTime(item.time)}</span>
                      </span>
                    </div>
                  );

                  if (item.action) {
                    return <button key={item.id} type="button" onClick={item.action} className="block w-full">{content}</button>;
                  }
                  if (item.href) {
                    return <Link key={item.id} to={item.href} className="block">{content}</Link>;
                  }
                  return <div key={item.id}>{content}</div>;
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
            <h2 className="text-lg font-black text-gray-950 dark:text-white">Activity</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/25">
                <p className="text-sm font-black text-blue-900 dark:text-blue-100">{storyItems.length} active My Day posts</p>
                <p className="mt-1 text-xs font-semibold text-blue-700/75 dark:text-blue-200/75">Stories, reactions, replies, and viewers stay connected to Messenger.</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950">
                <p className="text-sm font-black text-gray-950 dark:text-white">{groups.length} joined workspaces</p>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{createdGroups.length} owned by you.</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950">
                <p className="text-sm font-black text-gray-950 dark:text-white">Rank progress</p>
                <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{rankStats?.xp || 0} XP and {rankStats?.completedTasks || 0} completed tasks.</p>
              </div>
            </div>
          </aside>
        </section>
      )}

      {(activeProfileTab === 'posts' || activeProfileTab === 'ranks') && (
      <>
      <div className="mobile-metric-strip grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label="Workspaces" value={groups.length} helper="Spaces you can access" />
        <StatCard icon={TrendingUp} label="Total Members" value={totalMembers} helper="Across your joined workspaces" />
        <StatCard icon={Award} label="Created by You" value={createdGroups.length} helper="Workspaces you own" />
        <StatCard icon={Trophy} label="Completed Tasks" value={rankStats?.completedTasks || 0} helper={`${rankStats?.xp || 0} career XP`} />
        <StatCard icon={Trophy} label="Arena High Score" value={gameStats?.highScore || 0} helper={`${gameStats?.totalPlays || 0} ranked runs`} />
      </div>

      {activeProfileTab === 'ranks' && (
        <section className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-950 dark:text-white">Achievement Badges</h2>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{unlockedAchievements} of {achievementBadges.length} unlocked from profile, workspace, My Day, tasks, and arena progress.</p>
            </div>
            <Award className="text-[#1877f2]" size={24} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {achievementBadges.map(badge => {
              const Icon = badge.icon;
              return (
                <div key={badge.id} className={`rounded-2xl border p-4 ${badge.unlocked ? 'border-blue-100 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/25' : 'border-gray-100 bg-gray-50 opacity-75 dark:border-gray-800 dark:bg-gray-950'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${badge.unlocked ? 'bg-[#0b57d0] text-white' : 'bg-white text-gray-400 dark:bg-gray-900'}`}>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-gray-950 dark:text-white">{badge.title}</span>
                      <span className="mt-1 block text-xs font-semibold leading-5 text-gray-500 dark:text-gray-400">{badge.helper}</span>
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${badge.unlocked ? 'bg-white text-[#0b57d0] dark:bg-gray-950 dark:text-sky-200' : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {badge.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-gray-950">
                    <div className={`h-full rounded-full ${badge.unlocked ? 'bg-[#0b57d0]' : 'bg-gray-300 dark:bg-gray-700'}`} style={{ width: `${Math.max(4, Math.min(100, badge.progress || 0))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
      </>
      )}

      {activeProfileTab === 'groups' && (
        <section className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-950 dark:text-white">Workspaces</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your joined workspaces, styled like a profile community tab.</p>
            </div>
            <Link
              to="/groups"
              className="inline-flex items-center justify-center rounded-xl bg-[#1877f2] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0f63d5]"
            >
              View all
            </Link>
          </div>
          {groups.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map(group => {
                const groupId = getEntityId(group);
                const isOwner = getEntityId(group.creator) === getEntityId(user);
                return (
                  <Link
                    key={groupId}
                    to={`/group/${groupId}`}
                    className="group rounded-2xl border border-gray-100 bg-gray-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-lg hover:shadow-blue-500/10 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-900/60 dark:hover:bg-gray-950"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-base font-black text-white">
                        {(group.name || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-black text-gray-950 dark:text-white">{group.name || 'Untitled group'}</h3>
                          {isOwner && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-black text-[#1877f2] dark:bg-blue-950/40 dark:text-sky-200">Owner</span>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{group.description || 'No description yet.'}</p>
                        <p className="mt-3 text-xs font-black uppercase text-gray-400">{group.members?.length || 0} members</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-950/50">
              <Users className="mx-auto text-[#1877f2]" size={34} />
              <p className="mt-3 font-black text-gray-950 dark:text-white">No workspaces yet</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Joined workspaces will appear here.</p>
            </div>
          )}
        </section>
      )}

      {activeProfileTab === 'about' && (
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
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950 md:col-span-2">
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
              {!mobileLightOnly && (
                <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <span className="inline-flex items-center gap-2"><Palette size={17} /> Appearance</span>
                  <span>{currentTheme?.label || 'Theme'}</span>
                </button>
              )}
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
      )}

      {activeProfileTab === 'settings' && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#1877f2] dark:bg-blue-950/30 dark:text-sky-200">
                <Settings size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-950 dark:text-white">Privacy & Preferences</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Quick controls for profile, My Day, and app behavior.</p>
              </div>
            </div>

            <div className="grid gap-3">
              <label className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <span className="mb-2 flex items-center gap-2 text-sm font-black text-gray-950 dark:text-white">
                  <Globe2 size={17} className="text-[#1877f2]" />
                  Profile visibility
                </span>
                <select value={profilePrivacy} onChange={event => setProfilePrivacy(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  <option value="friends">Friends can view full profile</option>
                  <option value="public">Everyone in SYNCROVA</option>
                  <option value="private">Only me</option>
                </select>
              </label>

              {[
                {
                  icon: Smartphone,
                  title: 'Show active status',
                  helper: 'Let friends know when you are active.',
                  value: showOnlineStatus,
                  setValue: setShowOnlineStatus
                },
                {
                  icon: Bell,
                  title: 'My Day activity alerts',
                  helper: 'Keep story viewers, reactions, and replies prominent.',
                  value: notifyStoryActivity,
                  setValue: setNotifyStoryActivity
                }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => item.setValue(value => !value)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-blue-900/60 dark:hover:bg-blue-950/20"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#1877f2] dark:bg-gray-900 dark:text-sky-200">
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-gray-950 dark:text-white">{item.title}</span>
                        <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">{item.helper}</span>
                      </span>
                    </span>
                    <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${item.value ? 'bg-[#1877f2]' : 'bg-gray-300 dark:bg-gray-700'}`}>
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${item.value ? 'left-6' : 'left-1'}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
              <h3 className="font-black text-gray-950 dark:text-white">Mobile app</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">SYNCROVA checks for Android updates automatically after the app opens.</p>
              <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
                Current build target: 3.1.1
              </div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white p-5 shadow-lg shadow-gray-200/60 dark:border-gray-700/60 dark:bg-gray-900 dark:shadow-black/10">
              <h3 className="font-black text-gray-950 dark:text-white">Saved locally</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">These preferences are stored on this device so the app feels consistent between sessions.</p>
            </div>
          </aside>
        </section>
      )}

      <StoryViewer
        story={activeStory}
        stories={activeStoryList}
        currentUser={user}
        onClose={() => setActiveStory(null)}
        onNavigate={openStory}
        onReact={reactToStory}
        onComment={commentOnStory}
        onDelete={deleteStory}
      />
    </div>
  );
}

