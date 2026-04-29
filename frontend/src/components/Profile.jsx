import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  User, Users, Calendar, Shield, LogOut, Moon, Sun, TrendingUp, 
  Heart, Activity, Camera, Save, Edit2, Award, Sparkles, Crown,
  Mail, BookOpen, MapPin, Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

export default function Profile() {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [groupsCreated, setGroupsCreated] = useState(0);
  const [totalMembers, setTotalMembers] = useState(0);
  const [memberSince, setMemberSince] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setCourse(user.course || '');
    setBio(user.bio || '');
    setAvatar(user.avatar || '');
    fetchGroups();
    if (user.createdAt) {
      const date = new Date(user.createdAt);
      setMemberSince(date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }));
    } else {
      setMemberSince('January 2025');
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      const res = await api.get('/groups');
      const groups = res.data;
      const created = groups.filter(g => g.creator === user?._id || g.creator?._id === user?._id).length;
      const totalMem = groups.reduce((sum, g) => sum + (g.members?.length || 0), 0);
      setGroupsCreated(created);
      setTotalMembers(totalMem);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const res = await api.put('/users/profile', { name, course, bio });
      login(localStorage.getItem('token'), res.data);
      toast.success('Profile updated');
      setEditing(false);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    setUploading(true);
    try {
      const res = await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAvatar(res.data.avatar);
      const updatedUser = { ...user, avatar: res.data.avatar };
      login(localStorage.getItem('token'), updatedUser);
      toast.success('Avatar updated');
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const stats = [
    { icon: Users, label: 'Groups Created', value: groupsCreated, color: 'from-pink-500 to-rose-500' },
    { icon: TrendingUp, label: 'Total Members', value: totalMembers, color: 'from-purple-500 to-indigo-500' },
    { icon: Calendar, label: 'Member Since', value: memberSince.split(' ')[0], color: 'from-amber-500 to-orange-500' },
  ];

  const achievements = [
    { name: 'Group Starter', achieved: groupsCreated >= 1, requirement: 'Create 1 group', icon: Sparkles },
    { name: 'Community Builder', achieved: groupsCreated >= 3, requirement: 'Create 3 groups', icon: Users },
    { name: 'Influencer', achieved: totalMembers >= 20, requirement: 'Reach 20 members', icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Cover Image Area (fills the top gap) */}
      <div className="relative h-48 md:h-56 w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-b-3xl shadow-lg">
        {/* Optional pattern overlay */}
        <div className="absolute inset-0 bg-black/10 rounded-b-3xl"></div>
      </div>

      {/* Profile Content Container */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 -mt-20 md:-mt-24 relative z-10">
        {/* Avatar - overlapping cover */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-white dark:bg-gray-800 blur-lg opacity-40"></div>
            <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden bg-gradient-to-r from-pink-500 to-purple-600">
              {avatar ? (
                <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                  <User size={48} className="text-gray-500 dark:text-gray-400" />
                </div>
              )}
            </div>
            <label className="absolute bottom-1 right-1 bg-pink-500 p-1.5 rounded-full cursor-pointer shadow-lg hover:bg-pink-600 transition active:scale-95 border-2 border-white dark:border-gray-800">
              <Camera size={14} className="text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
            {uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full text-white text-xs">Up...</div>}
          </div>
        </div>

        {/* User Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8 mb-8">
          {editing ? (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course / Program</label>
                <input type="text" value={course} onChange={e => setCourse(e.target.value)} className="input text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows="3" className="textarea text-base" placeholder="Tell us about yourself..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={handleUpdateProfile} className="btn-primary">Save Changes</button>
                <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm"><Mail size={14} /> {user.email}</span>
                {user.course && <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm"><BookOpen size={14} /> {user.course}</span>}
              </div>
              {bio && (
                <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto md:mx-0">{bio}</p>
              )}
              <button onClick={() => setEditing(true)} className="mt-4 inline-flex items-center gap-1 text-pink-500 hover:text-pink-600 text-sm transition">
                <Edit2 size={14} /> Edit profile
              </button>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700 text-center"
              >
                <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-md mb-3">
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Two Column Section: Achievements & Activity */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Award size={20} className="text-pink-500" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Achievements</h3>
            </div>
            <div className="space-y-3">
              {achievements.map((ach, i) => {
                const Icon = ach.icon;
                return (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${ach.achieved ? 'bg-pink-50 dark:bg-pink-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={ach.achieved ? 'text-pink-500' : 'text-gray-400'} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{ach.name}</p>
                        <p className="text-xs text-gray-500">{ach.requirement}</p>
                      </div>
                    </div>
                    {ach.achieved && <Sparkles size={16} className="text-yellow-500" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={20} className="text-pink-500" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <Users size={16} /> <span>Joined {groupsCreated} group{groupsCreated !== 1 && 's'}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <Heart size={16} /> <span>Connected with {totalMembers} members total</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                <Calendar size={16} /> <span>Member since {memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account Settings Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-pink-500" />
            <span className="font-medium text-gray-900 dark:text-white">Account Settings</span>
          </div>
          <div className="flex gap-3">
            <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition text-gray-800 dark:text-gray-200">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/40 transition">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}