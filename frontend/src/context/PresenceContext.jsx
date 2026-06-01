import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { groupActiveStoriesByOwner } from '../utils/stories';

const PresenceContext = createContext(null);

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');
const getPresencePayloadUserId = (payload) => getEntityId(payload?.userId || payload?._id || payload?.id || payload);
const normalizeOnlineIds = (payload) => {
  const ids = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.userIds)
      ? payload.userIds
      : Array.isArray(payload?.users)
        ? payload.users
        : [];

  return [...new Set(ids.map(getEntityId).filter(Boolean))];
};

const fetchPublicPeopleByIds = async (ids) => {
  const results = await Promise.all(
    ids.map(id => api.get(`/users/${id}/public`).then(res => res.data).catch(() => null))
  );
  return results.filter(Boolean);
};

export function PresenceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [people, setPeople] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const hydratedOnlineIdsRef = useRef(new Set());
  const currentUserId = getEntityId(user);

  const hydrateOnlinePeople = async (ids = []) => {
    const missingIds = [...new Set(ids.map(getEntityId).filter(Boolean))]
      .filter(id => id !== currentUserId && !hydratedOnlineIdsRef.current.has(id))
      .slice(0, 16);

    if (!missingIds.length) return;
    missingIds.forEach(id => hydratedOnlineIdsRef.current.add(id));

    const loadedPeople = await fetchPublicPeopleByIds(missingIds);
    if (!loadedPeople.length) return;

    setPeople(prev => {
      const unique = new Map();
      [...prev, ...loadedPeople].forEach(person => {
        const id = getEntityId(person);
        if (id) unique.set(id, person);
      });
      return [...unique.values()];
    });
  };

  const loadPresence = async () => {
    if (!isAuthenticated) return;
    const [onlineRes, friendsRes, storiesRes] = await Promise.all([
      api.get('/presence/online').catch(() => ({ data: { userIds: [] } })),
      api.get('/friends/summary').catch(() => ({ data: { people: [], friends: [] } })),
      api.get('/stories/active/grouped').catch(() => (
        api.get('/stories/active').catch(() => ({ data: [] }))
      ))
    ]);

    const onlineIds = normalizeOnlineIds(onlineRes.data);
    const friendUsers = (friendsRes.data?.friends || []).map(item => item.user).filter(Boolean);
    const everyone = [user, ...friendUsers, ...(friendsRes.data?.people || [])].filter(Boolean);
    const unique = new Map();
    everyone.forEach(person => {
      const id = getEntityId(person);
      if (id) unique.set(id, person);
    });
    const missingOnlineIds = onlineIds
      .filter(id => id && id !== currentUserId && !unique.has(id))
      .slice(0, 16);
    const hydratedOnlinePeople = await fetchPublicPeopleByIds(missingOnlineIds);
    hydratedOnlinePeople.forEach(person => {
      const id = getEntityId(person);
      if (id) {
        hydratedOnlineIdsRef.current.add(id);
        unique.set(id, person);
      }
    });

    setOnlineUserIds(onlineIds);
    setPeople([...unique.values()]);
    const loadedStories = Array.isArray(storiesRes.data) ? storiesRes.data : storiesRes.data?.stories || [];
    setStories(loadedStories);
    setStoryGroups(Array.isArray(storiesRes.data?.groups) ? storiesRes.data.groups : groupActiveStoriesByOwner(loadedStories));
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
    const safeLoad = () => loadPresence().catch(() => {});
    safeLoad();

    const socket = getSocket();
    const setOnlineList = (payload = []) => {
      if (cancelled) return;
      const ids = normalizeOnlineIds(payload);
      setOnlineUserIds(ids);
      hydrateOnlinePeople(ids).catch(() => {});
    };
    const addOnline = (payload) => {
      const id = getPresencePayloadUserId(payload);
      if (!id || cancelled) return;
      setOnlineUserIds(prev => [...new Set([...prev, id])]);
      hydrateOnlinePeople([id]).catch(() => {});
    };
    const removeOnline = (payload) => {
      const id = getPresencePayloadUserId(payload);
      if (!id || cancelled) return;
      setOnlineUserIds(prev => prev.filter(item => item !== id));
      setPeople(prev => prev.map(person => getEntityId(person) === id ? { ...person, lastSeen: payload?.lastSeen || person.lastSeen } : person));
    };
    const onStatusChange = (payload = {}) => {
      const id = getPresencePayloadUserId(payload);
      if (!id || cancelled) return;
      if (payload.online || payload.status === 'online') addOnline(id);
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

  const value = useMemo(() => {
    const onlineSet = new Set(onlineUserIds.map(String));
    const storiesByUser = stories.reduce((map, story) => {
      const ownerId = getEntityId(story.userId);
      if (!ownerId) return map;
      if (!map.has(ownerId)) map.set(ownerId, []);
      map.get(ownerId).push(story);
      return map;
    }, new Map());
    const onlinePeople = people
      .filter(person => onlineSet.has(getEntityId(person)))
      .sort((a, b) => Number(storiesByUser.has(getEntityId(b))) - Number(storiesByUser.has(getEntityId(a))));

    return {
      onlineUserIds,
      onlineSet,
      people,
      stories,
      storyGroups,
      storiesByUser,
      onlinePeople,
      isUserOnline: (personOrId) => onlineSet.has(getEntityId(personOrId)),
      hasStory: (personOrId) => storiesByUser.has(getEntityId(personOrId)),
      refreshPresence: loadPresence
    };
  }, [onlineUserIds, people, stories, storyGroups]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export const usePresence = () => useContext(PresenceContext) || {
  onlineUserIds: [],
  onlineSet: new Set(),
  people: [],
  stories: [],
  storyGroups: [],
  storiesByUser: new Map(),
  onlinePeople: [],
  isUserOnline: () => false,
  hasStory: () => false,
  refreshPresence: () => {}
};
