import React, { useEffect, useMemo, useState, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity,
  AlertCircle,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  Download,
  Eye,
  File as FileIcon,
  FileText,
  Filter,
  Flag,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  MessageSquare,
  Paperclip,
  PlusCircle,
  Search,
  Send,
  Share2,
  Smile,
  SortAsc,
  Trash2,
  Upload,
  User as UserIcon,
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
import { PostSkeleton } from './SkeletonLoader';
import { resolveMediaUrl } from '../utils/media';
import { getSocket } from '../services/socket';

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

const statusStyles = {
  not_started: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
};

const priorityStyles = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  high: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
};

const priorityOrder = { high: 0, medium: 1, low: 2 };

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

const Avatar = ({ person, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };

  return (
    <div className={`${sizeClasses[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 font-semibold text-white shadow-sm dark:bg-gray-700`}>
      {person?.avatar ? (
        <img src={resolveMediaUrl(person.avatar)} alt="" className="h-full w-full object-cover" />
      ) : (
        getUserInitial(person?.name)
      )}
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, tone = 'gray' }) => {
  const tones = {
    gray: 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white',
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100',
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

const PostAttachment = ({ fileUrl }) => {
  if (!fileUrl) return null;

  const mediaUrl = resolveMediaUrl(fileUrl);
  const fileName = getFileName(fileUrl);
  const kind = getFileKind({ filename: fileName });

  if (kind === 'image') {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <img src={mediaUrl} alt={fileName} className="max-h-[420px] w-full object-contain" />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-700">
        <video controls className="max-h-[420px] w-full">
          <source src={mediaUrl} />
        </video>
      </div>
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

const PostCard = memo(({ post, currentUserId, canModerate, onReact, onComment, onDelete, onShare }) => {
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
    if (!window.confirm('Delete this post?')) return;

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
          <Avatar person={post.userId} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900 dark:text-white">{post.userId?.name || 'Unknown member'}</p>
            <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock size={12} />
              {formatRelativeDate(post.createdAt)}
            </p>
          </div>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={deletePost}
            disabled={deleting}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30"
            title="Delete post"
          >
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="break-words text-xl font-bold text-gray-950 dark:text-white">{post.title}</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-300">{post.content}</p>
      </div>

      <PostAttachment fileUrl={post.fileUrl} />

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

      <div className="mt-3 grid grid-cols-3 gap-2">
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
                    <Avatar person={reaction.userId} size="sm" />
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
                      <Avatar person={comment.userId} size="sm" />
                      <div className="min-w-0 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-semibold text-gray-900 dark:text-white">{comment.userId?.name || 'Member'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelativeDate(comment.date || comment.createdAt)}</span>
                        </div>
                        <p className="break-words text-sm text-gray-700 dark:text-gray-300">{comment.text}</p>
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
                  placeholder="Write a comment..."
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
  const StatusIcon = getTaskStatusIcon(task.status);
  const overdue = isTaskOverdue(task);

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
                {task.description}
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
                {task.createdBy?.name && (
                  <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Created by {task.createdBy.name}
                  </span>
                )}
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
                          <p className="break-words text-gray-700 dark:text-gray-300">{comment.text}</p>
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
                      placeholder="Add a task comment..."
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
                  Activity
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

const FileRow = ({ file, canManage, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const fileUrl = resolveMediaUrl(file.url || file.fileUrl || `/uploads/${file.filename}`);
  const kind = getFileKind(file);
  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Video : kind === 'document' ? FileText : FileIcon;

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
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Eye size={16} />
          Open
        </a>
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

export default function GroupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  const [activeTab, setActiveTab] = useState('posts');
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

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [updatingTaskIds, setUpdatingTaskIds] = useState({});
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('all');
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
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [sharePost, setSharePost] = useState(null);
  const [shareMode, setShareMode] = useState('message');
  const [shareTargetId, setShareTargetId] = useState('');
  const [sharingPost, setSharingPost] = useState(false);

  useEffect(() => {
    fetchGroupData();
    fetchGroupMembers();
    fetchJoinedGroups();
  }, [id]);

  useEffect(() => () => {
    if (newPostPreview) URL.revokeObjectURL(newPostPreview);
  }, [newPostPreview]);

  const fetchGroupData = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setLoadingPosts(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [groupRes, postsRes, tasksRes, filesRes] = await Promise.all([
        api.get(`/groups/${id}`),
        api.get(`/posts/group/${id}`),
        api.get(`/tasks/group/${id}`),
        api.get(`/files/group/${id}`)
      ]);
      setGroup(groupRes.data);
      setPosts(postsRes.data);
      setTasks(tasksRes.data);
      setFiles(filesRes.data);
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
        const formData = new FormData();
        formData.append('file', newPostMedia);
        const uploadRes = await api.post(`/files/upload/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
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
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to add reaction');
    }
  };

  const handleComment = async (postId, text) => {
    try {
      const res = await api.post(`/posts/${postId}/comment`, { text });
      setPosts(prev => prev.map(post => post._id === postId ? res.data : post));
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
    const groupUrl = `${window.location.origin}/group/${id}`;
    return `Shared post from ${group.name}\n\n${post.title}\n${post.content}\n\nOpen group: ${groupUrl}`;
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

      if (shareMode === 'message') {
        await api.post('/messages', { to: shareTargetId, text });
      } else {
        const res = await api.post('/group-chat', { groupId: shareTargetId, text });
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

    setCreatingTask(true);
    try {
      const payload = {
        groupId: id,
        description,
        dueDate: newTaskDueDate || null,
        priority: newTaskPriority,
        assignedTo: newTaskAssignedTo || null
      };
      const res = await api.post('/tasks', payload);
      setTasks(prev => [res.data, ...prev]);
      setNewTaskDesc('');
      setNewTaskDueDate('');
      setNewTaskPriority('medium');
      setNewTaskAssignedTo('');
      setShowCreateTask(false);
      toast.success('Task added');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to add task');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    setUpdatingTaskIds(prev => ({ ...prev, [taskId]: true }));
    try {
      const res = await api.put(`/tasks/${taskId}`, updates);
      setTasks(prev => prev.map(task => task._id === taskId ? res.data : task));
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

    const formData = new FormData();
    formData.append('file', selectedFile);
    setUploading(true);
    setFileUploadProgress(0);

    try {
      const res = await api.post(`/files/upload/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setFileUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });
      setFiles(prev => [res.data, ...prev.filter(file => file._id !== res.data._id)]);
      clearSelectedFile();
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

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      toast.success('Join code copied');
    } catch {
      toast.error('Could not copy join code');
    }
  };

  const currentUserId = normalizeId(user);
  const currentMember = groupMembers.find(member => normalizeId(member) === currentUserId);
  const groupCreatorId = normalizeId(group?.creator);
  const canModerate = currentMember?.role === 'creator' || currentMember?.role === 'co-creator' || groupCreatorId === currentUserId;

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
        const assigneeId = normalizeId(task.assignedTo);
        const assigneeMatch = taskAssigneeFilter === 'all'
          || (taskAssigneeFilter === 'unassigned' ? !assigneeId : assigneeId === taskAssigneeFilter);
        const searchMatch = !search
          || task.description?.toLowerCase().includes(search)
          || task.assignedTo?.name?.toLowerCase().includes(search);

        return statusMatch && priorityMatch && assigneeMatch && searchMatch;
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
  }, [tasks, taskFilter, taskPriorityFilter, taskAssigneeFilter, taskSearch, taskSort]);

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

  const tabs = [
    { key: 'posts', label: 'Posts', icon: FileText, count: posts.length },
    { key: 'tasks', label: 'Tasks', icon: CheckCircle, count: taskStats.open },
    { key: 'files', label: 'Files', icon: Upload, count: files.length },
    { key: 'members', label: 'Members', icon: Users, count: groupMembers.length || group?.members?.length || 0 },
    { key: 'chat', label: 'Group Chat', icon: MessageCircle }
  ];

  if (loading) return <LoadingSpinner />;
  if (!group) return <div className="py-10 text-center text-gray-600 dark:text-gray-300">Group not found</div>;

  const canManageFile = (file) => canModerate || normalizeId(file.uploadedBy) === currentUserId;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
              <Users size={26} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase text-pink-600 dark:text-pink-300">{group.subject || 'Group workspace'}</p>
              <h1 className="mt-1 break-words text-3xl font-bold text-gray-950 dark:text-white">{group.name}</h1>
              <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
                {group.description || 'No description yet.'}
              </p>
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

        <div className="grid gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Members</p>
            <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-white">{groupMembers.length || group.members?.length || 0}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Posts</p>
            <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-white">{posts.length}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Open Tasks</p>
            <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-white">{taskStats.open}</p>
          </div>
          <div className="bg-white p-4 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Files</p>
            <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-white">{files.length}</p>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex min-w-max gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${active ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                <Icon size={17} />
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-current dark:bg-gray-900/10' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
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

              {loadingPosts ? (
                <div className="space-y-4">{[...Array(3)].map((_, index) => <PostSkeleton key={index} />)}</div>
              ) : posts.length === 0 ? (
                <EmptyState type="posts" action={() => setShowCreatePost(true)} />
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <PostCard
                      key={post._id}
                      post={post}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      onReact={handleReact}
                      onComment={handleComment}
                      onDelete={handleDeletePost}
                      onShare={openSharePost}
                    />
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <MetricCard icon={CheckCircle} label="Open tasks" value={taskStats.open} tone="blue" />
              <MetricCard icon={AlertCircle} label="Overdue" value={taskStats.overdue} tone="amber" />
              <MetricCard icon={Upload} label="Shared files" value={fileStats.total} tone="emerald" />
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Recent members</p>
                <div className="mt-3 space-y-3">
                  {groupMembers.slice(0, 5).map(member => (
                    <div key={member._id} className="flex min-w-0 items-center gap-3">
                      <Avatar person={member} size="sm" />
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
                <button
                  type="button"
                  onClick={() => setShowCreateTask(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
                >
                  <PlusCircle size={18} />
                  Add task
                </button>

                <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
                    <FileRow key={file._id} file={file} canManage={canManageFile(file)} onDelete={handleDeleteFile} />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'members' && (
          <motion.div key="members" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GroupMembers groupId={id} />
          </motion.div>
        )}

        {activeTab === 'chat' && (
          <motion.div key="chat" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <GroupChat groupId={id} />
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
                    placeholder={`What should ${getFirstName(group.name)} know?`}
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
                          <video controls className="max-h-72 w-full">
                            <source src={newPostPreview} type={newPostMedia.type} />
                          </video>
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
                    Group chat
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {shareMode === 'message' ? 'Send to member' : 'Share to group chat'}
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
    </div>
  );
}
