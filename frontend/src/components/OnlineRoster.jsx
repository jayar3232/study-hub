import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { usePresence } from '../context/PresenceContext';
import { resolveMediaUrl } from '../utils/media';
import UserProfileModal from './UserProfileModal';

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

export default function OnlineRoster({ compact = false, limit = 10, title = 'Online now' }) {
  const { onlinePeople, hasStory } = usePresence();
  const [profileUser, setProfileUser] = useState(null);
  const visiblePeople = onlinePeople.slice(0, limit);

  return (
    <section className={`rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-950/45 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-gray-950 dark:text-white">
            <Users size={16} className="text-emerald-500" />
            {title}
          </p>
          {!compact && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{onlinePeople.length} active user{onlinePeople.length === 1 ? '' : 's'}</p>}
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/60">
          {onlinePeople.length}
        </span>
      </div>

      {visiblePeople.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 px-3 py-4 text-center text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
          No users online right now.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visiblePeople.map(person => {
            const avatar = resolveMediaUrl(person.avatar);
            const storyActive = hasStory(person);
            return (
              <button
                key={getEntityId(person)}
                type="button"
                onClick={() => setProfileUser(person)}
                className={`${compact ? 'w-14' : 'w-16'} shrink-0 text-center`}
                title={person.name}
              >
                <span className={`relative mx-auto grid ${compact ? 'h-11 w-11' : 'h-12 w-12'} place-items-center rounded-full ${storyActive ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-950' : 'ring-1 ring-gray-200 dark:ring-gray-800'}`}>
                  <span className="absolute bottom-0 right-0 z-10 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-950" />
                  <span className="h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-indigo-500 text-sm font-black text-white">
                    {avatar ? <img src={avatar} alt={person.name || 'User'} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">{person.name?.charAt(0)?.toUpperCase() || 'U'}</span>}
                  </span>
                </span>
                {!compact && <span className="mt-1 block truncate text-[11px] font-bold text-gray-600 dark:text-gray-300">{person.name}</span>}
              </button>
            );
          })}
        </div>
      )}

      <UserProfileModal isOpen={Boolean(profileUser)} user={profileUser} onClose={() => setProfileUser(null)} />
    </section>
  );
}
