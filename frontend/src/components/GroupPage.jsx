import React, { useState, useEffect, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import GroupChat from './GroupChat';
import { 
  FileText, CheckCircle, Upload, Heart, MessageCircle, Send, 
  PlusCircle, Smile, Users, Image as ImageIcon, X, Clock, Trash2, 
  ThumbsUp, Frown, Meh, Angry, Laugh, Heart as HeartIcon, Video,
  Calendar, Flag, User as UserIcon, Filter, SortAsc, MessageSquare, Activity, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import { PostSkeleton } from './SkeletonLoader';
import GroupMembers from './GroupMembers';
import { formatDistanceToNow, format } from 'date-fns';

const getUserInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

// Reaction Picker (unchanged)
const ReactionPicker = ({ onSelect, onClose }) => {
  const reactions = [
    { emoji: '👍', label: 'Like' }, { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Haha' }, { emoji: '😮', label: 'Wow' },
    { emoji: '😢', label: 'Sad' }, { emoji: '😡', label: 'Angry' }
  ];
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="absolute bottom-8 left-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-2 flex gap-2 z-30 border border-gray-200 dark:border-gray-700"
    >
      {reactions.map(r => (
        <button key={r.emoji} onClick={() => onSelect(r.emoji)} className="text-2xl hover:scale-125 transition-transform p-1" title={r.label}>
          {r.emoji}
        </button>
      ))}
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
    </motion.div>
  );
};

// Post Card component (unchanged, fully working)
const PostCard = memo(({ post, currentUserId, groupCreatorId, user, onLike, onReact, onComment, onDelete }) => {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const userLiked = post.likes?.includes(currentUserId);
  const reactions = post.reactions || [];
  const comments = post.comments || [];
  const isCreator = post.userId?._id === currentUserId || groupCreatorId === currentUserId;
  const isVideo = post.fileUrl && post.fileUrl.match(/\.(mp4|webm|mov|avi)$/i);
  const isImage = post.fileUrl && post.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${post._id}`);
      toast.success('Post deleted');
      onDelete(post._id);
    } catch (err) { toast.error('Failed to delete post'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, boxShadow: '0 20px 30px -12px rgba(0,0,0,0.15)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg mb-6 overflow-hidden border border-gray-100 dark:border-gray-700"
    >
      <div className="h-1 bg-gradient-to-r from-pink-500 to-purple-600"></div>
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-md">
              {post.userId?.avatar ? <img src={post.userId.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-semibold text-sm">{getUserInitial(post.userId?.name)}</span>}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{post.userId?.name || 'Unknown'}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500"><Clock size={12} /><span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span></div>
            </div>
          </div>
          {isCreator && (
            <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)} className="text-gray-400 hover:text-red-500 transition"><Trash2 size={18} /></button>
          )}
          {showDeleteConfirm && (
            <div className="absolute right-12 mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 z-20 border">
              <button onClick={handleDelete} className="text-red-500 text-sm px-3 py-1 hover:bg-red-50 rounded">Delete</button>
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{post.title}</h3>
        <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap text-base">{post.content}</p>
        {post.fileUrl && (
          <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {isImage && <img src={post.fileUrl} alt="attachment" className="max-h-96 w-full object-contain" />}
            {isVideo && <video controls className="max-h-96 w-full"><source src={post.fileUrl} type="video/mp4" /></video>}
            {!isImage && !isVideo && <a href={post.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 text-pink-500 hover:underline">📎 {post.fileUrl.split('/').pop()}</a>}
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            {reactions.length > 0 ? (
              <div className="flex items-center gap-0.5">
                {reactions.slice(0, 3).map((r, i) => <span key={i} className="text-base">{r.emoji}</span>)}
                {reactions.length > 3 && <span className="text-xs text-gray-500">+{reactions.length - 3}</span>}
              </div>
            ) : <span className="text-gray-400">Be the first to react</span>}
          </div>
          <button onClick={() => setShowComments(!showComments)} className="text-gray-500 hover:text-pink-500 transition">{comments.length} Comments</button>
        </div>
        <div className="mt-2 flex items-center justify-around">
          <button onClick={() => onLike(post._id)} className={`flex items-center gap-2 py-1.5 px-4 rounded-lg transition ${userLiked ? 'text-pink-500' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <Heart size={18} fill={userLiked ? '#ec4899' : 'none'} /> Like
          </button>
          <div className="relative">
            <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="flex items-center gap-2 py-1.5 px-4 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              <Smile size={18} /> React
            </button>
            {showReactionPicker && <ReactionPicker onSelect={(emoji) => { onReact(post._id, emoji); setShowReactionPicker(false); }} onClose={() => setShowReactionPicker(false)} />}
          </div>
          <button onClick={() => { setShowComments(true); setTimeout(() => document.getElementById(`comment-${post._id}`)?.focus(), 100); }} className="flex items-center gap-2 py-1.5 px-4 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <MessageCircle size={18} /> Comment
          </button>
        </div>
        <AnimatePresence>
          {showComments && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {comments.map((c, idx) => (
                  <div key={idx} className="flex gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                      {c.userId?.avatar ? <img src={c.userId.avatar} alt="" className="w-full h-full object-cover" /> : getUserInitial(c.userId?.name)}
                    </div>
                    <div><span className="font-semibold text-gray-900 dark:text-white">{c.userId?.name}</span><span className="text-gray-700 dark:text-gray-300 ml-2">{c.text}</span></div>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input id={`comment-${post._id}`} type="text" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Write a comment..." className="flex-1 p-2 rounded-full border dark:bg-gray-800 text-sm focus:ring-2 focus:ring-pink-500 outline-none" />
                  <button onClick={() => { if (commentText.trim()) { onComment(post._id, commentText); setCommentText(''); } }} className="bg-pink-500 text-white px-4 py-1 rounded-full text-sm hover:bg-pink-600 transition">Post</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// Main GroupPage
export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [newPostPreview, setNewPostPreview] = useState(null);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskSort, setTaskSort] = useState('dueDate');
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  useEffect(() => {
    fetchGroupData();
    fetchGroupMembers();
  }, [id]);

  const fetchGroupData = async () => {
    setLoading(true); setLoadingPosts(true);
    try {
      const [groupRes, postsRes, tasksRes, filesRes] = await Promise.all([
        api.get(`/groups/${id}`), api.get(`/posts/group/${id}`),
        api.get(`/tasks/group/${id}`), api.get(`/files/group/${id}`)
      ]);
      setGroup(groupRes.data); setPosts(postsRes.data); setTasks(tasksRes.data); setFiles(filesRes.data);
    } catch (err) { console.error(err); toast.error('Failed to load group data'); navigate('/dashboard');
    } finally { setLoading(false); setLoadingPosts(false); }
  };

  const fetchGroupMembers = async () => {
    try {
      const res = await api.get(`/groups/${id}/members`);
      setGroupMembers(res.data);
    } catch (err) { console.error(err); }
  };

  // Posts handlers
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;
    let fileUrl = null;
    try {
      if (newPostMedia) {
        const formData = new FormData(); formData.append('file', newPostMedia);
        const uploadRes = await api.post(`/files/upload/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        fileUrl = `/uploads/${uploadRes.data.filename}`; // ✅ relative path instead of localhost
      }
      await api.post('/posts', { groupId: id, title: newPostTitle, content: newPostContent, fileUrl });
      toast.success('Post created');
      setNewPostTitle(''); setNewPostContent(''); setNewPostMedia(null); setNewPostPreview(null); setShowCreatePost(false);
      const res = await api.get(`/posts/group/${id}`);
      setPosts(res.data);
    } catch (err) { toast.error('Failed to create post'); }
  };
  const handleLike = async (postId) => {
    try { const res = await api.put(`/posts/${postId}/like`); setPosts(posts.map(p => p._id === postId ? res.data : p)); } catch (err) { toast.error('Failed to like'); }
  };
  const handleReact = async (postId, emoji) => {
    try { const res = await api.post(`/posts/${postId}/react`, { emoji }); setPosts(posts.map(p => p._id === postId ? res.data : p)); } catch (err) { toast.error('Failed to add reaction'); }
  };
  const handleComment = async (postId, text) => {
    try { const res = await api.post(`/posts/${postId}/comment`, { text }); setPosts(posts.map(p => p._id === postId ? res.data : p)); } catch (err) { toast.error('Failed to comment'); }
  };
  const handleDeletePost = (postId) => setPosts(posts.filter(p => p._id !== postId));

  // Tasks handlers (enhanced)
  const handleCreateTask = async () => {
    if (!newTaskDesc.trim()) return;
    try {
      const payload = { groupId: id, description: newTaskDesc, dueDate: newTaskDueDate || null, priority: newTaskPriority, assignedTo: newTaskAssignedTo || null };
      const res = await api.post('/tasks', payload);
      setTasks(prev => [res.data, ...prev]);
      setNewTaskDesc(''); setNewTaskDueDate(''); setNewTaskPriority('medium'); setNewTaskAssignedTo(''); setShowCreateTask(false);
      toast.success('Task added');
    } catch (err) { toast.error('Failed to add task'); }
  };
  const handleUpdateTask = async (taskId, updates) => {
    try {
      const res = await api.put(`/tasks/${taskId}`, updates);
      setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
      toast.success('Task updated');
    } catch (err) {
      console.error(err);
      toast.error('Update failed');
    }
  };
  const handleTaskComment = async (taskId, comment) => {
    if (!comment.trim()) return;
    try {
      const res = await api.put(`/tasks/${taskId}`, { comment });
      setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
      toast.success('Comment added');
    } catch (err) {
      toast.error('Failed to add comment');
    }
  };

  // Files handlers
  const handleUploadFile = async () => {
    if (!selectedFile) return;
    const formData = new FormData(); formData.append('file', selectedFile);
    setUploading(true);
    try {
      await api.post(`/files/upload/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('File uploaded'); setSelectedFile(null);
      const res = await api.get(`/files/group/${id}`); setFiles(res.data);
    } catch (err) { toast.error('Upload failed'); } finally { setUploading(false); }
  };

  // Filter & sort tasks
  const filteredTasks = tasks.filter(t => taskFilter === 'all' ? true : t.status === taskFilter);
  const sortedTasks = [...filteredTasks].sort((a,b) => {
    if (taskSort === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1; if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (taskSort === 'priority') {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }
    if (taskSort === 'assignedTo') {
      const aName = a.assignedTo?.name || ''; const bName = b.assignedTo?.name || '';
      return aName.localeCompare(bName);
    }
    return 0;
  });

  if (loading) return <LoadingSpinner />;
  if (!group) return <div className="text-center py-10">Group not found</div>;

  const currentUserId = user?._id;
  const groupCreatorId = group?.creator?._id || group?.creator;
  const tabs = [
    { key: 'posts', label: 'Posts', icon: FileText },
    { key: 'tasks', label: 'Tasks', icon: CheckCircle },
    { key: 'files', label: 'Files', icon: Upload },
    { key: 'members', label: 'Members', icon: Users },
    { key: 'chat', label: 'Group Chat', icon: MessageCircle },  
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Floating header (unchanged) */}
      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{group.description || 'No description'}</p>
        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1"><Users size={16} /> {group.members?.length || 0} members</div>
          <div className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">Code: {group.joinCode}</div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <motion.button key={tab.key} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 capitalize font-medium transition flex items-center gap-1 ${activeTab === tab.key ? 'border-b-2 border-pink-500 text-pink-600 dark:text-pink-400' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={16} /> {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* ========== POSTS TAB ========== */}
      {activeTab === 'posts' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-md">
                {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white font-bold text-sm">{getUserInitial(user?.name)}</span>}
              </div>
              <div className="flex-1">
                <button onClick={() => setShowCreatePost(true)} className="w-full text-left p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                  What's on your mind, {user?.name?.split(' ')[0]}?
                </button>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {showCreatePost && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25 }} className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 overflow-hidden shadow-md">
                      {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-bold">{getUserInitial(user?.name)}</div>}
                    </div>
                    <div><div className="font-semibold text-gray-900 dark:text-white">{user?.name}</div><div className="text-xs text-gray-500 flex items-center gap-1"><span>Posting to</span><span className="font-medium text-pink-500">{group.name}</span></div></div>
                    <button onClick={() => setShowCreatePost(false)} className="ml-auto text-gray-500 hover:text-gray-700"><X size={24} /></button>
                  </div>
                  <input type="text" placeholder="Title" className="w-full p-3 mb-3 rounded-xl border bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-pink-500 outline-none" value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)} />
                  <textarea placeholder="What's on your mind?" rows="4" className="w-full p-3 mb-3 rounded-xl border bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-pink-500 outline-none resize-none" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} />
                  {newPostPreview && (
                    <div className="relative mb-3 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      {newPostMedia?.type?.startsWith('image/') ? <img src={newPostPreview} alt="preview" className="max-h-48 w-auto mx-auto" /> : newPostMedia?.type?.startsWith('video/') && <video controls className="max-h-48 w-auto mx-auto"><source src={newPostPreview} type={newPostMedia.type} /></video>}
                      <button onClick={() => { setNewPostMedia(null); setNewPostPreview(null); }} className="absolute top-2 right-2 bg-black/60 rounded-full p-1"><X size={16} className="text-white" /></button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"><ImageIcon size={18} className="text-green-500" /><span className="text-sm">Photo</span><input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) { setNewPostMedia(f); setNewPostPreview(URL.createObjectURL(f)); } }} /></label>
                      <label className="flex items-center gap-1 cursor-pointer px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"><Video size={18} className="text-blue-500" /><span className="text-sm">Video</span><input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files[0]; if (f) { setNewPostMedia(f); setNewPostPreview(URL.createObjectURL(f)); } }} /></label>
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCreatePost} className="bg-pink-500 text-white px-6 py-2 rounded-full font-semibold shadow-md hover:bg-pink-600 transition">Post</motion.button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          {loadingPosts ? <div className="space-y-4">{[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}</div> : posts.length === 0 ? <EmptyState type="posts" action={() => setShowCreatePost(true)} /> : posts.map(post => <PostCard key={post._id} post={post} currentUserId={currentUserId} groupCreatorId={groupCreatorId} user={user} onLike={handleLike} onReact={handleReact} onComment={handleComment} onDelete={handleDeletePost} />)}
        </div>
      )}

      {/* ========== TASKS TAB ========== */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <button onClick={() => setShowCreateTask(true)} className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-md hover:shadow-lg transition">
              <PlusCircle size={18} /> Add Task
            </button>
            <div className="flex gap-2">
              <div className="relative">
                <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1 pl-8 pr-6 text-sm focus:ring-2 focus:ring-pink-500">
                  <option value="all">All</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
                <Filter size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
              <div className="relative">
                <select value={taskSort} onChange={e => setTaskSort(e.target.value)} className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1 pl-8 pr-6 text-sm focus:ring-2 focus:ring-pink-500">
                  <option value="dueDate">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="assignedTo">Assigned to</option>
                </select>
                <SortAsc size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>
          {/* Create Task Modal */}
          <AnimatePresence>
            {showCreateTask && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Task</h2>
                    <button onClick={() => setShowCreateTask(false)} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Add a new task to your project</p>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TASK TITLE</label>
                        <input type="text" placeholder="Enter task title..." className="input" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">DUE DATE</label>
                        <input type="date" className="input" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ASSIGNEE</label>
                        <select className="input" value={newTaskAssignedTo} onChange={e => setNewTaskAssignedTo(e.target.value)}>
                          <option value="">Unassigned</option>
                          {groupMembers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={`rounded-xl p-4 border-l-4 ${newTaskPriority === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : newTaskPriority === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : 'border-green-500 bg-green-50 dark:bg-green-950/20'}`}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PRIORITY</label>
                        <select className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}>
                          <option value="low">🟢 Low Priority</option>
                          <option value="medium">🟡 Medium Priority</option>
                          <option value="high">🔴 High Priority</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                          {newTaskPriority === 'high' ? 'Urgent – requires immediate attention' : newTaskPriority === 'medium' ? 'Standard priority task' : 'Low priority – can wait'}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">TASK SUMMARY</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Due date</span><span className="font-medium">{newTaskDueDate ? newTaskDueDate : 'Not set'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Assignee</span><span className="font-medium">{groupMembers.find(m => m._id === newTaskAssignedTo)?.name || 'Unassigned'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className={`font-medium ${newTaskPriority === 'high' ? 'text-red-600' : newTaskPriority === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>{newTaskPriority.charAt(0).toUpperCase() + newTaskPriority.slice(1)} Priority</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setShowCreateTask(false)} className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition">Cancel</button>
                    <button onClick={handleCreateTask} className="px-6 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold shadow-md hover:shadow-lg transition">Create Task</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          {/* Task List */}
          {sortedTasks.length === 0 ? (
            <EmptyState type="tasks" />
          ) : (
            <div className="space-y-3">
              {sortedTasks.map(task => {
                const isExpanded = expandedTaskId === task._id;
                const priorityColors = { low: 'text-green-500 bg-green-100 dark:bg-green-900/30', medium: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30', high: 'text-red-500 bg-red-100 dark:bg-red-900/30' };
                const statusColors = { not_started: 'bg-gray-200 dark:bg-gray-700', in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
                const dueDateStatus = task.dueDate && new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-gray-500';
                return (
                  <motion.div key={task._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3 flex-1">
                        <input type="checkbox" checked={task.status === 'done'} onChange={() => handleUpdateTask(task._id, { status: task.status === 'done' ? 'not_started' : 'done' })} className="accent-pink-500 w-5 h-5" />
                        <span className={`font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{task.description}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.priority]}`}>{task.priority}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>{task.status.replace('_', ' ')}</span>
                        {task.dueDate && <span className={`text-xs flex items-center gap-1 ${dueDateStatus}`}><Calendar size={12} /> {format(new Date(task.dueDate), 'MMM dd')}</span>}
                        {task.assignedTo && <span className="text-xs flex items-center gap-1"><UserIcon size={12} /> {task.assignedTo.name}</span>}
                        <button onClick={() => setExpandedTaskId(isExpanded ? null : task._id)} className="text-gray-400 hover:text-pink-500"><ChevronDown size={18} className={`transform transition ${isExpanded ? 'rotate-180' : ''}`} /></button>
                      </div>
                    </div>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3 bg-gray-50 dark:bg-gray-800/50">
                          <div className="flex flex-wrap gap-3">
                            <select value={task.status} onChange={e => handleUpdateTask(task._id, { status: e.target.value })} className="text-xs rounded-full border dark:bg-gray-800 px-2 py-1">
                              <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="done">Done</option>
                            </select>
                            <select value={task.priority} onChange={e => handleUpdateTask(task._id, { priority: e.target.value })} className="text-xs rounded-full border dark:bg-gray-800 px-2 py-1">
                              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                            </select>
                            <input type="date" value={task.dueDate ? task.dueDate.split('T')[0] : ''} onChange={e => handleUpdateTask(task._id, { dueDate: e.target.value || null })} className="text-xs rounded-full border dark:bg-gray-800 px-2 py-1" />
                            <select value={task.assignedTo?._id || ''} onChange={e => handleUpdateTask(task._id, { assignedTo: e.target.value || null })} className="text-xs rounded-full border dark:bg-gray-800 px-2 py-1">
                              <option value="">Unassigned</option>
                              {groupMembers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                            </select>
                          </div>
                          <div><h4 className="text-sm font-semibold flex items-center gap-1"><MessageSquare size={14} /> Comments</h4>
                            <div className="space-y-1 mt-1 max-h-32 overflow-y-auto">
                              {task.comments?.map((c, i) => <div key={i} className="text-xs"><span className="font-semibold">{c.userId?.name}</span> {c.text}</div>)}
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); const input = e.target.comment.value; if (input) { handleTaskComment(task._id, input); e.target.comment.value = ''; } }} className="flex gap-1 mt-1">
                              <input name="comment" type="text" placeholder="Add a comment..." className="flex-1 text-xs rounded-full border dark:bg-gray-800 px-2 py-1" />
                              <button type="submit" className="text-xs bg-pink-500 text-white px-2 py-1 rounded-full">Post</button>
                            </form>
                          </div>
                          {task.activity?.length > 0 && <div><h4 className="text-sm font-semibold flex items-center gap-1"><Activity size={14} /> Activity</h4><div className="space-y-1 mt-1 max-h-24 overflow-y-auto text-xs text-gray-500">{task.activity.map((act, i) => <div key={i}>• {act.userId?.name} {act.action} {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}</div>)}</div></div>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== FILES TAB ========== */}
      {activeTab === 'files' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex gap-2 mb-4"><input type="file" onChange={e => setSelectedFile(e.target.files[0])} className="flex-1" /><button onClick={handleUploadFile} disabled={uploading} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload'}</button></div>
          {files.length === 0 ? <EmptyState type="files" /> : (
            <ul className="space-y-2">
              {files.map(file => (<li key={file._id} className="flex justify-between p-2 border-b"><span>{file.originalName}</span><a href={`/uploads/${file.filename}`} download className="text-pink-500 hover:underline">Download</a></li>))}
            </ul>
          )}
        </div>
      )}

      {/* ========== MEMBERS TAB ========== */}
      {activeTab === 'members' && <GroupMembers groupId={id} />}
      {activeTab === 'chat' && <GroupChat groupId={id} />}
    </div>
  );
}