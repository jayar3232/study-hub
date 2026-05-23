import React from 'react';
import { Image, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { User } from '../types';
import { getEntityId } from '../utils/ids';
import { resolveMediaUrl } from '../utils/media';

const AnimatedImage = Animated.createAnimatedComponent(Image);

type AvatarProps = {
  user?: User | null;
  uri?: string;
  name?: string;
  size?: number;
  sharedTag?: string;
};

export default function Avatar({ user, uri, name, size = 48, sharedTag }: AvatarProps) {
  const displayName = name || user?.name || user?.email || 'User';
  const avatarUri = resolveMediaUrl(uri || user?.avatar || '');
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUri) {
    return (
      <AnimatedImage
        source={{ uri: avatarUri }}
        resizeMode="cover"
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E2E8F0' }}
        {...({ sharedTransitionTag: sharedTag || `avatar-${getEntityId(user)}` } as object)}
      />
    );
  }

  return (
    <View
      className="items-center justify-center bg-slate-200"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="font-semibold text-slate-600" style={{ fontSize: Math.max(12, size * 0.32) }}>
        {initials || 'S'}
      </Text>
    </View>
  );
}
