import React from 'react';
import { BadgeCheck, Code2 } from 'lucide-react';

export const isDeveloperUser = (user) => Boolean(user?.isDeveloper);

export function DeveloperBadge({ user, compact = false, className = '' }) {
  if (!isDeveloperUser(user)) return null;

  return (
    <span
      className={`developer-badge inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase text-white ring-1 ring-slate-700/60 dark:bg-white dark:text-slate-950 dark:ring-white/80 ${className}`}
      title="Verified developer"
    >
      <Code2 size={compact ? 11 : 13} className="text-sky-300 dark:text-[#0b57d0]" />
      {compact ? 'Dev' : 'Developer'}
      <BadgeCheck size={compact ? 11 : 13} className="fill-sky-400 text-slate-950 dark:fill-[#0b57d0] dark:text-white" />
    </span>
  );
}

export function DeveloperAvatarFrame({ user, children, className = '' }) {
  const developer = isDeveloperUser(user);

  return (
    <span className={`developer-avatar-frame relative inline-grid shrink-0 place-items-center ${developer ? 'is-developer' : ''} ${className}`}>
      {children}
      {developer && (
        <span className="developer-verified-node" aria-label="Verified developer">
          <Code2 size={11} />
        </span>
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
