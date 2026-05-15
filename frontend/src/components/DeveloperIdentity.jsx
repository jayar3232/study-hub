import React from 'react';
import { BadgeCheck, Code2 } from 'lucide-react';

export const isDeveloperUser = (user) => Boolean(user?.isDeveloper);

export function DeveloperBadge({ user, compact = false, className = '' }) {
  if (!isDeveloperUser(user)) return null;

  return (
    <span
      className={`developer-badge developer-motion-zone inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#061528] px-2.5 py-1 text-[10px] font-black uppercase text-sky-50 ring-1 ring-sky-300/55 dark:bg-[#061528] dark:text-sky-50 dark:ring-sky-200/70 ${className}`}
      title="Verified developer"
    >
      <Code2 size={compact ? 11 : 13} className="text-sky-200" />
      {compact ? 'Dev' : 'Developer'}
      <BadgeCheck size={compact ? 11 : 13} className="fill-sky-300 text-[#061528]" />
    </span>
  );
}

export function DeveloperAvatarFrame({ user, children, className = '' }) {
  const developer = isDeveloperUser(user);

  return (
    <span className={`developer-avatar-frame developer-motion-zone relative inline-grid shrink-0 place-items-center ${developer ? 'is-developer' : ''} ${className}`}>
      {children}
      {developer && (
        <>
          <span className="developer-supernova-ring" aria-hidden="true" />
          <span className="developer-spark developer-spark-one" aria-hidden="true" />
          <span className="developer-spark developer-spark-two" aria-hidden="true" />
          <span className="developer-spark developer-spark-three" aria-hidden="true" />
          <span className="developer-verified-node" aria-label="Verified developer">
            <Code2 size={11} />
          </span>
        </>
      )}
    </span>
  );
}

export function DeveloperName({ user, children, compact = false, className = '' }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="min-w-0 truncate">{children || user?.name || 'Member'}</span>
      <DeveloperBadge user={user} compact={compact} />
    </span>
  );
}
