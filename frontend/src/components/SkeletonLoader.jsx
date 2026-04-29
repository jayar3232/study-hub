import React from 'react';

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