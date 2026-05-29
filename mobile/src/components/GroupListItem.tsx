import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BellOff, Pin, Star, Users } from 'lucide-react-native';
import Avatar from './Avatar';
import type { Group } from '../types';
import { getEntityId } from '../utils/ids';

type GroupListItemProps = {
  group: Group;
  onPress: () => void;
  pinned?: boolean;
  muted?: boolean;
  favorite?: boolean;
};

export default function GroupListItem({
  group,
  onPress,
  pinned = false,
  muted = false,
  favorite = false
}: GroupListItemProps) {
  const memberCount = Array.isArray(group.members) ? group.members.length : 0;

  return (
    <Pressable className="h-[76px] flex-row items-center gap-3 bg-white px-4" onPress={onPress}>
      {group.photo ? (
        <Avatar uri={group.photo} name={group.name} size={52} sharedTag={`group-${getEntityId(group)}`} />
      ) : (
        <View className="h-[52px] w-[52px] items-center justify-center rounded-2xl bg-blue-100">
          <Users color="#0A7CFF" size={24} />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-[15px] font-semibold text-slate-950" numberOfLines={1}>
            {group.name || 'Group chat'}
          </Text>
          {pinned ? <Pin color="#64748B" size={13} /> : null}
          {favorite ? <Star color="#F59E0B" fill="#F59E0B" size={13} /> : null}
          {muted ? <BellOff color="#94A3B8" size={13} /> : null}
        </View>
        <Text className="mt-1 text-[13px] text-slate-500" numberOfLines={1}>
          {memberCount ? `${memberCount} members` : group.subject || 'Open group conversation'}
        </Text>
      </View>
    </Pressable>
  );
}
