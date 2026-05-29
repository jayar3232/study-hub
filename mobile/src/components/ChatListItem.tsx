import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BellOff, Pin, Star, Trash2 } from 'lucide-react-native';
import Avatar from './Avatar';
import type { Conversation } from '../types';
import { formatConversationTime } from '../utils/date';
import { getEntityId } from '../utils/ids';

type ChatListItemProps = {
  item: Conversation;
  onPress: () => void;
  onDelete: () => void;
  displayName?: string;
  pinned?: boolean;
  muted?: boolean;
  favorite?: boolean;
  online?: boolean;
};

export default function ChatListItem({
  item,
  onPress,
  onDelete,
  displayName,
  pinned = false,
  muted = false,
  favorite = false,
  online = false
}: ChatListItemProps) {
  const user = item.user;
  const userId = getEntityId(user);
  const translateX = useSharedValue(0);
  const name = displayName || user.name || user.email || 'Syncrova user';

  const confirmDelete = () => {
    Alert.alert('Delete conversation?', user.name || 'This chat', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete }
    ]);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(event => {
      translateX.value = Math.max(-96, Math.min(0, event.translationX));
    })
    .onEnd(() => {
      if (translateX.value < -72) runOnJS(confirmDelete)();
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  return (
    <View className="h-[72px] justify-center overflow-hidden bg-white">
      <View className="absolute right-0 h-full w-24 items-center justify-center bg-red-500">
        <Trash2 color="white" size={22} />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={animatedStyle}>
          <Pressable
            className="h-[72px] flex-row items-center gap-3 bg-white px-4"
            onLongPress={confirmDelete}
            onPress={onPress}
          >
            <View>
              <Avatar user={user} size={52} sharedTag={`avatar-${userId}`} />
              {online ? <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" /> : null}
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-[15px] font-semibold text-slate-950" numberOfLines={1}>
                  {name}
                </Text>
                {pinned ? <Pin color="#64748B" size={13} /> : null}
                {favorite ? <Star color="#F59E0B" fill="#F59E0B" size={13} /> : null}
                {muted ? <BellOff color="#94A3B8" size={13} /> : null}
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {formatConversationTime(item.lastTime)}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center gap-2">
                <Text
                  className={`flex-1 text-[13px] ${item.unreadCount ? 'font-semibold text-slate-950' : 'text-slate-500'}`}
                  numberOfLines={1}
                >
                  {item.lastMessage || 'Open chat'}
                </Text>
                {item.unreadCount ? (
                  <View className="min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5">
                    <Text className="text-[11px] font-semibold text-white" numberOfLines={1}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
