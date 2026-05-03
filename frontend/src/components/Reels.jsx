import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Heart,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Send,
  Upload
} from 'lucide-react';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/media';

const getMemoryId = (memory) => String(memory?._id || memory?.id || memory?.videoId || '');

const formatCount = (value = 0) => {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
};

function MemoryPlayer({ memory, active }) {
  const videoRef = useRef(null);
  const mediaSrc = resolveMediaUrl(memory?.embedUrl || memory?.sourceUrl);
  const isVideo = memory?.mediaType === 'video';
  const isImage = memory?.mediaType === 'image';

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return undefined;

    if (active) {
      video.muted = true;
      video.play().catch(() => {});
    } else {
      video.pause();
    }

    return undefined;
  }, [active, isVideo, mediaSrc]);

  if (!mediaSrc) {
    return (
      <div className="grid h-full w-full place-items-center bg-gray-950 text-white">
        <div className="text-center">
          <ImageIcon size={36} className="mx-auto opacity-80" />
          <p className="mt-2 text-sm font-black">Gallery item unavailable</p>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="reel-player relative h-full w-full overflow-hidden bg-black">
        <img
          src={mediaSrc}
          alt={memory?.title || 'Memory'}
          loading={active ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="reel-player relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={mediaSrc}
        controls
        playsInline
        loop
        muted
        autoPlay={Boolean(active)}
        preload={active ? 'auto' : 'metadata'}
        className="h-full w-full object-contain"
      />
      {!isVideo && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-white">
          <Play size={34} />
        </div>
      )}
    </div>
  );
}

function MemoryActionButton({ active, children, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`reel-action-button ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );
}

function MemoryCard({ memory, active, onReact, onSave, onView }) {
  const viewedRef = useRef(false);
  const memoryId = getMemoryId(memory);

  useEffect(() => {
    if (!active || viewedRef.current) return;
    viewedRef.current = true;
    onView(memory);
  }, [active, onView, memory]);

  return (
    <article
      className="reel-card relative flex h-full min-h-0 snap-start items-center justify-center overflow-hidden border border-white/10 bg-black text-white"
      data-reel-id={memoryId}
    >
      <div className="reel-player-shell">
        <MemoryPlayer memory={memory} active={active} />
      </div>

      <div className="reel-gesture-zone reel-gesture-zone--left" aria-hidden="true" />
      <div className="reel-gesture-zone reel-gesture-zone--right" aria-hidden="true" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 text-white">
        <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-black">Gallery</span>
        <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-black">
          {memory.mediaType === 'image' ? 'Photo' : 'Video'}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 pr-20 text-white">
        <div className="reel-caption-panel">
          <h2 className="line-clamp-2 text-lg font-black leading-tight">{memory.title || 'Gallery item'}</h2>
          <p className="mt-1 line-clamp-2 text-xs font-semibold text-white/75">
            {memory.caption || (memory.mediaType === 'image' ? 'Photo' : 'Video')}
          </p>
        </div>
      </div>

      <div className="absolute bottom-5 right-3 z-30 flex flex-col items-center gap-3">
        <MemoryActionButton active={memory.reacted} label="React to memory" onClick={() => onReact(memory)}>
          <Heart size={21} fill={memory.reacted ? 'currentColor' : 'none'} />
          <span>{formatCount(memory.reactionCount)}</span>
        </MemoryActionButton>
        <MemoryActionButton active={memory.saved} label="Save memory" onClick={() => onSave(memory)}>
          <Bookmark size={21} fill={memory.saved ? 'currentColor' : 'none'} />
          <span>{formatCount(memory.savedCount)}</span>
        </MemoryActionButton>
      </div>
    </article>
  );
}

export default function Reels() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMemoryId, setActiveMemoryId] = useState('');
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryPreview, setGalleryPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const feedRef = useRef(null);
  const touchStartYRef = useRef(0);
  const wheelLockedRef = useRef(false);

  const activeMemory = useMemo(() => (
    memories.find(memory => getMemoryId(memory) === activeMemoryId) || memories[0]
  ), [activeMemoryId, memories]);

  const activeIndex = useMemo(() => {
    const index = memories.findIndex(memory => getMemoryId(memory) === getMemoryId(activeMemory));
    return index >= 0 ? index : 0;
  }, [activeMemory, memories]);

  const scrollToMemory = useCallback((memoryId) => {
    const root = feedRef.current;
    if (!root || !memoryId) return;
    const target = Array.from(root.querySelectorAll('[data-reel-id]'))
      .find(node => node.getAttribute('data-reel-id') === String(memoryId));
    if (!target) return;
    root.scrollTo({ top: target.offsetTop, behavior: 'auto' });
    setActiveMemoryId(String(memoryId));
  }, []);

  const goToMemory = useCallback((direction) => {
    if (!memories.length) return;
    const nextIndex = (activeIndex + direction + memories.length) % memories.length;
    scrollToMemory(getMemoryId(memories[nextIndex]));
  }, [activeIndex, memories, scrollToMemory]);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reels');
      const nextMemories = res.data?.gallery || res.data?.memories || res.data?.reels || [];
      const firstId = getMemoryId(nextMemories[0]);
      setMemories(nextMemories);
      setActiveMemoryId(firstId);
      window.setTimeout(() => scrollToMemory(firstId), 0);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [scrollToMemory]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  useEffect(() => () => {
    if (galleryPreview) URL.revokeObjectURL(galleryPreview);
  }, [galleryPreview]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || !memories.length) return undefined;

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const nextId = visible?.target?.getAttribute('data-reel-id');
      if (nextId) setActiveMemoryId(nextId);
    }, { root, threshold: [0.6, 0.82] });

    root.querySelectorAll('[data-reel-id]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [memories]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || event.target?.isContentEditable) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        goToMemory(1);
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        goToMemory(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToMemory]);

  const updateMemory = (updatedMemory) => {
    if (!updatedMemory) return;
    setMemories(prev => prev.map(memory => getMemoryId(memory) === getMemoryId(updatedMemory) ? updatedMemory : memory));
  };

  const clearUploadForm = () => {
    setGalleryTitle('');
    setGalleryCaption('');
    setGalleryFile(null);
    setGalleryPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  };

  const handleGalleryFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Gallery supports photos and videos only');
      return;
    }
    setGalleryFile(file);
    setGalleryPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    if (!galleryTitle.trim()) {
      setGalleryTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
    }
  };

  const handleUploadGallery = async (event) => {
    event.preventDefault();
    const title = galleryTitle.trim();
    if (!title) {
      toast.error('Add a gallery title');
      return;
    }
    if (!galleryFile) {
      toast.error('Choose a photo or video');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('caption', galleryCaption.trim());
    formData.append('media', galleryFile);

    setUploading(true);
    try {
      const res = await api.post('/reels', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const nextItem = res.data?.galleryItem || res.data?.reel;
      if (nextItem) {
        setMemories(prev => [nextItem, ...prev.filter(item => getMemoryId(item) !== getMemoryId(nextItem))]);
        setActiveMemoryId(getMemoryId(nextItem));
        window.setTimeout(() => scrollToMemory(getMemoryId(nextItem)), 0);
      }
      clearUploadForm();
      toast.success('Added to Gallery');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Gallery upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleReact = async (memory) => {
    try {
      const res = await api.post(`/reels/${getMemoryId(memory)}/react`, { type: 'like' });
      updateMemory(res.data?.reel);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Reaction failed');
    }
  };

  const handleSave = async (memory) => {
    if (memory.readonlySave) {
      toast('This gallery item cannot be saved yet.');
      return;
    }

    try {
      const res = await api.post(`/reels/${getMemoryId(memory)}/save`);
      updateMemory(res.data?.reel);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Save failed');
    }
  };

  const handleView = useCallback((memory) => {
    api.post(`/reels/${getMemoryId(memory)}/view`).catch(() => {});
  }, []);

  const handleComment = async (event) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!activeMemory || !text) return;

    try {
      const res = await api.post(`/reels/${getMemoryId(activeMemory)}/comment`, { text });
      updateMemory(res.data?.reel);
      setCommentText('');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Comment failed');
    }
  };

  const handleWheel = (event) => {
    if (Math.abs(event.deltaY) < 42 || wheelLockedRef.current) return;
    event.preventDefault();
    wheelLockedRef.current = true;
    goToMemory(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => {
      wheelLockedRef.current = false;
    }, 220);
  };

  const handleTouchStart = (event) => {
    touchStartYRef.current = event.touches?.[0]?.clientY || 0;
  };

  const handleTouchEnd = (event) => {
    const endY = event.changedTouches?.[0]?.clientY || 0;
    const deltaY = touchStartYRef.current - endY;
    if (Math.abs(deltaY) < 48) return;
    goToMemory(deltaY > 0 ? 1 : -1);
  };

  const renderUploadForm = (compact = false) => (
    <form onSubmit={handleUploadGallery} className="space-y-2">
      <input
        value={galleryTitle}
        onChange={event => setGalleryTitle(event.target.value)}
        placeholder="Gallery title"
        className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-950 outline-none focus:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
      />
      {!compact && (
        <textarea
          value={galleryCaption}
          onChange={event => setGalleryCaption(event.target.value)}
          placeholder="Short caption"
          rows={2}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-950 outline-none focus:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
        />
      )}
      {galleryPreview && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-950 dark:border-gray-800">
          {galleryFile?.type?.startsWith('image/') ? (
            <img src={galleryPreview} alt="Gallery preview" className="max-h-36 w-full object-contain" />
          ) : (
            <video src={galleryPreview} className="max-h-36 w-full object-contain" muted playsInline controls />
          )}
        </div>
      )}
      <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 text-sm font-black text-[#1877f2] dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-sky-200">
        <ImageIcon size={16} />
        {galleryFile ? 'Change media' : 'Choose media'}
        <input
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={event => handleGalleryFile(event.target.files?.[0])}
        />
      </label>
      <button
        type="submit"
        disabled={uploading || !galleryFile || !galleryTitle.trim()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1877f2] px-4 text-sm font-black text-white disabled:opacity-50"
      >
        {uploading ? <Loader2 size={16} /> : <Upload size={16} />}
        Add to Gallery
      </button>
    </form>
  );

  return (
    <main className="reels-page mx-auto grid w-full max-w-[82rem] gap-3 lg:grid-cols-[18rem_minmax(20rem,34rem)_20rem]">
      <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="flex items-center gap-2 text-xs font-black uppercase text-[#1877f2] dark:text-sky-300">
            <Clapperboard size={15} />
            Gallery
          </p>
          <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">SYNCROVA Gallery</h1>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Your uploaded photos and videos</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="mb-3 text-sm font-black text-gray-950 dark:text-white">Add media</p>
          {renderUploadForm(false)}
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-gray-950 dark:text-white">Items</p>
            <button
              type="button"
              onClick={loadMemories}
              className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
              aria-label="Refresh memories"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="reels-queue space-y-2 overflow-y-auto pr-1">
            {memories.map(memory => (
              <button
                key={`queue-${getMemoryId(memory)}`}
                type="button"
                onClick={() => scrollToMemory(getMemoryId(memory))}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${
                  getMemoryId(activeMemory) === getMemoryId(memory)
                    ? 'bg-blue-50 text-[#1877f2] dark:bg-blue-950/30 dark:text-sky-200'
                    : 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                <span className="block truncate">{memory.title || 'Gallery item'}</span>
                <span className="block truncate text-xs opacity-70">{memory.mediaType === 'image' ? 'Photo' : 'Video'}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="reels-stage min-h-0">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-gray-950 dark:text-white">Gallery</p>
              <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                {activeMemory?.title || 'Upload photos and videos'}
              </p>
            </div>
            <button
              type="button"
              onClick={loadMemories}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
              aria-label="Refresh memories"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="mt-3">
            {renderUploadForm(true)}
          </div>
        </div>

        <div className="reels-feed-shell relative min-h-0">
          <div
            ref={feedRef}
            className="reels-feed h-full overflow-y-auto overscroll-contain rounded-2xl bg-black"
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {loading ? (
              <div className="grid h-full place-items-center text-white">
                <div className="text-center">
                  <Loader2 size={28} className="mx-auto" />
                  <p className="mt-3 text-sm font-black text-white/75">Loading gallery</p>
                </div>
              </div>
            ) : memories.length ? (
              memories.map(memory => (
                <MemoryCard
                  key={getMemoryId(memory)}
                  memory={memory}
                  active={getMemoryId(memory) === getMemoryId(activeMemory)}
                  onReact={handleReact}
                  onSave={handleSave}
                  onView={handleView}
                />
              ))
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-white">
                <div>
                  <ImageIcon size={38} className="mx-auto" />
                  <h2 className="mt-3 text-xl font-black">No gallery items yet</h2>
                </div>
              </div>
            )}
          </div>

          {memories.length > 1 && (
            <div className="pointer-events-none absolute right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-3">
              <button
                type="button"
                onClick={() => goToMemory(-1)}
                className="reel-step-button pointer-events-auto"
                aria-label="Previous memory"
              >
                <ChevronUp size={24} />
              </button>
              <button
                type="button"
                onClick={() => goToMemory(1)}
                className="reel-step-button pointer-events-auto"
                aria-label="Next memory"
              >
                <ChevronDown size={24} />
              </button>
            </div>
          )}
        </div>
      </section>

      <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm font-black text-gray-950 dark:text-white">Title</p>
          <h2 className="mt-3 line-clamp-3 text-xl font-black leading-tight text-gray-950 dark:text-white">
            {activeMemory?.title || 'Gallery item'}
          </h2>
          {activeMemory?.caption && (
            <p className="mt-2 text-sm font-bold leading-6 text-gray-500 dark:text-gray-400">{activeMemory.caption}</p>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900">
              <p className="text-base font-black text-gray-950 dark:text-white">{formatCount(activeMemory?.reactionCount)}</p>
              <p className="text-[11px] font-black uppercase text-gray-400">Likes</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900">
              <p className="text-base font-black text-gray-950 dark:text-white">{formatCount(activeMemory?.savedCount)}</p>
              <p className="text-[11px] font-black uppercase text-gray-400">Saved</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 text-center dark:bg-gray-900">
              <p className="text-base font-black text-gray-950 dark:text-white">{formatCount(activeMemory?.viewCount)}</p>
              <p className="text-[11px] font-black uppercase text-gray-400">Views</p>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-sm font-black text-gray-950 dark:text-white">Comments</p>
          <div className="mt-3 max-h-[18rem] space-y-2 overflow-y-auto pr-1">
            {(activeMemory?.comments || []).length ? activeMemory.comments.map(comment => (
              <div key={comment._id || `${comment.text}-${comment.createdAt}`} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
                <p className="text-xs font-black text-gray-500 dark:text-gray-400">{comment.userId?.name || 'Member'}</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{comment.text}</p>
              </div>
            )) : (
              <p className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">No comments yet.</p>
            )}
          </div>
          <form onSubmit={handleComment} className="mt-3 flex gap-2">
            <input
              value={commentText}
              onChange={event => setCommentText(event.target.value)}
              placeholder="Write a comment"
              className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-950 outline-none focus:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!activeMemory || !commentText.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1877f2] text-white disabled:opacity-50"
              aria-label="Post comment"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      </aside>
    </main>
  );
}
