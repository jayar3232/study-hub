import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bookmark,
  BookmarkCheck,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  Share2,
  SmilePlus,
  Trash2,
  Users,
  Video,
  X
} from 'lucide-react';
import api from '../services/api';
import { optimizeImageFile, resolveMediaUrl } from '../utils/media';
import VideoThumbnail from './VideoThumbnail';

const QUICK_REACTIONS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F44F}'];
const MAX_HOME_POST_UPLOAD = 35 * 1024 * 1024;

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const privacyOptions = {
  public: { label: 'Public', helper: 'Everyone', icon: Globe2 },
  friends: { label: 'Friends', helper: 'Friends only', icon: Users },
  private: { label: 'Only me', helper: 'Private', icon: Lock }
};

const formatFeedTime = (value) => {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getPostTitle = (text, fallback = 'Timeline post') => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
};

const isVideoPost = (post) => (
  post?.fileType === 'video' || /\.(mp4|webm|mov|m4v)$/i.test(post?.fileUrl || '')
);

function Avatar({ user, size = 'h-11 w-11' }) {
  const avatar = resolveMediaUrl(user?.avatar);
  return (
    <span className={`${size} grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b57d0] to-[#2387a8] text-sm font-black text-white`}>
      {avatar ? <img src={avatar} alt={user?.name || 'User'} className="h-full w-full object-cover" /> : (user?.name || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

function PrivacyPill({ value = 'public' }) {
  const option = privacyOptions[value] || privacyOptions.public;
  const Icon = option.icon;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <Icon size={11} />
      {option.label}
    </span>
  );
}

export default function HomeFeed({ currentUser }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [composerHasText, setComposerHasText] = useState(false);
  const [privacy, setPrivacy] = useState('public');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [visibleCount, setVisibleCount] = useState(8);

  const composerInputRef = useRef(null);
  const currentUserId = getEntityId(currentUser);
  const canPost = Boolean(composerHasText || mediaFile) && !posting;
  const visiblePosts = useMemo(() => posts.slice(0, visibleCount), [posts, visibleCount]);
  const PrivacySelectIcon = privacyOptions[privacy]?.icon || Globe2;

  useEffect(() => () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
  }, [mediaPreview]);

  const loadFeed = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/posts/home?limit=24');
      setPosts(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to load home feed');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const updatePost = (nextPost) => {
    setPosts(prev => prev.map(post => getEntityId(post) === getEntityId(nextPost) ? nextPost : post));
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview('');
    setUploadProgress(0);
  };

  const selectMedia = (file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/') && !file.type?.startsWith('video/')) {
      toast.error('Home posts support photos and videos');
      return;
    }
    if (file.size > MAX_HOME_POST_UPLOAD) {
      toast.error('Media is too large. Maximum size is 35MB.');
      return;
    }

    clearMedia();
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const createPost = async (event) => {
    event.preventDefault();
    if (!canPost) return;

    setPosting(true);
    setUploadProgress(0);
    try {
      let uploadData = {};
      if (mediaFile) {
        const uploadFile = mediaFile.type.startsWith('image/')
          ? await optimizeImageFile(mediaFile, { maxDimension: 1600, quality: 0.84, minBytes: 700 * 1024 })
          : mediaFile;
        const formData = new FormData();
        formData.append('file', uploadFile);
        const uploadRes = await api.post('/posts/upload', formData, {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        });
        uploadData = uploadRes.data || {};
      }

      const text = String(composerInputRef.current?.value || '').trim();
      const res = await api.post('/posts/home', {
        title: getPostTitle(text, mediaFile ? mediaFile.name : 'Timeline post'),
        content: text,
        privacy,
        ...uploadData
      });
      setPosts(prev => [res.data, ...prev]);
      if (composerInputRef.current) composerInputRef.current.value = '';
      setComposerHasText(false);
      clearMedia();
      toast.success('Posted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Post failed');
    } finally {
      setPosting(false);
      setUploadProgress(0);
    }
  };

  const reactToPost = async (post, emoji) => {
    try {
      const res = await api.post(`/posts/${getEntityId(post)}/react`, { emoji });
      updatePost(res.data);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Reaction failed');
    }
  };

  const savePost = async (post) => {
    try {
      const res = await api.put(`/posts/${getEntityId(post)}/save`);
      updatePost(res.data);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Save failed');
    }
  };

  const deletePost = async (post) => {
    try {
      await api.delete(`/posts/${getEntityId(post)}`);
      setPosts(prev => prev.filter(item => getEntityId(item) !== getEntityId(post)));
      toast.success('Post deleted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Delete failed');
    }
  };

  const addComment = async (event, post) => {
    event.preventDefault();
    const postId = getEntityId(post);
    const text = String(commentDrafts[postId] || '').trim();
    if (!text) return;

    try {
      const res = await api.post(`/posts/${postId}/comment`, { text });
      updatePost(res.data);
      setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Comment failed');
    }
  };

  const sharePost = async (post) => {
    const text = `${post.userId?.name || 'SYNCROVA'}: ${post.title || 'Post'}`;
    const url = `${window.location.origin}/dashboard`;
    try {
      if (navigator.share) await navigator.share({ title: 'SYNCROVA post', text, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Dashboard link copied');
      }
    } catch {
      // Native share sheet was cancelled.
    }
  };

  return (
    <section className="home-feed space-y-4">
      <form onSubmit={createPost} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar user={currentUser} />
            <textarea
              ref={composerInputRef}
              onChange={event => {
                const hasText = Boolean(event.target.value.trim());
                setComposerHasText(prev => (prev === hasText ? prev : hasText));
              }}
              rows={3}
              placeholder={`What's on your mind, ${currentUser?.name?.split(' ')[0] || 'there'}?`}
              className="min-h-[5rem] min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none focus:border-[#0b57d0] focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
            />
          </div>

          {mediaFile && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950 dark:text-white">{mediaFile.name}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{Math.round(mediaFile.size / 1024)} KB</p>
                </div>
                <button type="button" onClick={clearMedia} className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-300" aria-label="Remove media">
                  <X size={16} />
                </button>
              </div>
              {mediaPreview && (
                mediaFile.type.startsWith('video/')
                  ? <VideoThumbnail src={mediaPreview} className="max-h-80 w-full" videoClassName="max-h-80 object-contain" iconSize={28} label="Post video preview" />
                  : <img src={mediaPreview} alt="Post preview" className="max-h-80 w-full object-contain" />
              )}
              {posting && uploadProgress > 0 && (
                <div className="h-1.5 bg-slate-200 dark:bg-slate-800">
                  <div className="h-full bg-[#0b57d0]" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/35 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
              <ImageIcon size={15} />
              Photo/video
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={event => selectMedia(event.target.files?.[0])}
              />
            </label>
            <label className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <PrivacySelectIcon size={15} />
              <select value={privacy} onChange={event => setPrivacy(event.target.value)} className="bg-transparent outline-none">
                <option value="public">Public</option>
                <option value="friends">Friends</option>
                <option value="private">Only me</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={!canPost}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#07036f] px-5 py-2.5 text-sm font-black text-white hover:bg-[#05004f] disabled:opacity-50"
          >
            {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Post
          </button>
        </div>
      </form>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Loading home feed...
        </div>
      ) : visiblePosts.length ? (
        <>
          {visiblePosts.map(post => {
            const postId = getEntityId(post);
            const author = post.userId || {};
            const mediaUrl = resolveMediaUrl(post.fileUrl);
            const myReaction = post.reactions?.find(reaction => getEntityId(reaction.userId) === currentUserId);
            const saved = post.savedBy?.some(userId => getEntityId(userId) === currentUserId);
            const isOwner = getEntityId(author) === currentUserId;

            return (
              <article key={postId} className="feed-card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
                <header className="flex items-start gap-3 p-4">
                  <Avatar user={author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-black text-slate-950 dark:text-white">{author.name || 'Member'}</p>
                      <PrivacyPill value={post.privacy} />
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatFeedTime(post.createdAt)}</p>
                  </div>
                  {isOwner && (
                    <button type="button" onClick={() => deletePost(post)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/35 dark:hover:text-rose-300" aria-label="Delete post">
                      <Trash2 size={16} />
                    </button>
                  )}
                </header>

                <div className="space-y-3 px-4 pb-4">
                  {post.content && <p className="whitespace-pre-wrap break-words text-[15px] leading-6 text-slate-800 dark:text-slate-100">{post.content}</p>}
                  {post.fileUrl && (
                    isVideoPost(post) ? (
                      <VideoThumbnail src={mediaUrl} className="max-h-[32rem] w-full rounded-2xl" videoClassName="max-h-[32rem] object-contain" iconSize={30} label={post.fileName || 'Post video'} />
                    ) : (
                      <img src={mediaUrl} alt={post.title || 'Post media'} loading="lazy" decoding="async" className="max-h-[34rem] w-full rounded-2xl object-cover" />
                    )
                  )}
                </div>

                <div className="mx-4 flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 py-2 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <span>{post.reactions?.length || 0} reactions</span>
                  <span>{post.comments?.length || 0} comments</span>
                </div>

                <div className="grid grid-cols-3 gap-1 px-4 py-2">
                  <div className="relative group/reactions">
                    <button
                      type="button"
                      onClick={() => reactToPost(post, myReaction?.emoji || QUICK_REACTIONS[0])}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${
                        myReaction ? 'bg-blue-50 text-[#0b57d0] dark:bg-blue-950/30 dark:text-sky-200' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <SmilePlus size={17} />
                      {myReaction?.emoji || 'React'}
                    </button>
                    <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 flex translate-y-1 gap-1 rounded-2xl border border-slate-200 bg-white p-1 opacity-0 shadow-xl group-hover/reactions:pointer-events-auto group-hover/reactions:translate-y-0 group-hover/reactions:opacity-100 dark:border-slate-700 dark:bg-slate-900">
                      {QUICK_REACTIONS.map(emoji => (
                        <button key={emoji} type="button" onClick={() => reactToPost(post, emoji)} className="grid h-9 w-9 place-items-center rounded-xl text-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => savePost(post)} className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                    {saved ? <BookmarkCheck size={17} className="text-[#0b57d0]" /> : <Bookmark size={17} />}
                    {saved ? 'Saved' : 'Save'}
                  </button>
                  <button type="button" onClick={() => sharePost(post)} className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                    <Share2 size={17} />
                    Share
                  </button>
                </div>

                <div className="space-y-2 px-4 pb-4">
                  {(post.comments || []).slice(-3).map((comment, index) => (
                    <div key={`${postId}-${index}-${comment.date}`} className="flex gap-2">
                      <Avatar user={comment.userId} size="h-8 w-8" />
                      <div className="min-w-0 rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-950">
                        <p className="text-xs font-black text-slate-950 dark:text-white">{comment.userId?.name || 'Member'}</p>
                        <p className="break-words text-sm text-slate-700 dark:text-slate-200">{comment.text}</p>
                      </div>
                    </div>
                  ))}
                  <form onSubmit={event => addComment(event, post)} className="flex items-center gap-2">
                    <Avatar user={currentUser} size="h-8 w-8" />
                    <input
                      value={commentDrafts[postId] || ''}
                      onChange={event => setCommentDrafts(prev => ({ ...prev, [postId]: event.target.value }))}
                      placeholder="Write a comment..."
                      className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#0b57d0] focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:bg-slate-950"
                    />
                    <button type="submit" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0b57d0] text-white disabled:opacity-50" disabled={!String(commentDrafts[postId] || '').trim()}>
                      <MessageCircle size={16} />
                    </button>
                  </form>
                </div>
              </article>
            );
          })}

          {visibleCount < posts.length && (
            <button type="button" onClick={() => setVisibleCount(count => count + 8)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#0b57d0] shadow-sm hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-blue-950/20">
              Load more posts
            </button>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <Video className="mx-auto text-[#0b57d0]" size={32} />
          <p className="mt-3 font-black text-slate-950 dark:text-white">No posts yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Share the first update from the composer above.</p>
        </div>
      )}
    </section>
  );
}
