const getEntityId = (entity) => String(entity?._id || entity?.id || entity || '');

const getStoryTime = (story) => {
  const value = new Date(story?.createdAt || story?.updatedAt || 0).getTime();
  return Number.isNaN(value) ? 0 : value;
};

export const getStoryOwnerId = (story) => getEntityId(story?.userId) || getEntityId(story?.user);

export const isActiveStory = (story) => {
  const expiresAt = new Date(story?.expiresAt || 0).getTime();
  return expiresAt > Date.now();
};

export const groupActiveStoriesByOwner = (stories = []) => {
  const groups = new Map();

  stories
    .filter(isActiveStory)
    .sort((a, b) => getStoryTime(b) - getStoryTime(a))
    .forEach(story => {
      const owner = story.userId || story.user || {};
      const ownerId = getStoryOwnerId(story) || getEntityId(story);
      if (!groups.has(ownerId)) {
        groups.set(ownerId, { ownerId, owner, stories: [] });
      }
      groups.get(ownerId).stories.push(story);
    });

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      preview: group.stories[0],
      count: group.stories.length
    }))
    .sort((a, b) => getStoryTime(b.preview) - getStoryTime(a.preview));
};

export const getStoryListForActiveStory = (storyGroups = [], activeStory) => {
  if (!activeStory) return [];
  const activeStoryId = getEntityId(activeStory);
  const ownerId = getStoryOwnerId(activeStory);
  const group = storyGroups.find(item => item.ownerId === ownerId);
  if (!group) return [activeStory];

  return group.stories.map(story => (
    getEntityId(story) === activeStoryId ? activeStory : story
  ));
};
