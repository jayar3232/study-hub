import { Video, ResizeMode } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { Message } from '../types';
import { formatMessageTime } from '../utils/date';
import { getEntityId } from '../utils/ids';
import { getMessageAttachments, resolveMediaUrl, resolveMediaVariantUrl } from '../utils/media';

type ChatBubbleProps = {
  message: Message;
  currentUserId: string;
  onReply: (message: Message) => void;
};

export default function ChatBubble({ message, currentUserId, onReply }: ChatBubbleProps) {
  const isMe = getEntityId(message.from) === currentUserId;
  const translateX = useSharedValue(0);
  const attachments = getMessageAttachments(message);
  const replyMessage = typeof message.replyTo === 'object' ? message.replyTo : null;

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(event => {
      translateX.value = Math.max(0, Math.min(72, event.translationX));
    })
    .onEnd(() => {
      if (translateX.value > 48) runOnJS(onReply)(message);
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  const openMenu = () => {
    Alert.alert('Message', message.unsent ? 'Message was unsent' : message.text || 'Media message', [
      { text: 'Reply', onPress: () => onReply(message) },
      { text: 'Close', style: 'cancel' }
    ]);
  };

  if (message.system) {
    return (
      <Animated.View entering={FadeInDown.springify().damping(18)} className="items-center px-8 py-2">
        <Text className="rounded-full bg-slate-200 px-3 py-1 text-center text-xs text-slate-600" numberOfLines={2}>
          {message.text}
        </Text>
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeInDown.springify().damping(18)}
        className={`px-3 py-1 ${isMe ? 'items-end' : 'items-start'}`}
        style={animatedStyle}
      >
        <Pressable
          className={`max-w-[82%] rounded-[22px] px-3.5 py-2.5 ${isMe ? 'bg-blue-600' : 'bg-white shadow-sm shadow-slate-200'}`}
          onLongPress={openMenu}
        >
          {replyMessage ? (
            <View className={`mb-2 rounded-2xl border-l-2 px-3 py-2 ${isMe ? 'border-white/70 bg-white/15' : 'border-blue-500 bg-slate-100'}`}>
              <Text className={`text-xs font-semibold ${isMe ? 'text-white/80' : 'text-blue-600'}`} numberOfLines={1}>
                Reply
              </Text>
              <Text className={`mt-0.5 text-xs ${isMe ? 'text-white/80' : 'text-slate-600'}`} numberOfLines={2}>
                {replyMessage.text || 'Media message'}
              </Text>
            </View>
          ) : null}

          {attachments.map((attachment, index) => {
            const type = attachment.fileType || message.fileType;
            const uri = type === 'image' ? resolveMediaVariantUrl(attachment) : resolveMediaUrl(attachment.fileUrl);
            if (type === 'image') {
              return (
                <ExpoImage
                  key={`${attachment.fileUrl}-${index}`}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri }}
                  style={{ width: 220, height: 220, borderRadius: 18, marginBottom: message.text ? 8 : 0 }}
                />
              );
            }

            if (type === 'video') {
              return (
                <Video
                  key={`${attachment.fileUrl}-${index}`}
                  resizeMode={ResizeMode.COVER}
                  source={{ uri }}
                  style={{ width: 220, height: 220, borderRadius: 18, marginBottom: message.text ? 8 : 0 }}
                  useNativeControls
                />
              );
            }

            return (
              <View key={`${attachment.fileUrl}-${index}`} className={`mb-2 rounded-2xl px-3 py-2 ${isMe ? 'bg-white/15' : 'bg-slate-100'}`}>
                <Text className={`text-sm font-semibold ${isMe ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
                  {attachment.fileName || 'Attachment'}
                </Text>
              </View>
            );
          })}

          {message.unsent ? (
            <Text className={`text-sm italic ${isMe ? 'text-white/75' : 'text-slate-500'}`} numberOfLines={3}>
              Message unsent
            </Text>
          ) : message.text ? (
            <Text className={`text-[15px] leading-5 ${isMe ? 'text-white' : 'text-slate-950'}`}>
              {message.text}
            </Text>
          ) : null}

          <Text className={`mt-1 text-[10px] ${isMe ? 'text-white/70' : 'text-slate-400'}`} numberOfLines={1}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </Pressable>

        {message.reactions?.length ? (
          <View className={`-mt-2 rounded-full bg-white px-2 py-0.5 shadow-sm shadow-slate-200 ${isMe ? 'mr-2' : 'ml-2'}`}>
            <Text className="text-xs" numberOfLines={1}>
              {message.reactions.map(reaction => reaction.emoji).join(' ')}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
