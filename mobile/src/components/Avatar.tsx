import React from 'react';
import { Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { User } from '../types';
import { resolveMediaUrl } from '../utils/media';

export type AvatarStoryRing = 'unviewed' | 'viewed' | 'none';

type AvatarProps = {
  user?: User | null;
  uri?: string;
  name?: string;
  size?: number;
  sharedTag?: string;
  online?: boolean;
  storyRing?: AvatarStoryRing;
};

export default function Avatar({ user, uri, name, size = 48, online = false, storyRing = 'none' }: AvatarProps) {
  const displayName = name || user?.name || user?.email || 'User';
  const avatarUri = resolveMediaUrl(uri || user?.avatar || '');
  const ringVisible = storyRing !== 'none';
  const ringPadding = ringVisible ? 4 : 0;
  const outerSize = size + ringPadding * 2;
  const strokeWidth = storyRing === 'viewed' ? 2 : 3;
  const dotOuterSize = Math.max(12, Math.round(size * 0.24));
  const dotInnerSize = Math.max(8, dotOuterSize - 4);
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const avatar = avatarUri ? (
    <ExpoImage
      cachePolicy="memory-disk"
      contentFit="cover"
      source={{ uri: avatarUri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E2E8F0' }}
      transition={120}
    />
  ) : (
    <View
      className="items-center justify-center bg-slate-200"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="font-semibold text-slate-600" style={{ fontSize: Math.max(12, size * 0.32) }}>
        {initials || 'S'}
      </Text>
    </View>
  );

  return (
    <View style={{ height: outerSize, width: outerSize }}>
      {ringVisible ? (
        <Svg height={outerSize} style={{ position: 'absolute', left: 0, top: 0 }} width={outerSize}>
          <Defs>
            <LinearGradient id="storyRingGradient" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor="#0A7CFF" />
              <Stop offset="1" stopColor="#5AA7FF" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={outerSize / 2}
            cy={outerSize / 2}
            fill="transparent"
            r={(outerSize - strokeWidth) / 2}
            stroke={storyRing === 'viewed' ? '#B0B3B8' : 'url(#storyRingGradient)'}
            strokeWidth={strokeWidth}
          />
        </Svg>
      ) : null}
      <View style={{ left: ringPadding, position: 'absolute', top: ringPadding }}>
        {avatar}
      </View>
      {online ? (
        <View
          className="absolute items-center justify-center rounded-full bg-white"
          style={{
            bottom: ringVisible ? 1 : 0,
            height: dotOuterSize,
            right: ringVisible ? 1 : 0,
            width: dotOuterSize
          }}
        >
          <View
            className="rounded-full bg-emerald-500"
            style={{ height: dotInnerSize, width: dotInnerSize }}
          />
        </View>
      ) : null}
    </View>
  );
}
