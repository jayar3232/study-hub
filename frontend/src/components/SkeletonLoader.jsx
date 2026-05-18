import React from 'react';

const lineWidths = ['w-3/5', 'w-11/12', 'w-4/5'];

export const SkeletonBlock = ({ className = '' }) => (
  <span className={`skeleton-block block rounded-full bg-slate-200 dark:bg-slate-800 ${className}`} />
);

export const SkeletonCard = ({ lines = 3, media = false, compact = false }) => (
  <div className={`mobile-skeleton-card rounded-[1.2rem] border border-slate-200 bg-white/92 p-4 shadow-sm shadow-slate-200/45 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 ${compact ? 'space-y-3' : 'space-y-4'}`}>
    <div className="flex items-center gap-3">
      <SkeletonBlock className="h-11 w-11 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-3.5 w-2/5" />
        <SkeletonBlock className="h-3 w-3/5" />
      </div>
    </div>
    {media && <SkeletonBlock className="aspect-[16/9] w-full rounded-2xl" />}
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock key={index} className={`h-3 ${lineWidths[index % lineWidths.length]}`} />
      ))}
    </div>
  </div>
);

export const CardGridSkeleton = ({ count = 6, media = false }) => (
  <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} media={media} lines={media ? 3 : 2} />
    ))}
  </section>
);

export const ListSkeleton = ({ count = 5 }) => (
  <section className="space-y-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} compact lines={2} />
    ))}
  </section>
);

export const PageSkeleton = ({ variant = 'default', rows = 5 }) => {
  const isFeed = variant === 'feed' || variant === 'dashboard';
  const isGrid = ['marketplace', 'saved', 'search', 'cards'].includes(variant);

  return (
    <div className="mobile-page mx-auto max-w-7xl space-y-4 px-0 py-1 sm:px-6 sm:py-4 lg:px-8" role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <section className="mobile-skeleton-card rounded-[1.45rem] border border-slate-200 bg-white/92 p-5 shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900/92 dark:shadow-black/25">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-44" />
            <SkeletonBlock className="h-3 w-72 max-w-full" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(item => <SkeletonBlock key={item} className="h-10 rounded-xl" />)}
        </div>
      </section>

      {isFeed ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {Array.from({ length: rows }).map((_, index) => (
              <SkeletonCard key={index} media lines={3} />
            ))}
          </div>
          <div className="hidden space-y-4 lg:block">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </section>
      ) : isGrid ? (
        <CardGridSkeleton count={Math.max(3, rows)} media={variant === 'marketplace' || variant === 'saved'} />
      ) : (
        <ListSkeleton count={rows} />
      )}
    </div>
  );
};

export const GroupSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 animate-pulse">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
    <div className="flex gap-2 mt-4">
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
      <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

export const PostSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 animate-pulse">
    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
    <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded w-full mb-3"></div>
    <div className="flex gap-2">
      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

export const MessageSkeleton = () => (
  <div className="flex justify-start mb-3 animate-pulse">
    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full mr-2"></div>
    <div className="flex-1">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
    </div>
  </div>
);
