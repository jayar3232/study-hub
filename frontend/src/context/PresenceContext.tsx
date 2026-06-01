import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
// utils/stories.js is still untyped; allowJs in tsconfig handles the import.
import { groupActiveStoriesByOwner } from '../utils/stories';
import type { EntityRef, PublicUser, Story, StoryGroup, User } from '../types/models';

/**
 * Anything we might receive as a presence payload from the socket or REST
 * endpoints. The server isn't 100% consistent (sometimes `{ userId }`,
 * sometimes a bare string, sometimes the full user doc), so the normalizers
 * below handle every shape we've observed in the wild.
 */
type PresencePayload =
  | string
  | {
      userId?: EntityRef;
      _id?: string;
      id?: string;
      online?: boolean;
      status?: string;
      lastSeen?: string | number | Date;
      userIds?: EntityRef[];
      users?: EntityRef[];
    }
  | EntityRef[]
  | null
  | undefined;

export interface PresenceContextValue {
  onlineUserIds: string[];
  onlineSet: Set<string>;
  people: PublicUser[];
  stories: Story[];
  storyGroups: StoryGroup[];
  storiesByUser: Map<string, Story[]>;
  onlinePeople: PublicUser[];
  isUserOnline: (personOrId: EntityRef) => boolean;
  hasStory: (personOrId: EntityRef) => boolean;
  refreshPresence: () => Promise<void> | void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

const getEntityId = (entity: EntityRef | PresencePayload): string => {
  if (entity == null) return '';
  if (typeof entity === 'string') return entity;
  if (Array.isArray(entity)) return '';
  const candidate = entity as { _id?: string; id?: string };
  return String(candidate._id || candidate.id || '');
};

const getPresencePayloadUserId = (payload: PresencePayload): string => {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return '';
  return getEntityId(payload.userId || payload._id || payload.id || payload);
};

const normalizeOnlineIds = (payload: PresencePayload): string[] => {
  let ids: EntityRef[] = [];
  if (Array.isArray(payload)) {
    ids = payload;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.userIds)) ids = payload.userIds;
    else if (Array.isArray(payload.users)) ids = payload.users;
  }
  return [...new Set(ids.map(getEntityId).filter(Boolean))];
};

const fetchPublicPeopleByIds = async (ids: string[]): Promise<PublicUser[]> => {
  const results = await Promise.all(
    ids.map((id) =>
      api
        .get<PublicUser>(`/users/${id}/public`)
        .then((res) => res.data)
        .catch(() => null),
    ),
  );
  return results.filter((person): person is PublicUser => Boolean(person));
};

interface PresenceProviderProps {
  children: ReactNode;
}

export const PresenceProvider: React.FC<PresenceProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const hydratedOnlineIdsRef = useRef<Set<string>>(new Set());
  const currentUserId = getEntityId(user);

  const hydrateOnlinePeople = async (ids: EntityRef[] = []): Promise<void> => {
    const missingIds = [...new Set(ids.map(getEntityId).filter(Boolean))]
      .filter((id) => id !== currentUserId && !hydratedOnlineIdsRef.current.has(id))
      .slice(0, 16);

    if (!missingIds.length) return;
    missingIds.forEach((id) => hydratedOnlineIdsRef.current.add(id));

    const loadedPeople = await fetchPublicPeopleByIds(missingIds);
    if (!loadedPeople.length) return;

    setPeople((prev) => {
      const unique = new Map<string, PublicUser>();
      [...prev, ...loadedPeople].forEach((person) => {
        const id = getEntityId(person);
        if (id) unique.set(id, person);
      });
      return [...unique.values()];
    });
  };

  const loadPresence = async (): Promise<void> => {
    if (!isAuthenticated) return;
    const [onlineRes, friendsRes, storiesRes] = await Promise.all([
      api.get<{ userIds?: string[] } | string[]>('/presence/online').catch(() => ({ data: { userIds: [] as string[] } })),
      api
        .get<{ people?: PublicUser[]; friends?: Array<{ user?: User }> }>('/friends/summary')
        .catch(() => ({ data: { people: [], friends: [] } })),
      api
        .get<Story[] | { stories?: Story[]; groups?: StoryGroup[] }>('/stories/active/grouped')
        .catch(() =>
          api.get<Story[]>('/stories/active').catch(() => ({ data: [] as Story[] })),
        ),
    ]);

    const onlineIds = normalizeOnlineIds(onlineRes.data as PresencePayload);
    const friendUsers = ((friendsRes.data?.friends || []) as Array<{ user?: User }>)
      .map((item) => item.user)
      .filter((u): u is User => Boolean(u));
    const everyone: User[] = [user, ...friendUsers, ...((friendsRes.data?.people || []) as User[])].filter(
      (u): u is User => Boolean(u),
    );
    const unique = new Map<string, User>();
    everyone.forEach((person) => {
      const id = getEntityId(person);
      if (id) unique.set(id, person);
    });
    const missingOnlineIds = onlineIds
      .filter((id) => id && id !== currentUserId && !unique.has(id))
      .slice(0, 16);
    const hydratedOnlinePeople = await fetchPublicPeopleByIds(missingOnlineIds);
    hydratedOnlinePeople.forEach((person) => {
      const id = getEntityId(person);
      if (id) {
        hydratedOnlineIdsRef.current.add(id);
        unique.set(id, person);
      }
    });

    setOnlineUserIds(onlineIds);
    setPeople([...unique.values()]);

    // The active-stories endpoint comes back in two shapes: a raw array, or
    // an object with `{ stories, groups }`. Handle both without losing types.
    const storiesData = storiesRes.data as Story[] | { stories?: Story[]; groups?: StoryGroup[] } | undefined;
    const loadedStories: Story[] = Array.isArray(storiesData)
      ? storiesData
      : storiesData?.stories || [];
    setStories(loadedStories);
    const incomingGroups =
      !Array.isArray(storiesData) && Array.isArray(storiesData?.groups)
        ? (storiesData!.groups as StoryGroup[])
        : (groupActiveStoriesByOwner(loadedStories) as StoryGroup[]);
    setStoryGroups(incomingGroups);
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setOnlineUserIds([]);
      setPeople([]);
      setStories([]);
      setStoryGroups([]);
      return undefined;
    }

    let cancelled = false;
    const safeLoad = (): void => {
      loadPresence().catch(() => {});
    };
    safeLoad();

    const socket = getSocket();
    const setOnlineList = (payload: PresencePayload = []): void => {
      if (cancelled) return;
      const ids = normalizeOnlineIds(payload);
      setOnlineUserIds(ids);
      hydrateOnlinePeople(ids).catch(() => {});
    };
    const addOnline = (payload: PresencePayload): void => {
      const id = getPresencePayloadUserId(payload);
      if (!id || cancelled) return;
      setOnlineUserIds((prev) => [...new Set([...prev, id])]);
      hydrateOnlinePeople([id]).catch(() => {});
    };
    const removeOnline = (payload: PresencePayload): void => {
      const id = getPresencePayloadUserId(payload);
      if (!id || cancelled) return;
      setOnlineUserIds((prev) => prev.filter((item) => item !== id));
      const incomingLastSeen =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? payload.lastSeen
          : undefined;
      setPeople((prev) =>
        prev.map((person) =>
          getEntityId(person) === id
            ? { ...person, lastSeen: incomingLastSeen ?? person.lastSeen }
            : person,
        ),
      );
    };
    const onStatusChange = (payload: PresencePayload = {}): void => {
      const id = getPresencePayloadUserId(payload);
      if (!id || cancelled) return;
      const isOnline =
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        (payload.online === true || payload.status === 'online');
      if (isOnline) addOnline(id);
      else removeOnline(payload);
    };

    socket.emit('get-online-users', setOnlineList);
    socket.on('online-users', setOnlineList);
    socket.on('user-online', addOnline);
    socket.on('user-offline', removeOnline);
    socket.on('user-status-change', onStatusChange);
    socket.on('friend-request-updated', safeLoad);
    socket.on('story-updated', safeLoad);
    socket.on('story-deleted', safeLoad);
    window.addEventListener('friendsUpdated', safeLoad);
    window.addEventListener('storiesUpdated', safeLoad);

    const interval = window.setInterval(safeLoad, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      socket.off('online-users', setOnlineList);
      socket.off('user-online', addOnline);
      socket.off('user-offline', removeOnline);
      socket.off('user-status-change', onStatusChange);
      socket.off('friend-request-updated', safeLoad);
      socket.off('story-updated', safeLoad);
      socket.off('story-deleted', safeLoad);
      window.removeEventListener('friendsUpdated', safeLoad);
      window.removeEventListener('storiesUpdated', safeLoad);
    };
  }, [isAuthenticated, user]);

  const value = useMemo<PresenceContextValue>(() => {
    const onlineSet = new Set(onlineUserIds.map(String));
    const storiesByUser = stories.reduce<Map<string, Story[]>>((map, story) => {
      const ownerId = getEntityId(story.userId);
      if (!ownerId) return map;
      if (!map.has(ownerId)) map.set(ownerId, []);
      map.get(ownerId)!.push(story);
      return map;
    }, new Map());
    const onlinePeople = people
      .filter((person) => onlineSet.has(getEntityId(person)))
      .sort(
        (a, b) =>
          Number(storiesByUser.has(getEntityId(b))) -
          Number(storiesByUser.has(getEntityId(a))),
      );

    return {
      onlineUserIds,
      onlineSet,
      people,
      stories,
      storyGroups,
      storiesByUser,
      onlinePeople,
      isUserOnline: (personOrId: EntityRef) => onlineSet.has(getEntityId(personOrId)),
      hasStory: (personOrId: EntityRef) => storiesByUser.has(getEntityId(personOrId)),
      refreshPresence: loadPresence,
    };
    // loadPresence is recreated each render but only touches state setters
    // and stable module helpers; including it would force a useCallback that
    // adds noise without changing behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineUserIds, people, stories, storyGroups]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

/**
 * Read presence state. Falls back to an inert default when called outside a
 * `<PresenceProvider>` — this matches the original JS behavior and keeps
 * isolated component renders (storybook, tests, error boundaries) working
 * without a provider in the tree.
 */
export const usePresence = (): PresenceContextValue => {
  const ctx = useContext(PresenceContext);
  if (ctx) return ctx;
  return {
    onlineUserIds: [],
    onlineSet: new Set(),
    people: [],
    stories: [],
    storyGroups: [],
    storiesByUser: new Map(),
    onlinePeople: [],
    isUserOnline: () => false,
    hasStory: () => false,
    refreshPresence: () => {},
  };
};
