import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Heart, Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { resolveMediaUrl } from '../utils/media';

const STORY_REACTIONS = ['❤️', '😂', '🔥', '👏', '😮'];
const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const formatStoryTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

const getPerson = (entry) => entry?.userId || entry || {};

function PersonRow({ person, meta, detail, right }) {
  const avatar = resolveMediaUrl(person?.avatar);
  const name = person?.name || 'Member';

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 text-white transition hover:bg-white/10">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-sm font-black text-white">
        {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black">{name}</span>
        {meta && <span className="block truncate text-xs font-semibold text-white/60">{meta}</span>}
        {detail && <span className="mt-1 block text-xs font-semibold leading-snug text-white/80">{detail}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </div>
  );
}

export default function StoryViewer({
  story,
  stories = [],
  currentUser,
  onClose,
  onNavigate,
  onReact,
  onComment,
  onDelete,
  zIndexClass = 'z-[95]'
}) {
  const [comment, setComment] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [activePanel, setActivePanel] = useState('viewers');

  const storyList = useMemo(() => {
    const source = Array.isArray(stories) && stories.length ? stories : story ? [story] : [];
    const seen = new Set();
    return source.filter(item => {
      const id = getEntityId(item);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [stories, story]);

  const activeIndex = Math.max(0, storyList.findIndex(item => getEntityId(item) === getEntityId(story)));
  const currentStory = storyList[activeIndex] || story;
  const hasMultipleStories = storyList.length > 1;
  const owner = currentStory?.userId || {};
  const isOwner = getEntityId(owner) === getEntityId(currentUser);
  const viewers = currentStory?.viewers || [];
  const reactions = currentStory?.reactions || [];
  const comments = currentStory?.comments || [];

  const reactionSummary = useMemo(() => (
    Object.entries(reactions.reduce((summary, reaction) => {
      if (!reaction?.emoji) return summary;
      summary[reaction.emoji] = (summary[reaction.emoji] || 0) + 1;
      return summary;
    }, {}))
  ), [reactions]);

  const reactionByUser = useMemo(() => {
    const map = new Map();
    reactions.forEach(reaction => {
      const id = getEntityId(reaction.userId);
      if (id) map.set(id, reaction);
    });
    return map;
  }, [reactions]);
  const currentUserReaction = reactionByUser.get(getEntityId(currentUser));

  if (!currentStory) return null;

  const ownerAvatar = resolveMediaUrl(owner?.avatar);

  const goToStory = async (direction) => {
    if (!hasMultipleStories || !onNavigate) return;
    const nextIndex = direction === 'next'
      ? (activeIndex + 1) % storyList.length
      : (activeIndex - 1 + storyList.length) % storyList.length;
    setComment('');
    setPendingAction('');
    setActivePanel('viewers');
    await onNavigate(storyList[nextIndex]);
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const text = comment.trim();
    if (!text || !onComment || pendingAction) return;

    setPendingAction('comment');
    try {
      await onComment(currentStory, text);
      setComment('');
    } finally {
      setPendingAction('');
    }
  };

  const reactToStory = async (emoji) => {
    if (!onReact || pendingAction) return;
    setPendingAction(`react-${emoji}`);
    try {
      await onReact(currentStory, emoji);
    } finally {
      setPendingAction('');
    }
  };

  const deleteStory = async () => {
    if (!onDelete || pendingAction) return;
    setPendingAction('delete');
    try {
      await onDelete(getEntityId(currentStory));
    } finally {
      setPendingAction('');
    }
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/95 p-2 backdrop-blur-sm sm:p-4`}
      onMouseDown={event => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className={`relative grid h-[min(94svh,840px)] w-full overflow-hidden rounded-3xl bg-black shadow-2xl ${
          isOwner
            ? 'max-w-6xl grid-rows-[minmax(0,1fr)_minmax(14rem,17rem)] md:grid-cols-[minmax(0,1fr)_22rem] md:grid-rows-1'
            : 'max-w-[430px]'
        }`}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="relative min-h-0 overflow-hidden bg-black">
          {currentStory.fileType === 'image' ? (
            <img src={resolveMediaUrl(currentStory.fileUrl)} alt={currentStory.caption || 'My Day'} className="h-full w-full object-contain" />
          ) : (
            <video key={getEntityId(currentStory)} src={resolveMediaUrl(currentStory.fileUrl)} controls autoPlay playsInline className="h-full w-full object-contain" />
          )}

          <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
            {hasMultipleStories && (
              <div className="mb-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${storyList.length}, minmax(0, 1fr))` }}>
                {storyList.map((item, index) => (
                  <span key={getEntityId(item)} className="h-1 overflow-hidden rounded-full bg-white/25">
                    <span className={`block h-full rounded-full bg-white transition ${index <= activeIndex ? 'w-full' : 'w-0'}`} />
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#1877f2] to-[#00b2ff] text-sm font-black text-white ring-2 ring-[#1877f2]">
                  {ownerAvatar ? <img src={ownerAvatar} alt={owner?.name || 'Member'} className="h-full w-full object-cover" /> : (owner?.name || 'M').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{owner?.name || 'Member'}</span>
                  <span className="block truncate text-xs font-semibold text-white/60">My Day{hasMultipleStories ? ` · ${activeIndex + 1} of ${storyList.length}` : ''}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && onDelete && (
                  <button
                    type="button"
                    onClick={deleteStory}
                    disabled={pendingAction === 'delete'}
                    className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-rose-500 disabled:opacity-50"
                    aria-label="Delete My Day"
                  >
                    {pendingAction === 'delete' ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-white/20"
                  aria-label="Close My Day"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {hasMultipleStories && (
            <>
              <button
                type="button"
                onClick={() => goToStory('previous')}
                className="absolute left-3 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                aria-label="Previous My Day"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={() => goToStory('next')}
                className="absolute right-3 top-1/2 z-30 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
                aria-label="Next My Day"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {isOwner && currentStory.caption && (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-16 text-white">
              <p className="text-sm font-bold">{currentStory.caption}</p>
            </div>
          )}

          {!isOwner && (
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-20 text-white">
              {currentStory.caption && <p className="mb-3 text-sm font-bold leading-snug">{currentStory.caption}</p>}
              <div className="mb-3 flex items-center justify-center gap-2">
                {STORY_REACTIONS.map(emoji => {
                  const isSelected = currentUserReaction?.emoji === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => reactToStory(emoji)}
                      disabled={Boolean(pendingAction)}
                      className={`grid h-11 w-11 place-items-center rounded-full text-xl shadow-lg backdrop-blur transition hover:-translate-y-0.5 disabled:opacity-50 ${
                        isSelected ? 'bg-[#1877f2] ring-2 ring-white/70' : 'bg-black/40 ring-1 ring-white/10 hover:bg-white/20'
                      }`}
                      aria-label={`React ${emoji}`}
                    >
                      {pendingAction === `react-${emoji}` ? <Loader2 size={16} className="animate-spin" /> : emoji}
                    </button>
                  );
                })}
              </div>
              {reactionSummary.length > 0 && (
                <div className="mb-3 flex justify-center">
                  <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10 backdrop-blur">
                    {reactionSummary.slice(0, 3).map(([emoji]) => <span key={emoji}>{emoji}</span>)}
                    <span className="ml-1 text-white/70">{reactions.length}</span>
                  </div>
                </div>
              )}
              {onComment && (
                <form onSubmit={submitComment} className="flex items-center gap-2 rounded-full bg-black/50 p-1.5 ring-1 ring-white/10 backdrop-blur">
                  <input
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    placeholder="Reply to story..."
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-semibold text-white outline-none placeholder:text-white/50"
                  />
                  <button
                    type="submit"
                    disabled={pendingAction === 'comment' || !comment.trim()}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1877f2] text-white transition hover:bg-[#0f63d5] disabled:opacity-50"
                    aria-label="Send My Day reply"
                  >
                    {pendingAction === 'comment' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {isOwner && (
          <aside className="flex min-h-0 flex-col border-t border-white/10 bg-[#090d16] text-white md:border-l md:border-t-0">
            <div className="border-b border-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#8ec5ff]">My Day activity</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <Eye className="mx-auto text-[#1877f2]" size={18} />
                  <p className="mt-1 text-lg font-black">{viewers.length}</p>
                  <p className="text-[11px] font-bold text-white/60">Viewers</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <Heart className="mx-auto text-pink-500" size={18} />
                  <p className="mt-1 text-lg font-black">{reactions.length}</p>
                  <p className="text-[11px] font-bold text-white/60">Reacts</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <MessageCircle className="mx-auto text-emerald-500" size={18} />
                  <p className="mt-1 text-lg font-black">{comments.length}</p>
                  <p className="text-[11px] font-bold text-white/60">Replies</p>
                </div>
              </div>
              {reactionSummary.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {reactionSummary.map(([emoji, count]) => (
                    <span key={emoji} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white">
                      {emoji} {count}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => setActivePanel('viewers')}
                  className={`rounded-xl px-2 py-2 text-xs font-black transition ${activePanel === 'viewers' ? 'bg-white text-[#1877f2]' : 'text-white/60 hover:text-white'}`}
                >
                  Viewers
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('reactions')}
                  className={`rounded-xl px-2 py-2 text-xs font-black transition ${activePanel === 'reactions' ? 'bg-white text-pink-600' : 'text-white/60 hover:text-white'}`}
                >
                  Reactions
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('replies')}
                  className={`rounded-xl px-2 py-2 text-xs font-black transition ${activePanel === 'replies' ? 'bg-white text-emerald-600' : 'text-white/60 hover:text-white'}`}
                >
                  Replies
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {activePanel === 'viewers' ? (
                viewers.length ? viewers.map(viewer => {
                  const person = getPerson(viewer);
                  const reaction = reactionByUser.get(getEntityId(person));
                  return (
                    <PersonRow
                      key={`${getEntityId(person)}-${viewer.viewedAt || ''}`}
                      person={person}
                      meta={formatStoryTime(viewer.viewedAt) || 'Viewed'}
                      right={reaction?.emoji ? <span className="text-xl">{reaction.emoji}</span> : null}
                    />
                  );
                }) : (
                  <p className="rounded-2xl border border-dashed border-white/20 p-4 text-center text-sm font-semibold text-white/60">No viewers yet.</p>
                )
              ) : activePanel === 'reactions' ? reactions.length ? reactions.map((reaction, index) => {
                const person = getPerson(reaction);
                return (
                  <PersonRow
                    key={`${getEntityId(person)}-${reaction.emoji}-${index}`}
                    person={person}
                    meta={formatStoryTime(reaction.createdAt) || 'Reacted'}
                    right={<span className="text-xl">{reaction.emoji}</span>}
                  />
                );
              }) : (
                <p className="rounded-2xl border border-dashed border-white/20 p-4 text-center text-sm font-semibold text-white/60">No reactions yet.</p>
              ) : comments.length ? comments.map((reply, index) => {
                const person = getPerson(reply);
                return (
                  <PersonRow
                    key={`${getEntityId(person)}-${reply.createdAt || index}`}
                    person={person}
                    meta={formatStoryTime(reply.createdAt) || 'Replied'}
                    detail={reply.text}
                    right={<MessageCircle size={16} className="text-emerald-300" />}
                  />
                );
              }) : (
                <p className="rounded-2xl border border-dashed border-white/20 p-4 text-center text-sm font-semibold text-white/60">No replies yet.</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
