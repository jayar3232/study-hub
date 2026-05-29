import React from 'react';
import { Image, Text, View } from 'react-native';
import type { User } from '../types';
import { resolveMediaUrl } from '../utils/media';

type AvatarProps = {
  user?: User | null;
  uri?: string;
  name?: string;
  size?: number;
  sharedTag?: string;
};

export default function Avatar({ user, uri, name, size = 48 }: AvatarProps) {
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
      <Image
        source={{ uri: avatarUri }}
        resizeMode="cover"
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E2E8F0' }}
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
