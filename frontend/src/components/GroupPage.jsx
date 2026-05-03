import React, { useEffect, useMemo, useState, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertCircle,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  Circle,
  Columns3,
  Clock,
  Copy,
  Download,
  Eye,
  File as FileIcon,
  FileText,
  Filter,
  Flag,
  Images,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Pin,
  PinOff,
  PlusCircle,
  Search,
  Send,
  Settings,
  Share2,
  Smile,
  SortAsc,
  Tag,
  Trash2,
  Upload,
  User as UserIcon,
  UserPlus,
  Users,
  Video,
  X
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import GroupChat from './GroupChat';
import GroupMembers from './GroupMembers';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import UserProfileModal from './UserProfileModal';
import { PostSkeleton } from './SkeletonLoader';
import MediaViewer from './MediaViewer';
import VideoThumbnail from './VideoThumbnail';
import { optimizeImageFile, resolveMediaUrl } from '../utils/media';
import { getSocket } from '../services/socket';
import { playUiSound } from '../utils/sound';

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
const BLOCKED_UPLOAD_EXTENSIONS = ['bat', 'cmd', 'com', 'exe', 'msi', 'ps1', 'scr', 'sh'];

const normalizeId = (value) => String(value?._id || value?.id || value || '');
const getUserInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');
const getFirstName = (name = '') => name.trim().split(/\s+/)[0] || 'there';

const statusLabels = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done'
};

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

const approvalLabels = {
  not_required: 'No approval',
  pending: 'Needs approval',
  approved: 'Approved',
  changes_requested: 'Needs changes'
};

const statusStyles = {
  not_started: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
};

const priorityStyles = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  high: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
};

const approvalStyles = {
  not_required: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-300',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  changes_requested: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
};

const priorityOrder = { high: 0, medium: 1, low: 2 };

const roleLabels = {
  creator: 'Owner',
  'co-creator': 'Admin',
  member: 'Member'
};

const sectionRoutes = {
  overview: '',
  posts: 'posts',
  files: 'files',
  memories: 'assets',
  activity: 'updates',
  members: 'members',
  chat: 'chat',
  settings: 'settings'
};

const routeToSection = {
  overview: 'overview',
  posts: 'posts',
  announcements: 'posts',
  calendar: 'overview',
  tasks: 'overview',
  files: 'files',
  assets: 'memories',
  media: 'memories',
  memories: 'memories',
  'media-vault': 'memories',
  activity: 'activity',
  updates: 'activity',
  members: 'members',
  chat: 'chat',
  'team-chat': 'chat',
  settings: 'settings'
};

const parseLabels = (value = '') => [...new Set(value
  .split(',')
  .map(label => label.trim())
  .filter(Boolean))]
  .slice(0, 6);

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value, fallback = 'No date') => {
  const date = safeDate(value);
  return date ? format(date, 'MMM dd, yyyy') : fallback;
};

const formatRelativeDate = (value) => {
  const date = safeDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : 'just now';
};

const renderMentionText = (text = '') => {
  const parts = String(text).split(/(@[a-zA-Z0-9._-]+(?:\s+[a-zA-Z0-9._-]+)?)/g);
  return parts.map((part, index) => (
    part.startsWith('@') ? (
      <span key={`${part}-${index}`} className="font-semibold text-pink-600 dark:text-pink-300">{part}</span>
    ) : part
  ));
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const getFileName = (value = '') => {
  try {
    const cleanValue = value.split('?')[0];
    return decodeURIComponent(cleanValue.split('/').pop() || 'Attachment');
  } catch {
    return value.split('/').pop() || 'Attachment';
  }
};

const getFileExtension = (name = '') => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const getFileKind = (file = {}) => {
  const mimeType = file.mimeType || file.type || '';
  const name = file.originalName || file.name || file.filename || '';
  const ext = getFileExtension(name);

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv'].includes(ext)) return 'document';
  if (['zip', 'rar', '7z'].includes(ext)) return 'archive';
  return 'other';
};

const getStoredFileUrl = (file = {}) => resolveMediaUrl(file.url || file.fileUrl || `/uploads/${file.filename}`);

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const getTaskDateBounds = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 5);
  return {
    min: toDateInputValue(today),
    max: toDateInputValue(maxDate),
    today,
    maxDate
  };
};

const validateTaskDueDate = (value) => {
  if (!value) return true;
  const date = parseDateInputValue(value);
  const { today, maxDate } = getTaskDateBounds();

  if (!date) {
    toast.error('Please choose a real due date');
    return false;
  }

  if (date < today) {
    toast.error('Due date cannot be in the past');
    return false;
  }

  if (date > maxDate) {
    toast.error('Due date cannot be more than 5 years ahead');
    return false;
  }

  return true;
};

const getShareFileType = (fileUrl = '') => {
  if (!fileUrl) return '';
  const kind = getFileKind({ filename: getFileName(fileUrl) });
  if (kind === 'image' || kind === 'video' || kind === 'audio') return kind;
  return 'file';
};

const isTaskOverdue = (task) => {
  if (!task?.dueDate || task.status === 'done') return false;
  const dueDate = safeDate(task.dueDate);
  if (!dueDate) return false;
  dueDate.setHours(23, 59, 59, 999);
  return dueDate < new Date();
};

const getTaskStatusIcon = (status) => {
  if (status === 'done') return CheckCircle;
  if (status === 'in_progress') return Clock;
  return Circle;
};

const validateUploadFile = (file) => {
  if (!file) return false;

  if (file.size > MAX_UPLOAD_SIZE) {
    toast.error('Maximum file size is 25MB');
    return false;
  }

  const extension = getFileExtension(file.name);
  if (BLOCKED_UPLOAD_EXTENSIONS.includes(extension)) {
    toast.error('This file type is not allowed');
    return false;
  }

  return true;
};

const Avatar = ({ person, size = 'md', onClick }) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };
  const content = person?.avatar ? (
    <img src={resolveMediaUrl(person.avatar)} alt="" className="h-full w-full object-cover" />
  ) : (
    getUserInitial(person?.name)
  );

  if (onClick && person) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick(person);
        }}
        className={`${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 font-semibold text-white shadow-sm ring-2 ring-transparent transition hover:ring-pink-300 dark:bg-gray-700`}
        title={`View ${person?.name || 'profile'}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 font-semibold text-white shadow-sm dark:bg-gray-700`}>
      {content}
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, tone = 'gray' }) => {
  const tones = {
    gray: 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white',
    blue: 'border-pink-200 bg-pink-50 text-pink-900 dark:border-pink-900 dark:bg-pink-950/30 dark:text-pink-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <Icon size={22} className="shrink-0 text-gray-400" />
      </div>
    </div>
  );
};

const ReactionPicker = ({ onSelect, onClose }) => {
  const reactions = [
    { emoji: '\u{1F44D}', label: 'Like' },
    { emoji: '\u2764\uFE0F', label: 'Love' },
    { emoji: '\u{1F602}', label: 'Haha' },
    { emoji: '\u{1F62E}', label: 'Wow' },
    { emoji: '\u{1F622}', label: 'Sad' },
    { emoji: '\u{1F621}', label: 'Angry' }
  ];

  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0, y: 6 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.94, opacity: 0, y: 6 }}
      className="absolute bottom-11 left-0 z-30 flex gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      {reactions.map(reaction => (
        <button
          key={reaction.label}
          type="button"
          onClick={() => onSelect(reaction.emoji)}
          title={reaction.label}
          className="rounded-lg p-1.5 text-xl transition hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          {reaction.emoji}
        </button>
      ))}
      <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
        <X size={16} />
      </button>
    </motion.div>
  );
};

const PostAttachment = ({ fileUrl, onOpen }) => {
  if (!fileUrl) return null;

  const mediaUrl = resolveMediaUrl(fileUrl);
  const fileName = getFileName(fileUrl);
  const kind = getFileKind({ filename: fileName });

  if (kind === 'image') {
    return (
      <button type="button" onClick={onOpen} className="mt-4 block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left dark:border-gray-700 dark:bg-gray-900">
        <img src={mediaUrl} alt={fileName} className="max-h-[420px] w-full object-contain" />
      </button>
    );
  }

  if (kind === 'video') {
    return (
      <button type="button" onClick={onOpen} className="mt-4 block w-full overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-700">
        <video muted className="max-h-[420px] w-full">
          <source src={mediaUrl} />
        </video>
      </button>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm transition hover:border-pink-300 hover:bg-pink-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-800 dark:hover:bg-pink-950/20"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-pink-600 shadow-sm dark:bg-gray-800">
          <Paperclip size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-gray-900 dark:text-white">{fileName}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Attached file</span>
        </span>
      </span>
      <Eye size={16} className="shrink-0 text-gray-400" />
    </a>
  );
};

const PostCard = memo(({ post, currentUserId, canModerate, onReact, onComment, onDelete, onShare, onSave, onPin, onOpenMedia, onUserClick }) => {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReactionDetails, setShowReactionDetails] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const authorId = normalizeId(post.userId);
  const comments = post.comments || [];
  const reactions = post.reactions || [];
  const canDelete = canModerate || authorId === currentUserId;
  const isSaved = (post.savedBy || []).some(userId => normalizeId(userId) === currentUserId);

  const reactionSummary = Object.entries(
    reactions.reduce((summary, reaction) => {
      if (!reaction?.emoji) return summary;
      summary[reaction.emoji] = (summary[reaction.emoji] || 0) + 1;
      return summary;
    }, {})
  ).slice(0, 4);

  const submitComment = async (event) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text || commenting) return;

    setCommenting(true);
    try {
      await onComment(post._id, text);
      setCommentText('');
      setShowComments(true);
    } catch (err) {
      console.error(err);
    } finally {
      setCommenting(false);
    }
  };

  const deletePost = async () => {
    if (!window.confirm('Delete this announcement?')) return;

    setDeleting(true);
    try {
      await onDelete(post._id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar person={post.userId} onClick={onUserClick} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900 dark:text-white">{post.userId?.name || 'Unknown member'}</p>
            <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock size={12} />
              {formatRelativeDate(post.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <Pin size={12} />
              Pinned
            </span>
          )}
          {canModerate && (
            <button
              type="button"
              onClick={() => onPin(post._id)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30"
              title={post.pinned ? 'Unpin announcement' : 'Pin announcement'}
            >
              {post.pinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={deletePost}
              disabled={deleting}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30"
              title="Delete announcement"
            >
              {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="break-words text-xl font-bold text-gray-950 dark:text-white">{post.title}</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-300">{renderMentionText(post.content)}</p>
      </div>

      <PostAttachment fileUrl={post.fileUrl} onOpen={() => onOpenMedia(post.fileUrl)} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
        <button
          type="button"
          onClick={() => reactions.length > 0 && setShowReactionDetails(value => !value)}
          className="flex min-h-6 items-center gap-2 text-left text-gray-500 transition hover:text-pink-600 dark:text-gray-400"
        >
          {reactionSummary.length > 0 ? (
            <>
              <span className="flex items-center -space-x-1">
                {reactionSummary.map(([emoji]) => (
                  <span key={emoji} className="rounded-full bg-white text-base shadow-sm dark:bg-gray-900">{emoji}</span>
                ))}
              </span>
              <span>{reactions.length} reaction{reactions.length === 1 ? '' : 's'}</span>
            </>
          ) : (
            <span>No reactions yet</span>
          )}
        </button>
        <button type="button" onClick={() => setShowComments(value => !value)} className="text-gray-500 transition hover:text-pink-600 dark:text-gray-400">
          {comments.length} comment{comments.length === 1 ? '' : 's'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactionPicker(value => !value)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Smile size={17} />
            React
          </button>
          <AnimatePresence>
            {showReactionPicker && (
              <ReactionPicker
                onSelect={(emoji) => {
                  onReact(post._id, emoji);
                  setShowReactionPicker(false);
                }}
                onClose={() => setShowReactionPicker(false)}
              />
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => setShowComments(true)}
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <MessageCircle size={17} />
          Comment
        </button>

        <button
          type="button"
          onClick={() => onShare(post)}
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Share2 size={17} />
          Share
        </button>

        <button
          type="button"
          onClick={() => onSave(post._id)}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            isSaved
              ? 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showReactionDetails && reactions.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Reactions</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {reactions.map((reaction, index) => (
                  <div key={`${reaction.emoji}-${normalizeId(reaction.userId)}-${index}`} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-gray-900">
                    <span className="text-lg">{reaction.emoji}</span>
                    <Avatar person={reaction.userId} size="sm" onClick={onUserClick} />
                    <span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">{reaction.userId?.name || 'Member'}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">No comments yet.</p>
                ) : (
                  comments.map((comment, index) => (
                    <div key={`${comment._id || index}-${comment.date || comment.createdAt || index}`} className="flex gap-2">
                      <Avatar person={comment.userId} size="sm" onClick={onUserClick} />
                      <div className="min-w-0 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-gray-900 dark:text-white">{comment.userId?.name || 'Member'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeDate(comment.date || comment.createdAt)}</span>
                        </div>
                        <p className="break-words text-sm text-gray-700 dark:text-gray-300">{renderMentionText(comment.text)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={submitComment} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={event => setCommentText(event.target.value)}
                  placeholder="Write a comment... use @Name to mention"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || commenting}
                  className="inline-flex items-center justify-center rounded-lg bg-pink-600 px-3 py-2 text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Post comment"
                >
                  {commenting ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});

PostCard.displayName = 'PostCard';

const TaskCard = memo(({ task, members, isExpanded, isUpdating, canDelete, onToggleExpanded, onUpdate, onComment, onDelete }) => {
  const [commentText, setCommentText] = useState('');
  const [labelText, setLabelText] = useState((task.labels || []).join(', '));
  const StatusIcon = getTaskStatusIcon(task.status);
  const overdue = isTaskOverdue(task);
  const labels = task.labels || [];

  useEffect(() => {
    setLabelText((task.labels || []).join(', '));
  }, [task.labels]);

  const submitComment = async (event) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    try {
      await onComment(task._id, text);
      setCommentText('');
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = () => {
    if (window.confirm('Delete this task?')) onDelete(task._id);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-3">
            <button
              type="button"
              onClick={() => onUpdate(task._id, { status: task.status === 'done' ? 'not_started' : 'done' }).catch(() => {})}
              disabled={isUpdating}
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${task.status === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-gray-400 hover:border-pink-500 hover:text-pink-600 dark:border-gray-600'}`}
              title={task.status === 'done' ? 'Mark as not started' : 'Mark as done'}
            >
              {task.status === 'done' ? <Check size={16} /> : <StatusIcon size={15} />}
            </button>

            <div className="min-w-0">
              <h3 className={`break-words font-semibold ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-950 dark:text-white'}`}>
                {renderMentionText(task.description)}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium ${statusStyles[task.status] || statusStyles.not_started}`}>
                  <StatusIcon size={13} />
                  {statusLabels[task.status] || task.status}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium ${priorityStyles[task.priority] || priorityStyles.medium}`}>
                  <Flag size={13} />
                  {priorityLabels[task.priority] || task.priority}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium ${overdue ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                  <Calendar size={13} />
                  {formatShortDate(task.dueDate)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <UserIcon size={13} />
                  <span className="max-w-[150px] truncate">{task.assignedTo?.name || 'Unassigned'}</span>
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-medium ${approvalStyles[task.approvalStatus] || approvalStyles.not_required}`}>
                  <BadgeCheck size={13} />
                  {approvalLabels[task.approvalStatus] || approvalLabels.not_required}
                </span>
                {task.createdBy?.name && (
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Created by {task.createdBy.name}
                  </span>
                )}
                {labels.map(label => (
                  <span key={label} className="inline-flex items-center gap-1 rounded-full border border-pink-100 bg-pink-50 px-2 py-1 font-medium text-pink-700 dark:border-pink-900/50 dark:bg-pink-950/20 dark:text-pink-200">
                    <Tag size={12} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-start">
            {isUpdating && <Loader2 size={18} className="animate-spin text-pink-600" />}
            {canDelete && (
              <button type="button" onClick={deleteTask} className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" title="Delete task">
                <Trash2 size={17} />
              </button>
            )}
            <button type="button" onClick={onToggleExpanded} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" title="Task details">
              <ChevronDown size={18} className={`transition ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
          >
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Status</span>
                    <select
                      value={task.status}
                      onChange={event => onUpdate(task._id, { status: event.target.value }).catch(() => {})}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Approval</span>
                    <select
                      value={task.approvalStatus || 'not_required'}
                      onChange={event => onUpdate(task._id, { approvalStatus: event.target.value }).catch(() => {})}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    >
                      <option value="not_required">No approval</option>
                      <option value="pending">Needs approval</option>
                      <option value="approved">Approved</option>
                      <option value="changes_requested">Needs changes</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Priority</span>
                    <select
                      value={task.priority}
                      onChange={event => onUpdate(task._id, { priority: event.target.value }).catch(() => {})}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Due date</span>
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                      min={getTaskDateBounds().min}
                      max={getTaskDateBounds().max}
                      onChange={event => onUpdate(task._id, { dueDate: event.target.value || null }).catch(() => {})}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Assignee</span>
                    <select
                      value={normalizeId(task.assignedTo)}
                      onChange={event => onUpdate(task._id, { assignedTo: event.target.value || null }).catch(() => {})}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    >
                      <option value="">Unassigned</option>
                      {members.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}
                    </select>
                  </label>
                </div>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Labels</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={labelText}
                      onChange={event => setLabelText(event.target.value)}
                      onBlur={() => onUpdate(task._id, { labels: parseLabels(labelText) }).catch(() => {})}
                      placeholder="Frontend, Urgent, Review"
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdate(task._id, { labels: parseLabels(labelText) }).catch(() => {})}
                      className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      Save
                    </button>
                  </div>
                </label>

                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <MessageSquare size={15} />
                    Comments
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    {task.comments?.length ? (
                      task.comments.map((comment, index) => (
                        <div key={`${comment._id || index}-${comment.createdAt || index}`} className="text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white">{comment.userId?.name || 'Member'}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeDate(comment.createdAt)}</span>
                          </div>
                          <p className="break-words text-gray-700 dark:text-gray-300">{renderMentionText(comment.text)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet.</p>
                    )}
                  </div>
                  <form onSubmit={submitComment} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={event => setCommentText(event.target.value)}
                      placeholder="Add a task comment... use @Name"
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                    <button
                      type="submit"
                      disabled={!commentText.trim() || isUpdating}
                      className="inline-flex items-center justify-center rounded-lg bg-pink-600 px-3 py-2 text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Add comment"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Activity size={15} />
                  Updates
                </div>
                <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  {task.activity?.length ? (
                    task.activity.slice().reverse().map((entry, index) => (
                      <div key={`${entry._id || index}-${entry.createdAt || index}`} className="text-sm">
                        <p className="text-gray-700 dark:text-gray-300">
                          <span className="font-semibold text-gray-900 dark:text-white">{entry.userId?.name || 'Member'}</span> {entry.action}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeDate(entry.createdAt)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});

TaskCard.displayName = 'TaskCard';

const BoardTaskCard = ({ task, onOpen, onStatusChange }) => {
  const overdue = isTaskOverdue(task);
  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      whileHover={{ y: -2 }}
      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-pink-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-pink-900"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-gray-950 dark:text-white">{renderMentionText(task.description)}</p>
        <select
          value={task.status}
          onClick={event => event.stopPropagation()}
          onChange={event => onStatusChange(task._id, event.target.value)}
          className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          <option value="not_started">To do</option>
          <option value="in_progress">Doing</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${priorityStyles[task.priority] || priorityStyles.medium}`}>
          {priorityLabels[task.priority] || task.priority}
        </span>
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${overdue ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
          {formatShortDate(task.dueDate)}
        </span>
        {(task.labels || []).slice(0, 2).map(label => (
          <span key={label} className="rounded-full bg-pink-50 px-2 py-0.5 font-semibold text-pink-700 dark:bg-pink-950/20 dark:text-pink-200">{label}</span>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{task.assignedTo?.name || 'Unassigned'}</p>
    </motion.div>
  );
};

const FileRow = ({ file, canManage, onDelete, onPreview }) => {
  const [deleting, setDeleting] = useState(false);
  const fileUrl = getStoredFileUrl(file);
  const kind = getFileKind(file);
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Video : kind === 'document' ? FileText : FileIcon;
  const canPreview = ['image', 'video', 'document'].includes(kind);

  const deleteFile = async () => {
    if (!window.confirm('Delete this file?')) return;

    setDeleting(true);
    try {
      await onDelete(file._id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900 dark:text-white">{file.originalName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatBytes(file.size)}</span>
            <span>{file.uploadedBy?.name || 'Unknown uploader'}</span>
            <span>{formatShortDate(file.uploadDate, 'No date')}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
        <button
          type="button"
          onClick={() => (canPreview ? onPreview(file) : window.open(fileUrl, '_blank', 'noopener,noreferrer'))}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Eye size={16} />
          View
        </button>
        <a
          href={fileUrl}
          download={file.originalName}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <Download size={16} />
          Download
        </a>
        {canManage && (
          <button
            type="button"
            onClick={deleteFile}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
        )}
      </div>
    </li>
  );
};

const MemoryCard = ({ memory, currentUserId, canModerate, onDelete, onOpen, onUserClick }) => {
  const [deleting, setDeleting] = useState(false);
  const canDelete = canModerate || normalizeId(memory.userId) === currentUserId;
  const mediaUrl = resolveMediaUrl(memory.fileUrl);

  const deleteMemory = async (event) => {
    event.stopPropagation();
    if (!window.confirm('Delete this memory?')) return;

    setDeleting(true);
    try {
      await onDelete(memory._id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      <button type="button" onClick={() => onOpen(memory)} className="block w-full bg-gray-950 text-left">
        {memory.fileType === 'image' ? (
          <img src={mediaUrl} alt={memory.caption || 'Memory'} className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <VideoThumbnail src={mediaUrl} className="aspect-[4/3] w-full transition duration-300 group-hover:scale-[1.03]" iconSize={24} label={memory.caption || 'Video memory'} />
        )}
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold text-gray-950 dark:text-white">
              {memory.caption || (memory.fileType === 'image' ? 'Photo memory' : 'Video memory')}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Avatar person={memory.userId} size="sm" onClick={onUserClick} />
              <span className="min-w-0 truncate">{memory.userId?.name || 'Member'}</span>
              <span>{formatRelativeDate(memory.createdAt)}</span>
            </div>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={deleteMemory}
              disabled={deleting}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30"
              title="Delete memory"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
};

export default function GroupPage() {
  const { id, section } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [memories, setMemories] = useState([]);
  const [activities, setActivities] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState(null);
  const [newPostPreview, setNewPostPreview] = useState(null);
  const [creatingPost, setCreatingPost] = useState(false);
  const [postUploadProgress, setPostUploadProgress] = useState(0);
  const [postSearch, setPostSearch] = useState('');
  const [postTypeFilter, setPostTypeFilter] = useState('all');
  const [postSort, setPostSort] = useState('newest');

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [newTaskLabels, setNewTaskLabels] = useState('');
  const [newTaskApprovalStatus, setNewTaskApprovalStatus] = useState('not_required');
  const [creatingTask, setCreatingTask] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [updatingTaskIds, setUpdatingTaskIds] = useState({});
  const [taskView, setTaskView] = useState('board');
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('all');
  const [taskApprovalFilter, setTaskApprovalFilter] = useState('all');
  const [taskLabelFilter, setTaskLabelFilter] = useState('all');
  const [taskSort, setTaskSort] = useState('dueDate');
  const [taskSearch, setTaskSearch] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [fileKindFilter, setFileKindFilter] = useState('all');
  const [fileSort, setFileSort] = useState('newest');
  const [previewFile, setPreviewFile] = useState(null);
  const [memoryFile, setMemoryFile] = useState(null);
  const [memoryCaption, setMemoryCaption] = useState('');
  const [memoryPreview, setMemoryPreview] = useState(null);
  const [uploadingMemory, setUploadingMemory] = useState(false);
  const [memoryUploadProgress, setMemoryUploadProgress] = useState(0);
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false);
  const [groupSettings, setGroupSettings] = useState({ name: '', subject: '', description: '' });
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(null);
  const [looseMediaItem, setLooseMediaItem] = useState(null);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [sharePost, setSharePost] = useState(null);
  const [shareMode, setShareMode] = useState('message');
  const [shareTargetId, setShareTargetId] = useState('');
  const [sharingPost, setSharingPost] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [searchingInviteUsers, setSearchingInviteUsers] = useState(false);
  const [sendingInviteIds, setSendingInviteIds] = useState({});
  const [profileUser, setProfileUser] = useState(null);

  const openUserProfile = (person) => {
    if (!person) return;
    setProfileUser(person);
  };

  const requestedSection = section?.toLowerCase() || 'overview';
  const activeTab = routeToSection[requestedSection] || 'overview';
  const setActiveTab = (nextSection) => {
    const nextRoute = sectionRoutes[nextSection] ?? '';
    navigate(nextRoute ? `/group/${id}/${nextRoute}` : `/group/${id}`);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (section && !routeToSection[requestedSection]) {
      navigate(`/group/${id}`, { replace: true });
    }
  }, [id, navigate, requestedSection, section]);

  useEffect(() => {
    fetchGroupData();
    fetchGroupMembers();
    fetchJoinedGroups();
  }, [id]);

  useEffect(() => () => {
    if (newPostPreview) URL.revokeObjectURL(newPostPreview);
  }, [newPostPreview]);

  useEffect(() => () => {
    if (memoryPreview) URL.revokeObjectURL(memoryPreview);
  }, [memoryPreview]);

  useEffect(() => {
    if (!group) return;
    setGroupSettings({
      name: group.name || '',
      subject: group.subject || '',
      description: group.description || ''
    });
  }, [group]);

  const fetchGroupData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setLoadingPosts(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [groupRes, postsRes, tasksRes, filesRes, memoriesRes, activityRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/posts/group/${id}`),
        api.get(`/tasks/group/${id}`),
        api.get(`/files/group/${id}`),
        api.get(`/memories/group/${id}`),
        api.get(`/activity/group/${id}`)
      ]);
      setGroup(groupRes.data);
      setPosts(postsRes.data);
      setTasks(tasksRes.data);
      setFiles(filesRes.data);
      setMemories(memoriesRes.data);
      setActivities(activityRes.data);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.msg || 'Failed to load group data');
      navigate('/dashboard');
    } finally {
      setLoading(false);
      setLoadingPosts(false);
      setRefreshing(false);
    }
  };

  const fetchGroupMembers = async () => {
    try {
      const res = await api.get(`/groups/${id}/members`);
      setGroupMembers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await api.get(`/activity/group/${id}`);
      setActivities(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJoinedGroups = async () => {
    try {
      const res = await api.get('/groups');
      setJoinedGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetPostForm = () => {
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostMedia(null);
    setNewPostPreview(null);
    setPostUploadProgress(0);
  };

  const handlePostMediaSelect = (file) => {
    if (!validateUploadFile(file)) return;

    setNewPostMedia(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setNewPostPreview(URL.createObjectURL(file));
    } else {
      setNewPostPreview(null);
    }
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();
    const title = newPostTitle.trim();
    const content = newPostContent.trim();

    if (!title || !content) {
      toast.error('Post title and content are required');
      return;
    }

    setCreatingPost(true);
    setPostUploadProgress(0);

    try {
      let fileUrl = null;

      if (newPostMedia) {
        const uploadFile = newPostMedia.type?.startsWith('image/')
          ? await optimizeImageFile(newPostMedia, { maxDimension: 1600, quality: 0.84, minBytes: 700 * 1024 })
          : newPostMedia;
        const formData = new FormData();
        formData.append('file', uploadFile);
        const uploadRes = await api.post(`/files/upload/${id}`, formData, {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            setPostUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        });
        fileUrl = uploadRes.data.url || uploadRes.data.fileUrl || `/uploads/${uploadRes.data.filename}`;
        setFiles(prev => [uploadRes.data, ...prev.filter(file => file._id !== uploadRes.data._id)]);
      }

      const postRes = await api.post('/posts', { groupId: id, title, content, fileUrl });
      setPosts(prev => [postRes.data, ...prev]);
      fetchActivity();
      playUiSound('success');
      toast.success('Post published');
      resetPostForm();
      setShowCreatePost(false);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to create post');
    } finally {
      setCreatingPost(false);
      setPostUploadProgress(0);
    }
  };

  const handleReact = async (postId, emoji) => {
    try {
      const res = await api.post(`/posts/${postId}/react`, { emoji });
      setPosts(prev => prev.map(post => post._id === postId ? res.data : post));
      fetchActivity();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to add reaction');
    }
  };

  const handleSavePost = async (postId) => {
    try {
      const res = await api.put(`/posts/${postId}/save`);
      setPosts(prev => prev.map(post => post._id === postId ? res.data : post));
      const saved = (res.data.savedBy || []).some(userId => normalizeId(userId) === currentUserId);
      toast.success(saved ? 'Post saved' : 'Removed from saved');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to save post');
    }
  };

  const handlePinPost = async (postId) => {
    try {
      const res = await api.put(`/posts/${postId}/pin`);
      setPosts(prev => prev
        .map(post => post._id === postId ? res.data : post)
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.pinnedAt || b.createdAt || 0) - new Date(a.pinnedAt || a.createdAt || 0)));
      fetchActivity();
      toast.success(res.data.pinned ? 'Announcement pinned' : 'Announcement unpinned');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to pin announcement');
    }
  };

  const handleComment = async (postId, text) => {
    try {
      const res = await api.post(`/posts/${postId}/comment`, { text });
      setPosts(prev => prev.map(post => post._id === postId ? res.data : post));
      fetchActivity();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to comment');
      throw err;
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(prev => prev.filter(post => post._id !== postId));
      toast.success('Post deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete post');
      throw err;
    }
  };

  const openSharePost = (post) => {
    setSharePost(post);
    setShareMode('message');
    setShareTargetId('');
  };

  const buildPostShareText = (post) => {
    return `Shared post from ${group.name}\n\n${post.title}\n${post.content}`;
  };

  const handleSharePost = async (event) => {
    event.preventDefault();
    if (!sharePost || !shareTargetId) {
      toast.error('Choose where to share this post');
      return;
    }

    setSharingPost(true);
    try {
      const text = buildPostShareText(sharePost);
      const fileUrl = sharePost.fileUrl || '';
      const fileType = getShareFileType(fileUrl);
      const fileName = fileUrl ? getFileName(fileUrl) : '';

      if (shareMode === 'message') {
        await api.post('/messages', { to: shareTargetId, text, fileUrl, fileType, fileName });
      } else {
        const res = await api.post('/group-chat', { groupId: shareTargetId, text, fileUrl, fileType });
        getSocket().emit('send-group-message', { groupId: shareTargetId, message: res.data });
      }

      toast.success('Post shared');
      setSharePost(null);
      setShareTargetId('');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to share post');
    } finally {
      setSharingPost(false);
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    const description = newTaskDesc.trim();

    if (!description) {
      toast.error('Task title is required');
      return;
    }
    if (!validateTaskDueDate(newTaskDueDate)) return;

    setCreatingTask(true);
    try {
      const payload = {
        groupId: id,
        description,
        dueDate: newTaskDueDate || null,
        priority: newTaskPriority,
        assignedTo: newTaskAssignedTo || null,
        labels: parseLabels(newTaskLabels),
        approvalStatus: newTaskApprovalStatus
      };
      const res = await api.post('/tasks', payload);
      setTasks(prev => [res.data, ...prev]);
      fetchActivity();
      setNewTaskDesc('');
      setNewTaskDueDate('');
      setNewTaskPriority('medium');
      setNewTaskAssignedTo('');
      setNewTaskLabels('');
      setNewTaskApprovalStatus('not_required');
      setShowCreateTask(false);
      playUiSound('success');
      toast.success('Task added');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to add task');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    if (Object.prototype.hasOwnProperty.call(updates, 'dueDate') && !validateTaskDueDate(updates.dueDate)) {
      return null;
    }

    setUpdatingTaskIds(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await api.put(`/tasks/${taskId}`, updates);
      setTasks(prev => prev.map(task => task._id === taskId ? res.data : task));
      fetchActivity();
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Task update failed');
      throw err;
    } finally {
      setUpdatingTaskIds(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const handleTaskComment = async (taskId, comment) => {
    await handleUpdateTask(taskId, { comment });
    toast.success('Comment added');
  };

  const handleDeleteTask = async (taskId) => {
    setUpdatingTaskIds(prev => ({ ...prev, [taskId]: true }));
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(task => task._id !== taskId));
      if (expandedTaskId === taskId) setExpandedTaskId(null);
      toast.success('Task deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete task');
    } finally {
      setUpdatingTaskIds(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  };

  const handleSelectedFile = (file) => {
    if (!validateUploadFile(file)) return;
    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileUploadProgress(0);
    setFileInputKey(value => value + 1);
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      toast.error('Choose a file first');
      return;
    }

    const uploadFile = selectedFile.type?.startsWith('image/')
      ? await optimizeImageFile(selectedFile, { maxDimension: 1600, quality: 0.84, minBytes: 700 * 1024 })
      : selectedFile;
    const formData = new FormData();
    formData.append('file', uploadFile);
    setUploading(true);
    setFileUploadProgress(0);

    try {
      const res = await api.post(`/files/upload/${id}`, formData, {
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setFileUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });
      setFiles(prev => [res.data, ...prev.filter(file => file._id !== res.data._id)]);
      fetchActivity();
      clearSelectedFile();
      playUiSound('success');
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Upload failed');
    } finally {
      setUploading(false);
      setFileUploadProgress(0);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/files/${fileId}`);
      setFiles(prev => prev.filter(file => file._id !== fileId));
      toast.success('File deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete file');
      throw err;
    }
  };

  const handleGroupPhotoSelect = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast.error('Please choose an image for the group photo');
      return;
    }
    const uploadFile = await optimizeImageFile(file, { maxDimension: 1200, quality: 0.86, minBytes: 400 * 1024 });
    if (uploadFile.size > 8 * 1024 * 1024) {
      toast.error('Group photo must be 8MB or smaller');
      return;
    }

    const formData = new FormData();
    formData.append('photo', uploadFile);
    setUploadingGroupPhoto(true);

    try {
      const res = await api.post(`/groups/${id}/photo`, formData);
      setGroup(res.data);
      window.dispatchEvent(new Event('groupsUpdated'));
      fetchActivity();
      playUiSound('success');
      toast.success('Group photo updated');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to update group photo');
    } finally {
      setUploadingGroupPhoto(false);
    }
  };

  const handleMemoryFileSelect = (file) => {
    if (!file) return;
    if (!validateUploadFile(file)) return;

    const kind = getFileKind(file);
    if (kind !== 'image' && kind !== 'video') {
      toast.error('Project Assets accepts photos or videos only');
      return;
    }

    setMemoryFile(file);
    if (memoryPreview) URL.revokeObjectURL(memoryPreview);
    setMemoryPreview(URL.createObjectURL(file));
  };

  const clearMemoryForm = () => {
    setMemoryFile(null);
    setMemoryCaption('');
    setMemoryUploadProgress(0);
    setMemoryPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleUploadMemory = async (event) => {
    event.preventDefault();
    if (!memoryFile) {
      toast.error('Choose a photo or video first');
      return;
    }

    const uploadFile = memoryFile.type?.startsWith('image/')
      ? await optimizeImageFile(memoryFile, { maxDimension: 1600, quality: 0.84, minBytes: 700 * 1024 })
      : memoryFile;
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('caption', memoryCaption.trim());
    setUploadingMemory(true);
    setMemoryUploadProgress(0);

    try {
      const res = await api.post(`/memories/group/${id}`, formData, {
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setMemoryUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });
      setMemories(prev => [res.data, ...prev]);
      fetchActivity();
      clearMemoryForm();
      playUiSound('success');
      toast.success('Media saved');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to upload memory');
    } finally {
      setUploadingMemory(false);
      setMemoryUploadProgress(0);
    }
  };

  const handleDeleteMemory = async (memoryId) => {
    try {
      await api.delete(`/memories/${memoryId}`);
      setMemories(prev => prev.filter(memory => memory._id !== memoryId));
      toast.success('Media removed');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to delete memory');
      throw err;
    }
  };

  const handleSaveGroupSettings = async (event) => {
    event.preventDefault();
    if (!groupSettings.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    setSavingGroupSettings(true);
    try {
      const res = await api.put(`/groups/${id}`, {
        name: groupSettings.name,
        subject: groupSettings.subject,
        description: groupSettings.description
      });
      setGroup(res.data);
      window.dispatchEvent(new Event('groupsUpdated'));
      fetchActivity();
      playUiSound('success');
      toast.success('Workspace settings saved');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to save workspace settings');
    } finally {
      setSavingGroupSettings(false);
    }
  };

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      toast.success('Join code copied');
    } catch {
      toast.error('Could not copy join code');
    }
  };

  const fetchPendingInvites = async () => {
    if (!id) return;

    try {
      const res = await api.get(`/groups/${id}/invites`);
      setPendingInvites(res.data || []);
    } catch (err) {
      if (err.response?.status !== 403) console.error(err);
      setPendingInvites([]);
    }
  };

  const searchInviteUsers = async (event) => {
    event?.preventDefault();
    const query = inviteSearch.trim();
    if (!query) {
      setInviteResults([]);
      return;
    }

    setSearchingInviteUsers(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      const memberIds = new Set(groupMembers.map(member => normalizeId(member)));
      const pendingIds = new Set(pendingInvites.map(invite => normalizeId(invite.invitedUser)));
      setInviteResults((res.data || []).filter(person => {
        const personId = normalizeId(person);
        return personId && !memberIds.has(personId) && !pendingIds.has(personId);
      }));
    } catch (err) {
      toast.error('Failed to search users');
    } finally {
      setSearchingInviteUsers(false);
    }
  };

  const handleInviteUser = async (person) => {
    const personId = normalizeId(person);
    if (!personId) return;

    setSendingInviteIds(prev => ({ ...prev, [personId]: true }));
    try {
      const res = await api.post(`/groups/${id}/invites`, { userId: personId });
      setPendingInvites(prev => [res.data, ...prev.filter(invite => normalizeId(invite.invitedUser) !== personId)]);
      setInviteResults(prev => prev.filter(item => normalizeId(item) !== personId));
      fetchActivity();
      playUiSound('success');
      toast.success(`Invite sent to ${person.name || person.email}`);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to send invite');
    } finally {
      setSendingInviteIds(prev => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
    }
  };

  const currentUserId = normalizeId(user);
  const currentMember = groupMembers.find(member => normalizeId(member) === currentUserId);
  const groupCreatorId = normalizeId(group?.creator);
  const canModerate = currentMember?.role === 'creator' || currentMember?.role === 'co-creator' || groupCreatorId === currentUserId;

  useEffect(() => {
    if (canModerate) {
      fetchPendingInvites();
    } else {
      setPendingInvites([]);
    }
  }, [canModerate, id]);

  const taskStats = useMemo(() => {
    const done = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const overdue = tasks.filter(isTaskOverdue).length;
    return {
      total: tasks.length,
      open: tasks.length - done,
      inProgress,
      done,
      overdue
    };
  }, [tasks]);

  const fileStats = useMemo(() => ({
    total: files.length,
    storage: formatBytes(files.reduce((sum, file) => sum + (file.size || 0), 0))
  }), [files]);

  const filteredPosts = useMemo(() => {
    const search = postSearch.trim().toLowerCase();

    return posts
      .filter(post => {
        const kind = post.fileUrl ? getShareFileType(post.fileUrl) : 'text';
        const isSaved = (post.savedBy || []).some(userId => normalizeId(userId) === currentUserId);
        const typeMatch = postTypeFilter === 'all'
          || (postTypeFilter === 'saved' ? isSaved : (postTypeFilter === 'media' ? ['image', 'video'].includes(kind) : kind === postTypeFilter));
        const searchMatch = !search
          || post.title?.toLowerCase().includes(search)
          || post.content?.toLowerCase().includes(search)
          || post.userId?.name?.toLowerCase().includes(search)
          || post.comments?.some(comment => comment.text?.toLowerCase().includes(search));
        return typeMatch && searchMatch;
      })
      .sort((a, b) => {
        if (postSort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        if (postSort === 'reactions') return (b.reactions?.length || 0) - (a.reactions?.length || 0);
        if (postSort === 'comments') return (b.comments?.length || 0) - (a.comments?.length || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [currentUserId, postSearch, postSort, postTypeFilter, posts]);

  const filteredTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();

    return tasks
      .filter(task => {
        const statusMatch = taskFilter === 'all'
          ? true
          : taskFilter === 'overdue'
            ? isTaskOverdue(task)
            : task.status === taskFilter;
        const priorityMatch = taskPriorityFilter === 'all' || task.priority === taskPriorityFilter;
        const approvalMatch = taskApprovalFilter === 'all' || (task.approvalStatus || 'not_required') === taskApprovalFilter;
        const labelMatch = taskLabelFilter === 'all' || (task.labels || []).includes(taskLabelFilter);
        const assigneeId = normalizeId(task.assignedTo);
        const assigneeMatch = taskAssigneeFilter === 'all'
          || (taskAssigneeFilter === 'unassigned' ? !assigneeId : assigneeId === taskAssigneeFilter);
        const searchMatch = !search
          || task.description?.toLowerCase().includes(search)
          || task.assignedTo?.name?.toLowerCase().includes(search)
          || task.labels?.some(label => label.toLowerCase().includes(search));

        return statusMatch && priorityMatch && approvalMatch && labelMatch && assigneeMatch && searchMatch;
      })
      .sort((a, b) => {
        if (taskSort === 'priority') return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
        if (taskSort === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (taskSort === 'assignedTo') return (a.assignedTo?.name || '').localeCompare(b.assignedTo?.name || '');

        const aDate = safeDate(a.dueDate);
        const bDate = safeDate(b.dueDate);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      });
  }, [tasks, taskFilter, taskPriorityFilter, taskApprovalFilter, taskLabelFilter, taskAssigneeFilter, taskSearch, taskSort]);

  const taskLabels = useMemo(() => [...new Set(tasks.flatMap(task => task.labels || []))].sort(), [tasks]);

  const taskColumns = useMemo(() => ([
    { key: 'not_started', title: 'To do', items: filteredTasks.filter(task => task.status === 'not_started') },
    { key: 'in_progress', title: 'In progress', items: filteredTasks.filter(task => task.status === 'in_progress') },
    { key: 'done', title: 'Done', items: filteredTasks.filter(task => task.status === 'done') }
  ]), [filteredTasks]);

  const filteredFiles = useMemo(() => {
    const search = fileSearch.trim().toLowerCase();

    return files
      .filter(file => {
        const kind = getFileKind(file);
        const kindMatch = fileKindFilter === 'all' || kind === fileKindFilter;
        const searchMatch = !search
          || file.originalName?.toLowerCase().includes(search)
          || file.uploadedBy?.name?.toLowerCase().includes(search);
        return kindMatch && searchMatch;
      })
      .sort((a, b) => {
        if (fileSort === 'name') return (a.originalName || '').localeCompare(b.originalName || '');
        if (fileSort === 'size') return (b.size || 0) - (a.size || 0);
        return new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0);
      });
  }, [files, fileSearch, fileKindFilter, fileSort]);

  const mediaItems = useMemo(() => {
    const items = [];

    memories.forEach(memory => {
      items.push({
        id: `memory-${memory._id}`,
        sourceId: memory._id,
        type: memory.fileType,
        url: memory.fileUrl,
        title: memory.caption || (memory.fileType === 'image' ? 'Saved photo' : 'Saved video'),
        author: memory.userId?.name || 'Member',
        createdAt: memory.createdAt,
        origin: 'Project Assets'
      });
    });

    files.forEach(file => {
      const kind = getFileKind(file);
      if (kind === 'image' || kind === 'video') {
        items.push({
          id: `file-${file._id}`,
          sourceId: file._id,
          type: kind,
          url: getStoredFileUrl(file),
          title: file.originalName || file.filename,
          author: file.uploadedBy?.name || 'Member',
          createdAt: file.uploadDate,
          origin: 'File'
        });
      }
    });

    posts.forEach(post => {
      const type = getShareFileType(post.fileUrl);
      if (type === 'image' || type === 'video') {
        items.push({
          id: `post-${post._id}`,
          sourceId: post._id,
          type,
          url: post.fileUrl,
          title: post.title,
          author: post.userId?.name || 'Member',
          createdAt: post.createdAt,
          origin: 'Post'
        });
      }
    });

    return items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [files, memories, posts]);

  const openMediaViewer = (itemOrUrl) => {
    if (!itemOrUrl) return;
    const targetUrl = typeof itemOrUrl === 'string' ? resolveMediaUrl(itemOrUrl) : resolveMediaUrl(itemOrUrl.url);
    const index = mediaItems.findIndex(item => resolveMediaUrl(item.url) === targetUrl || item.id === itemOrUrl.id);
    if (index !== -1) {
      setLooseMediaItem(null);
      setMediaViewerIndex(index);
    } else {
      const inferredType = getShareFileType(targetUrl) || itemOrUrl.type || 'image';
      setMediaViewerIndex(null);
      setLooseMediaItem({
        id: itemOrUrl.id || targetUrl,
        type: inferredType === 'video' ? 'video' : 'image',
        url: targetUrl,
        title: itemOrUrl.title || itemOrUrl.name || 'Media preview',
        origin: itemOrUrl.origin || 'Media'
      });
    }
  };

  const activeMediaItem = looseMediaItem || (mediaViewerIndex !== null ? mediaItems[mediaViewerIndex] : null);
  const mediaViewerPayload = activeMediaItem
    ? {
        ...activeMediaItem,
        url: resolveMediaUrl(activeMediaItem.url),
        name: activeMediaItem.title || activeMediaItem.name || 'Media preview'
      }
    : null;
  const mediaViewerPosition = activeMediaItem && !looseMediaItem
    ? `Viewing ${(mediaViewerIndex ?? 0) + 1} of ${mediaItems.length}`
    : activeMediaItem?.origin || '';

  const moveMediaViewer = (direction) => {
    if (!mediaItems.length) return;
    setLooseMediaItem(null);
    setMediaViewerIndex(index => {
      if (index === null) return 0;
      return (index + direction + mediaItems.length) % mediaItems.length;
    });
  };

  const dueSoonTasks = useMemo(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 3);
    soon.setHours(23, 59, 59, 999);

    return tasks
      .filter(task => {
        const dueDate = safeDate(task.dueDate);
        return dueDate && task.status !== 'done' && dueDate <= soon;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 6);
  }, [tasks]);

  const pinnedPosts = useMemo(() => posts.filter(post => post.pinned).slice(0, 3), [posts]);
  const needsApprovalTasks = useMemo(() => tasks.filter(task => task.approvalStatus === 'pending' || task.approvalStatus === 'changes_requested'), [tasks]);

  const tabs = [
    { key: 'overview', label: 'Overview', route: '', icon: Activity, count: pinnedPosts.length + files.length + memories.length, description: 'Command center for updates, files, assets, and realtime team conversation.' },
    { key: 'posts', label: 'Announcements', route: 'posts', icon: FileText, count: posts.length, description: 'Important workspace updates, decisions, reactions, and shared post media.' },
    { key: 'files', label: 'Files', route: 'files', icon: Upload, count: files.length, description: 'Upload, preview, download, and manage workspace documents.' },
    { key: 'memories', label: 'Project Assets', route: 'assets', icon: Images, count: memories.length, description: 'A dedicated gallery for photos, videos, screenshots, and visual references.' },
    { key: 'chat', label: 'Team Chat', route: 'chat', icon: MessageCircle, description: 'Realtime conversation for the members of this workspace.' },
    { key: 'members', label: 'Members', route: 'members', icon: Users, count: groupMembers.length || group?.members?.length || 0, description: 'People, roles, admins, and membership visibility.' },
    { key: 'activity', label: 'Updates', route: 'updates', icon: Activity, count: activities.length, description: 'A running history of uploads, announcements, task changes, and workspace events.' },
    { key: 'settings', label: 'Settings', route: 'settings', icon: Settings, description: 'Workspace profile, group photo, access code, and invite controls.' }
  ];

  if (loading) return <LoadingSpinner />;
  if (!group) return <div className="py-10 text-center text-gray-600 dark:text-gray-300">Group not found</div>;

  const canManageFile = (file) => canModerate || normalizeId(file.uploadedBy) === currentUserId;
  const groupPhotoUrl = resolveMediaUrl(group.photo);
  const activeSection = tabs.find(tab => tab.key === activeTab) || tabs[0];
  const ActiveSectionIcon = activeSection.icon;
  const workspaceModules = tabs.filter(tab => tab.key !== 'overview');
  const moduleDetails = {
    posts: `${posts.length} announcements and decisions`,
    files: `${files.length} shared documents`,
    memories: `${memories.length} photos and videos`,
    chat: 'Realtime workspace conversation',
    members: `${groupMembers.length || group.members?.length || 0} people in this space`,
    activity: `${activities.length} recent events`,
    settings: canModerate ? 'Manage identity and invitations' : 'View workspace settings'
  };
  const featuredModules = ['posts', 'chat', 'files', 'memories'];
  const compactModules = workspaceModules.filter(tab => !featuredModules.includes(tab.key));
  const focusedQuickLinks = workspaceModules.filter(tab => tab.key !== activeTab).slice(0, 5);
  const currentSectionCount = typeof activeSection.count === 'number' ? activeSection.count : null;
  const focusedActions = [
    activeTab === 'posts' && {
      label: 'New post',
      icon: PlusCircle,
      onClick: () => setShowCreatePost(true),
      primary: true
    },
    activeTab !== 'chat' && {
      label: 'Open chat',
      icon: MessageCircle,
      onClick: () => setActiveTab('chat')
    }
  ].filter(Boolean);

  const quickStats = [
    { label: 'Members', value: groupMembers.length || group.members?.length || 0 },
    { label: 'Announcements', value: posts.length },
    { label: 'Files', value: files.length },
    { label: 'Media', value: memories.length }
  ];

  return (
    <div className="mobile-page mx-auto max-w-7xl space-y-4 overflow-x-hidden px-0 py-1 sm:space-y-6 sm:px-6 sm:py-4 lg:px-8">
      {activeTab === 'overview' ? (
        <section className="mobile-group-hero relative overflow-hidden rounded-2xl border border-pink-200/70 bg-white shadow-[0_0_0_1px_rgba(236,72,153,0.08),0_18px_50px_rgba(236,72,153,0.12)] dark:border-pink-900/40 dark:bg-gray-900 dark:shadow-[0_0_0_1px_rgba(236,72,153,0.10),0_18px_50px_rgba(236,72,153,0.08)]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-emerald-400" />
          <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-900 text-white shadow-lg ring-1 ring-white/40 dark:bg-white dark:text-gray-900">
                {groupPhotoUrl ? (
                  <img src={groupPhotoUrl} alt={group.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500 via-indigo-500 to-cyan-500">
                    <Users size={34} />
                  </div>
                )}
                {canModerate && (
                  <label className="absolute inset-x-2 bottom-2 flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-black/55 px-2 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/70">
                    {uploadingGroupPhoto ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                    Photo
                    <input type="file" accept="image/*" className="hidden" onChange={event => handleGroupPhotoSelect(event.target.files?.[0])} disabled={uploadingGroupPhoto} />
                  </label>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase text-pink-600 dark:text-pink-300">{group.subject || 'Group workspace'}</p>
                <h1 className="mt-1 break-words text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl">{group.name}</h1>
                <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {group.description || 'No description yet.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">{groupMembers.length || group.members?.length || 0} members</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">{memories.length} media keepsakes</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">{pendingInvites.length} pending invites</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={copyJoinCode}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Copy size={16} />
                {group.joinCode}
              </button>
              <button
                type="button"
                onClick={() => fetchGroupData({ silent: true })}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {refreshing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                Refresh
              </button>
            </div>
          </div>

          <div className="mobile-metric-strip grid gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">
            {quickStats.map(stat => (
              <div key={stat.label} className="bg-white p-4 dark:bg-gray-900">
                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mobile-control-panel rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-pink-900 dark:hover:bg-pink-950/20"
                title="Back to workspace home"
              >
                <Activity size={18} />
              </button>
              <div className="flex min-w-0 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-950 text-white shadow-lg shadow-gray-900/10 dark:bg-white dark:text-gray-950">
                  <ActiveSectionIcon size={22} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase text-pink-600 dark:text-pink-300">{group.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-950 dark:text-white">{activeSection.label}</h1>
                    {currentSectionCount !== null && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{currentSectionCount}</span>
                    )}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{activeSection.description}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
              <label className="relative min-w-0 sm:w-56">
                <span className="sr-only">Switch section</span>
                <select
                  value={activeTab}
                  onChange={event => setActiveTab(event.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 pr-9 text-sm font-semibold text-gray-900 outline-none transition focus:border-pink-300 focus:ring-4 focus:ring-pink-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {tabs.map(tab => <option key={tab.key} value={tab.key}>{tab.label}</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </label>
              <div className="flex flex-wrap gap-2">
                {focusedActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                        action.primary
                          ? 'bg-pink-600 text-white hover:bg-pink-700'
                          : 'border border-gray-200 text-gray-700 hover:border-pink-200 hover:bg-pink-50 dark:border-gray-700 dark:text-gray-200 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20'
                      }`}
                    >
                      <Icon size={16} />
                      {action.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => fetchGroupData({ silent: true })}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {refreshing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {focusedQuickLinks.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'overview' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-pink-600 dark:text-pink-300">Workspace home</p>
              <h2 className="mt-1 text-xl font-bold text-gray-950 dark:text-white">Open the right workspace area</h2>
            </div>
            <p className="max-w-xl text-sm text-gray-500 dark:text-gray-400">Each area opens as a focused page so announcements, files, chat, and project assets stay easy to find.</p>
          </div>
          <div className="mobile-module-grid grid gap-3 lg:grid-cols-4">
            {featuredModules.map(key => {
              const tab = tabs.find(item => item.key === key);
              if (!tab) return null;
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.key}
                  type="button"
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.key)}
                  className="group relative min-h-44 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-pink-200 hover:bg-white hover:shadow-xl hover:shadow-pink-500/10 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-pink-900/60 dark:hover:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-2xl bg-gray-950 p-3 text-white shadow-lg shadow-gray-900/10 transition group-hover:bg-pink-600 dark:bg-white dark:text-gray-950 dark:group-hover:bg-pink-200">
                      <Icon size={24} />
                    </div>
                    {typeof tab.count === 'number' && (
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">{tab.count > 99 ? '99+' : tab.count}</span>
                    )}
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-gray-950 dark:text-white">{tab.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{moduleDetails[tab.key]}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-pink-600 dark:text-pink-300">
                    Open <ChevronDown size={15} className="-rotate-90" />
                  </span>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {compactModules.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-3 text-left transition hover:border-pink-200 hover:bg-pink-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-950 dark:text-white">{tab.label}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{moduleDetails[tab.key]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard icon={FileText} label="Announcements" value={posts.length} tone="blue" />
                <MetricCard icon={MessageCircle} label="Team chat" value={groupMembers.length || group.members?.length || 0} tone="emerald" />
                <MetricCard icon={Upload} label="Files" value={files.length} tone="amber" />
                <MetricCard icon={Images} label="Assets" value={memories.length} tone="gray" />
              </div>

              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-950 dark:text-white">Pinned announcements</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Important updates stay easy to find.</p>
                  </div>
                  <button type="button" onClick={() => setActiveTab('posts')} className="text-sm font-semibold text-pink-600 hover:text-pink-700 dark:text-pink-300">View announcements</button>
                </div>
                {pinnedPosts.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">No pinned announcements yet.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {pinnedPosts.map(post => (
                      <button key={post._id} type="button" onClick={() => setActiveTab('posts')} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-left transition hover:border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
                        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-amber-700 dark:text-amber-300"><Pin size={13} /> Pinned</span>
                        <h3 className="mt-2 line-clamp-1 font-semibold text-gray-950 dark:text-white">{post.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{post.content}</p>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-950 dark:text-white">Workspace shortcuts</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Jump straight to the parts members use most.</p>
                  </div>
                  <button type="button" onClick={() => setActiveTab('chat')} className="text-sm font-semibold text-pink-600 hover:text-pink-700 dark:text-pink-300">Open chat</button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { key: 'chat', title: 'Team Chat', detail: 'Discuss updates, reply, react, pin decisions, and send media.', icon: MessageCircle },
                    { key: 'files', title: 'File Library', detail: 'Preview shared documents without digging through posts.', icon: Upload },
                    { key: 'memories', title: 'Project Assets', detail: 'Collect photos, videos, screenshots, and visual references.', icon: Images }
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key)}
                        className="group min-h-36 rounded-xl border border-gray-100 bg-gray-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-pink-200 hover:bg-white hover:shadow-lg hover:shadow-pink-500/10 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-pink-900/60 dark:hover:bg-gray-900"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gray-950 text-white transition group-hover:bg-pink-600 dark:bg-white dark:text-gray-950">
                          <Icon size={20} />
                        </span>
                        <h3 className="mt-4 font-bold text-gray-950 dark:text-white">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">{item.detail}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-950 dark:text-white">Latest activity</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Recent uploads and announcements in this workspace.</p>
                <div className="mt-3 space-y-2">
                  {activities.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">No activity yet.</p>
                  ) : activities.slice(0, 5).map(activity => (
                    <button
                      key={activity._id || `${activity.type}-${activity.createdAt}`}
                      type="button"
                      onClick={() => setActiveTab(activity.type === 'post' ? 'posts' : ['file', 'memory'].includes(activity.type) ? 'files' : 'activity')}
                      className="w-full rounded-lg border border-gray-100 p-3 text-left transition hover:border-pink-200 hover:bg-pink-50 dark:border-gray-800 dark:hover:border-pink-900 dark:hover:bg-pink-950/20"
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-gray-950 dark:text-white">{activity.title || activity.description || 'Workspace update'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatShortDate(activity.createdAt, 'Recently')}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-950 dark:text-white">Team roles</h3>
                <div className="mt-3 space-y-2">
                  {groupMembers.slice(0, 6).map(member => (
                    <div key={member._id} className="flex min-w-0 items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                      <Avatar person={member} size="sm" onClick={openUserProfile} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{member.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabels[member.role] || 'Member'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </motion.div>
        )}

        {activeTab === 'posts' && (
          <motion.div key="posts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Avatar person={user} />
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(true)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm text-gray-500 transition hover:border-pink-300 hover:bg-pink-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-pink-800 dark:hover:bg-pink-950/20"
                  >
                    Share an update with {group.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreatePost(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    <PlusCircle size={18} />
                    New post
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
                  <label className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={postSearch}
                      onChange={event => setPostSearch(event.target.value)}
                      placeholder="Find announcements, captions, authors, comments..."
                      className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                  </label>
                  <select value={postTypeFilter} onChange={event => setPostTypeFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="all">All announcements</option>
                    <option value="saved">Saved announcements</option>
                    <option value="text">Text only</option>
                    <option value="media">Photos/videos</option>
                    <option value="file">Files</option>
                  </select>
                  <select value={postSort} onChange={event => setPostSort(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="reactions">Most reacted</option>
                    <option value="comments">Most discussed</option>
                  </select>
                </div>
              </div>

              {loadingPosts ? (
                <div className="space-y-4">{[...Array(3)].map((_, index) => <PostSkeleton key={index} />)}</div>
              ) : posts.length === 0 ? (
                <EmptyState type="posts" action={() => setShowCreatePost(true)} />
              ) : filteredPosts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
                  <Search className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">No matching announcements</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try another keyword, media filter, or sort.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPosts.map(post => (
                    <PostCard
                      key={post._id}
                      post={post}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      onReact={handleReact}
                      onComment={handleComment}
                      onDelete={handleDeletePost}
                      onShare={openSharePost}
                      onSave={handleSavePost}
                      onPin={handlePinPost}
                      onOpenMedia={openMediaViewer}
                      onUserClick={openUserProfile}
                    />
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <MetricCard icon={Upload} label="Shared files" value={fileStats.total} tone="emerald" />
              <MetricCard icon={Images} label="Project assets" value={memories.length} tone="blue" />
              <MetricCard icon={Users} label="Members" value={groupMembers.length || group.members?.length || 0} tone="amber" />
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Recent members</p>
                <div className="mt-3 space-y-3">
                  {groupMembers.slice(0, 5).map(member => (
                    <div key={member._id} className="flex min-w-0 items-center gap-3">
                      <Avatar person={member} size="sm" onClick={openUserProfile} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                        <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </motion.div>
        )}

        {activeTab === 'tasks' && (
          <motion.div key="tasks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard icon={CheckCircle} label="Open" value={taskStats.open} tone="blue" />
              <MetricCard icon={Clock} label="In progress" value={taskStats.inProgress} tone="gray" />
              <MetricCard icon={AlertCircle} label="Overdue" value={taskStats.overdue} tone="amber" />
              <MetricCard icon={Check} label="Done" value={taskStats.done} tone="emerald" />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateTask(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    <PlusCircle size={18} />
                    Add task
                  </button>
                  <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-950">
                    <button type="button" onClick={() => setTaskView('board')} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${taskView === 'board' ? 'bg-white text-pink-600 shadow-sm dark:bg-gray-900 dark:text-pink-300' : 'text-gray-500'}`}>
                      <Columns3 size={15} />
                      Board
                    </button>
                    <button type="button" onClick={() => setTaskView('list')} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${taskView === 'list' ? 'bg-white text-pink-600 shadow-sm dark:bg-gray-900 dark:text-pink-300' : 'text-gray-500'}`}>
                      <FileText size={15} />
                      List
                    </button>
                  </div>
                </div>

                <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
                  <label className="relative sm:col-span-2 lg:col-span-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={taskSearch}
                      onChange={event => setTaskSearch(event.target.value)}
                      placeholder="Search tasks"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                  </label>
                  <label className="relative">
                    <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select value={taskFilter} onChange={event => setTaskFilter(event.target.value)} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                      <option value="all">All status</option>
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </label>
                  <select value={taskPriorityFilter} onChange={event => setTaskPriorityFilter(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="all">All priority</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={taskAssigneeFilter} onChange={event => setTaskAssigneeFilter(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="all">All assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {groupMembers.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}
                  </select>
                  <select value={taskApprovalFilter} onChange={event => setTaskApprovalFilter(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="all">All approvals</option>
                    <option value="not_required">No approval</option>
                    <option value="pending">Needs approval</option>
                    <option value="approved">Approved</option>
                    <option value="changes_requested">Needs changes</option>
                  </select>
                  <select value={taskLabelFilter} onChange={event => setTaskLabelFilter(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="all">All labels</option>
                    {taskLabels.map(label => <option key={label} value={label}>{label}</option>)}
                  </select>
                  <label className="relative">
                    <SortAsc size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select value={taskSort} onChange={event => setTaskSort(event.target.value)} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                      <option value="dueDate">Due date</option>
                      <option value="priority">Priority</option>
                      <option value="recent">Newest</option>
                      <option value="assignedTo">Assignee</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
                <CheckCircle className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">No tasks found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Adjust the filters or create a new task.</p>
              </div>
            ) : taskView === 'board' ? (
              <div className="grid gap-4 lg:grid-cols-3">
                {taskColumns.map(column => (
                  <section key={column.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-950 dark:text-white">{column.title}</h3>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-gray-500 dark:bg-gray-900">{column.items.length}</span>
                    </div>
                    <div className="space-y-3">
                      {column.items.map(task => (
                        <BoardTaskCard
                          key={task._id}
                          task={task}
                          onOpen={() => {
                            setTaskView('list');
                            setExpandedTaskId(task._id);
                          }}
                          onStatusChange={(taskId, status) => handleUpdateTask(taskId, { status }).catch(() => {})}
                        />
                      ))}
                      {column.items.length === 0 && (
                        <p className="rounded-lg bg-white px-3 py-4 text-center text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">No tasks here.</p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    members={groupMembers}
                    isExpanded={expandedTaskId === task._id}
                    isUpdating={Boolean(updatingTaskIds[task._id])}
                    canDelete={normalizeId(task.createdBy) === currentUserId}
                    onToggleExpanded={() => setExpandedTaskId(expandedTaskId === task._id ? null : task._id)}
                    onUpdate={handleUpdateTask}
                    onComment={handleTaskComment}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'files' && (
          <motion.div key="files" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(false);
                    handleSelectedFile(event.dataTransfer.files?.[0]);
                  }}
                  className={`rounded-xl border-2 border-dashed p-5 text-center transition ${isDraggingFile ? 'border-pink-400 bg-pink-50 dark:border-pink-700 dark:bg-pink-950/20' : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-950'}`}
                >
                  <Upload className="mx-auto h-10 w-10 text-gray-400" />
                  <p className="mt-3 font-semibold text-gray-900 dark:text-white">Upload group file</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Up to 25MB per file</p>
                  <label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                    <Paperclip size={17} />
                    Choose file
                    <input
                      key={fileInputKey}
                      type="file"
                      className="hidden"
                      onChange={event => handleSelectedFile(event.target.files?.[0])}
                    />
                  </label>
                </div>

                {selectedFile && (
                  <div className="mt-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatBytes(selectedFile.size)}</p>
                      </div>
                      <button type="button" onClick={clearSelectedFile} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
                        <X size={18} />
                      </button>
                    </div>
                    {(uploading || fileUploadProgress > 0) && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full bg-pink-600 transition-all" style={{ width: `${fileUploadProgress}%` }} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleUploadFile}
                      disabled={uploading}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
                    >
                      {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                      {uploading ? 'Uploading...' : 'Upload file'}
                    </button>
                  </div>
                )}
              </div>

              <MetricCard icon={FileIcon} label="Files" value={fileStats.total} tone="gray" />
              <MetricCard icon={Download} label="Storage" value={fileStats.storage} tone="blue" />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-semibold text-gray-950 dark:text-white">File library</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{filteredFiles.length} of {files.length} files shown</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={fileSearch}
                      onChange={event => setFileSearch(event.target.value)}
                      placeholder="Search files"
                      className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                    />
                  </label>
                  <select value={fileKindFilter} onChange={event => setFileKindFilter(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="all">All types</option>
                    <option value="document">Documents</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                    <option value="archive">Archives</option>
                    <option value="other">Other</option>
                  </select>
                  <select value={fileSort} onChange={event => setFileSort(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950">
                    <option value="newest">Newest</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                  </select>
                </div>
              </div>

              {filteredFiles.length === 0 ? (
                <div className="p-10 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">No files found</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload a file or adjust the search filters.</p>
                </div>
              ) : (
                <ul>
                  {filteredFiles.map(file => (
                    <FileRow
                      key={file._id}
                      file={file}
                      canManage={canManageFile(file)}
                      onDelete={handleDeleteFile}
                      onPreview={(fileToPreview) => {
                        const kind = getFileKind(fileToPreview);
                        if (kind === 'image' || kind === 'video') openMediaViewer({ id: `file-${fileToPreview._id}`, url: getStoredFileUrl(fileToPreview) });
                        else setPreviewFile(fileToPreview);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'memories' && (
          <motion.div key="memories" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <form onSubmit={handleUploadMemory} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                  <Images size={20} className="text-pink-500" />
                  <h2 className="font-semibold text-gray-950 dark:text-white">Add to Project Assets</h2>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload photos or videos your group wants to keep.</p>

                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center transition hover:border-pink-300 hover:bg-pink-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-pink-800 dark:hover:bg-pink-950/20">
                  {memoryPreview ? (
                    getFileKind(memoryFile) === 'image' ? (
                      <img src={memoryPreview} alt="Memory preview" className="max-h-52 w-full rounded-lg object-contain" />
                    ) : (
                      <VideoThumbnail src={memoryPreview} className="max-h-52 w-full" videoClassName="max-h-52 object-contain" rounded="rounded-lg" iconSize={24} label="Memory video preview" />
                    )
                  ) : (
                    <>
                      <Camera className="h-10 w-10 text-gray-400" />
                      <span className="mt-3 font-semibold text-gray-900 dark:text-white">Choose photo or video</span>
                      <span className="mt-1 text-sm text-gray-500 dark:text-gray-400">Up to 25MB</span>
                    </>
                  )}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={event => handleMemoryFileSelect(event.target.files?.[0])} />
                </label>

                <textarea
                  value={memoryCaption}
                  onChange={event => setMemoryCaption(event.target.value)}
                  rows="3"
                  placeholder="Add a caption..."
                  className="mt-4 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                />

                {(uploadingMemory || memoryUploadProgress > 0) && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-pink-600 transition-all" style={{ width: `${memoryUploadProgress}%` }} />
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={clearMemoryForm} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                    Clear
                  </button>
                  <button type="submit" disabled={uploadingMemory || !memoryFile} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
                    {uploadingMemory ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Upload
                  </button>
                </div>
              </form>

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-gray-950 dark:text-white">Shared media</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{memories.length} saved upload{memories.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                {memories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
                    <Images className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">No media saved yet</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add photos or videos that your group wants to keep.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {memories.map(memory => (
                      <MemoryCard
                        key={memory._id}
                        memory={memory}
                        currentUserId={currentUserId}
                        canModerate={canModerate}
                        onDelete={handleDeleteMemory}
                        onOpen={(memory) => openMediaViewer({ id: `memory-${memory._id}`, url: memory.fileUrl })}
                        onUserClick={openUserProfile}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'activity' && (
          <motion.div key="activity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
                <div>
                  <h2 className="font-semibold text-gray-950 dark:text-white">Updates feed</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">A clear audit trail of what changed in this group.</p>
                </div>
                <button type="button" onClick={fetchActivity} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  Refresh
                </button>
              </div>

              {activities.length === 0 ? (
                <div className="p-10 text-center">
                  <Activity className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">No activity yet</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">New announcements, files, asset uploads, and task updates will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {activities.map(item => (
                    <div key={item._id} className="flex gap-3 p-4">
                      <Avatar person={item.actorId} onClick={openUserProfile} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-gray-950 dark:text-white">{item.actorId?.name || 'System'}</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.title}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">{item.type}</span>
                        </div>
                        {item.detail && <p className="mt-1 break-words text-sm text-gray-500 dark:text-gray-400">{item.detail}</p>}
                        <p className="mt-1 text-xs text-gray-400">{formatRelativeDate(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <MetricCard icon={Activity} label="Events" value={activities.length} tone="gray" />
              <MetricCard icon={FileText} label="Announcements" value={activities.filter(item => item.type === 'post').length} tone="blue" />
              <MetricCard icon={Upload} label="Uploads" value={activities.filter(item => ['file', 'memory'].includes(item.type)).length} tone="emerald" />
            </aside>
          </motion.div>
        )}

        {activeTab === 'members' && (
          <motion.div key="members" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GroupMembers groupId={id} onUserClick={openUserProfile} />
          </motion.div>
        )}

        {activeTab === 'chat' && (
          <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GroupChat groupId={id} group={group} members={groupMembers} onUserClick={openUserProfile} />
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <form onSubmit={handleSaveGroupSettings} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="border-b border-gray-100 p-5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-pink-500" />
                  <h2 className="font-semibold text-gray-950 dark:text-white">Workspace settings</h2>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tune the workspace identity and permissions-facing details.</p>
              </div>

              <div className="grid gap-4 p-5">
                {!canModerate && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                    Only the owner and admins can edit workspace settings.
                  </div>
                )}

                <label>
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Group name</span>
                  <input
                    value={groupSettings.name}
                    onChange={event => setGroupSettings(prev => ({ ...prev, name: event.target.value }))}
                    disabled={!canModerate}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Subject</span>
                  <input
                    value={groupSettings.subject}
                    onChange={event => setGroupSettings(prev => ({ ...prev, subject: event.target.value }))}
                    disabled={!canModerate}
                    placeholder="Math, Capstone, Review Circle..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Description</span>
                  <textarea
                    value={groupSettings.description}
                    onChange={event => setGroupSettings(prev => ({ ...prev, description: event.target.value }))}
                    disabled={!canModerate}
                    rows="5"
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
                <button type="button" onClick={() => setGroupSettings({ name: group.name || '', subject: group.subject || '', description: group.description || '' })} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  Reset
                </button>
                <button type="submit" disabled={!canModerate || savingGroupSettings || !groupSettings.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50">
                  {savingGroupSettings ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save settings
                </button>
              </div>
            </form>

            <aside className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-pink-50 p-2 text-pink-600 dark:bg-pink-950/30 dark:text-pink-300">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-950 dark:text-white">Invite members</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Search existing users, then they can accept or decline from Workspaces.</p>
                  </div>
                </div>

                {!canModerate ? (
                  <p className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    Only group admins can send invitations.
                  </p>
                ) : (
                  <>
                    <form onSubmit={searchInviteUsers} className="mt-4 flex gap-2">
                      <label className="relative min-w-0 flex-1">
                        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={inviteSearch}
                          onChange={event => setInviteSearch(event.target.value)}
                          placeholder="Name or email"
                          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={searchingInviteUsers || !inviteSearch.trim()}
                        className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                      >
                        {searchingInviteUsers ? <Loader2 size={16} className="animate-spin" /> : 'Find'}
                      </button>
                    </form>

                    <div className="mt-3 space-y-2">
                      {inviteResults.length === 0 && inviteSearch.trim() && !searchingInviteUsers ? (
                        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                          No available users found.
                        </p>
                      ) : inviteResults.map(person => {
                        const personId = normalizeId(person);

                        return (
                          <div key={personId} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2 dark:border-gray-800">
                            <Avatar person={person} size="sm" onClick={openUserProfile} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{person.name}</p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{person.email}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleInviteUser(person)}
                              disabled={sendingInviteIds[personId]}
                              className="rounded-lg bg-pink-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
                            >
                              {sendingInviteIds[personId] ? 'Sending' : 'Invite'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {pendingInvites.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Pending</p>
                        <div className="mt-2 space-y-2">
                          {pendingInvites.slice(0, 5).map(invite => (
                            <div key={invite._id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                              <Avatar person={invite.invitedUser} size="sm" onClick={openUserProfile} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{invite.invitedUser?.name || 'User'}</p>
                                <p className="text-xs text-gray-500">Waiting for response</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-950 dark:text-white">Group photo</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use a clean visual identity for cards and headers.</p>
                <label className={`mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${canModerate ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200' : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
                  {uploadingGroupPhoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  Update photo
                  <input type="file" accept="image/*" className="hidden" disabled={!canModerate || uploadingGroupPhoto} onChange={event => handleGroupPhotoSelect(event.target.files?.[0])} />
                </label>
              </div>

              <MetricCard icon={Users} label="Members" value={groupMembers.length || group.members?.length || 0} tone="gray" />
              <MetricCard icon={Copy} label="Join Code" value={group.joinCode} tone="blue" />
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreatePost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.form
              onSubmit={handleCreatePost}
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar person={user} />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-gray-950 dark:text-white">Create post</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Posting as {user?.name || 'you'} in {group.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePost(false);
                    resetPostForm();
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Title</span>
                  <input
                    type="text"
                    value={newPostTitle}
                    onChange={event => setNewPostTitle(event.target.value)}
                    placeholder="Project milestone, study note, announcement..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Message</span>
                  <textarea
                    value={newPostContent}
                    onChange={event => setNewPostContent(event.target.value)}
                    placeholder={`What should ${getFirstName(group.name)} know? Use @Name to mention teammates.`}
                    rows="5"
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>

                {newPostMedia && (
                  <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{newPostMedia.name}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatBytes(newPostMedia.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewPostMedia(null);
                          setNewPostPreview(null);
                        }}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    {newPostPreview && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                        {newPostMedia.type.startsWith('image/') ? (
                          <img src={newPostPreview} alt="Preview" className="max-h-72 w-full object-contain" />
                        ) : (
                          <VideoThumbnail src={newPostPreview} className="max-h-72 w-full" videoClassName="max-h-72 object-contain" rounded="rounded-lg" iconSize={26} label="Post video preview" />
                        )}
                      </div>
                    )}
                    {creatingPost && postUploadProgress > 0 && (
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full bg-pink-600 transition-all" style={{ width: `${postUploadProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Paperclip size={17} />
                    Attachment
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                    <ImageIcon size={17} />
                    Add file
                    <input
                      type="file"
                      className="hidden"
                      onChange={event => handlePostMediaSelect(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePost(false);
                    resetPostForm();
                  }}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPost || !newPostTitle.trim() || !newPostContent.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingPost ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  {creatingPost ? 'Publishing...' : 'Publish post'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.form
              onSubmit={handleCreateTask}
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">Create task</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Assign work, set priority, and track progress.</p>
                </div>
                <button type="button" onClick={() => setShowCreateTask(false)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Task title</span>
                  <input
                    type="text"
                    value={newTaskDesc}
                    onChange={event => setNewTaskDesc(event.target.value)}
                    placeholder="Prepare slides, review notes, finish module..."
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Due date</span>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    min={getTaskDateBounds().min}
                    max={getTaskDateBounds().max}
                    onChange={event => setNewTaskDueDate(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Priority</span>
                  <select
                    value={newTaskPriority}
                    onChange={event => setNewTaskPriority(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Assignee</span>
                  <select
                    value={newTaskAssignedTo}
                    onChange={event => setNewTaskAssignedTo(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  >
                    <option value="">Unassigned</option>
                    {groupMembers.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Approval</span>
                  <select
                    value={newTaskApprovalStatus}
                    onChange={event => setNewTaskApprovalStatus(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  >
                    <option value="not_required">No approval</option>
                    <option value="pending">Needs approval</option>
                    <option value="approved">Approved</option>
                    <option value="changes_requested">Needs changes</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Labels</span>
                  <input
                    type="text"
                    value={newTaskLabels}
                    onChange={event => setNewTaskLabels(event.target.value)}
                    placeholder="Frontend, Urgent, Review"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowCreateTask(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask || !newTaskDesc.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingTask ? <Loader2 size={17} className="animate-spin" /> : <PlusCircle size={17} />}
                  {creatingTask ? 'Creating...' : 'Create task'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sharePost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.form
              onSubmit={handleSharePost}
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">Share post</h2>
                  <p className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{sharePost.title}</p>
                </div>
                <button type="button" onClick={() => setSharePost(null)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShareMode('message');
                      setShareTargetId('');
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${shareMode === 'message' ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShareMode('group');
                      setShareTargetId('');
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${shareMode === 'group' ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    Team chat
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {shareMode === 'message' ? 'Send to member' : 'Share to team chat'}
                  </span>
                  <select
                    value={shareTargetId}
                    onChange={event => setShareTargetId(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-pink-950"
                  >
                    <option value="">Choose target</option>
                    {shareMode === 'message'
                      ? groupMembers
                        .filter(member => normalizeId(member) !== currentUserId)
                        .map(member => <option key={member._id} value={member._id}>{member.name}</option>)
                      : joinedGroups.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
                  </select>
                </label>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Preview</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">{buildPostShareText(sharePost)}</p>
                  {sharePost.fileUrl && <PostAttachment fileUrl={sharePost.fileUrl} />}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 p-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSharePost(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sharingPost || !shareTargetId}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sharingPost ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}
                  {sharingPost ? 'Sharing...' : 'Share'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      <MediaViewer
        media={mediaViewerPayload}
        onClose={() => {
          setMediaViewerIndex(null);
          setLooseMediaItem(null);
        }}
        onPrevious={!looseMediaItem && mediaItems.length > 1 ? () => moveMediaViewer(-1) : null}
        onNext={!looseMediaItem && mediaItems.length > 1 ? () => moveMediaViewer(1) : null}
        positionLabel={mediaViewerPosition}
        details={activeMediaItem?.author ? `${activeMediaItem.author} - ${formatRelativeDate(activeMediaItem.createdAt)}` : activeMediaItem?.origin}
      />

      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-gray-950 dark:text-white">{previewFile.originalName || previewFile.filename}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatBytes(previewFile.size)}</p>
                </div>
                <button type="button" onClick={() => setPreviewFile(null)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-gray-50 p-4 dark:bg-gray-950">
                {getFileKind(previewFile) === 'image' && (
                  <img src={getStoredFileUrl(previewFile)} alt={previewFile.originalName || 'File preview'} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
                )}
                {getFileKind(previewFile) === 'video' && (
                  <video controls src={getStoredFileUrl(previewFile)} className="mx-auto max-h-[70vh] w-full rounded-lg bg-black" />
                )}
                {getFileKind(previewFile) === 'document' && (
                  <iframe title={previewFile.originalName || 'Document preview'} src={getStoredFileUrl(previewFile)} className="h-[70vh] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800" />
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
                <a href={getStoredFileUrl(previewFile)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <Eye size={16} />
                  Open in new tab
                </a>
                <a href={getStoredFileUrl(previewFile)} download={previewFile.originalName} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                  <Download size={16} />
                  Download
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <UserProfileModal
        isOpen={Boolean(profileUser)}
        user={profileUser}
        onClose={() => setProfileUser(null)}
      />

    </div>
  );
}
