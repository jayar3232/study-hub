import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { groupActiveStoriesByOwner } from '../utils/stories';

const PresenceContext = createContext(null);

const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

export function PresenceProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [people, setPeople] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);

  const loadPresence = async () => {
    if (!isAuthenticated) return;
    const [onlineRes, friendsRes, storiesRes] = await Promise.all([
      api.get('/presence/online').catch(() => ({ data: { userIds: [] } })),
      api.get('/friends/summary').catch(() => ({ data: { people: [], friends: [] } })),
      api.get('/stories/active/grouped').catch(() => (
        api.get('/stories/active').catch(() => ({ data: [] }))
      ))
    ]);

    const friendUsers = (friendsRes.data?.friends || []).map(item => item.user).filter(Boolean);
    const everyone = [...friendUsers, ...(friendsRes.data?.people || [])];
    const unique = new Map();
    everyone.forEach(person => {
      const id = getEntityId(person);
      if (id) unique.set(id, person);
    });

    setOnlineUserIds(onlineRes.data?.userIds || []);
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
    const setOnlineList = (ids = []) => {
      if (!cancelled) setOnlineUserIds([...new Set(ids.map(String))]);
    };
    const addOnline = (userId) => {
      const id = getEntityId(userId);
      if (!id || cancelled) return;
      setOnlineUserIds(prev => [...new Set([...prev, id])]);
    };
    const removeOnline = (payload) => {
      const id = getEntityId(payload?.userId || payload);
      if (!id || cancelled) return;
      setOnlineUserIds(prev => prev.filter(item => item !== id));
      setPeople(prev => prev.map(person => getEntityId(person) === id ? { ...person, lastSeen: payload?.lastSeen || person.lastSeen } : person));
    };

    socket.emit('get-online-users', setOnlineList);
    socket.on('online-users', setOnlineList);
    socket.on('user-online', addOnline);
    socket.on('user-offline', removeOnline);
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
