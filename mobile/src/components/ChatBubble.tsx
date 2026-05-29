import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInDown, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { FileText, Pin } from 'lucide-react-native';
import ImageGridBubble from './ImageGridBubble';
import VoiceMessageBubble from './VoiceMessageBubble';
import type { GroupMessage, Message } from '../types';
import { formatMessageTime } from '../utils/date';
import { getEntityId } from '../utils/ids';
import { getMessageAttachments, resolveMediaUrl } from '../utils/media';
import { isAudioAttachment, isMediaAttachment } from '../utils/mediaHelpers';

type ThreadMessage = Message | GroupMessage;

type ChatBubbleProps = {
  message: ThreadMessage;
  currentUserId: string;
  onReply: (message: ThreadMessage) => void;
  onAction?: (message: ThreadMessage) => void;
  onReactionPress?: (message: ThreadMessage) => void;
  groupMode?: boolean;
  highlighted?: boolean;
  ownBubbleColor?: string;
  otherBubbleColor?: string;
  onOpenMedia?: (message: ThreadMessage, index: number) => void;
};

export default function ChatBubble({
  message,
  currentUserId,
  onReply,
  onAction,
  onReactionPress,
  groupMode = false,
  highlighted = false,
  ownBubbleColor = '#2563EB',
  otherBubbleColor = '#FFFFFF',
  onOpenMedia
}: ChatBubbleProps) {
  const sender = (message as GroupMessage).userId !== undefined ? (message as GroupMessage).userId : (message as Message).from;
  const isMe = getEntityId(sender) === currentUserId;
  const translateX = useSharedValue(0);
  const attachments = getMessageAttachments(message as Message);
  const mediaAttachments = attachments.filter(isMediaAttachment);
  const audioAttachments = attachments.filter(isAudioAttachment);
  const fileAttachments = attachments.filter(attachment => !isMediaAttachment(attachment) && !isAudioAttachment(attachment));
  const replyMessage = typeof message.replyTo === 'object' ? message.replyTo : null;
  const senderName = typeof sender === 'object' ? sender?.name || sender?.email || 'Member' : 'Member';

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate(event => {
      const nextValue = isMe ? Math.min(0, Math.max(-72, event.translationX)) : Math.max(0, Math.min(72, event.translationX));
      translateX.value = nextValue;
    })
    .onEnd(() => {
      if ((!isMe && translateX.value > 48) || (isMe && translateX.value < -48)) runOnJS(onReply)(message);
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  const openMenu = () => (onAction ? onAction(message) : onReply(message));

  if (message.system) {
    return (
      <Animated.View entering={FadeInDown.duration(120)} className="items-center px-8 py-2">
        <Text className="rounded-full bg-slate-200 px-3 py-1 text-center text-xs text-slate-600" numberOfLines={2}>
          {message.text}
        </Text>
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeInDown.duration(120)}
        className={`px-3 py-1 ${isMe ? 'items-end' : 'items-start'}`}
        style={animatedStyle}
      >
        {groupMode && !isMe ? (
          <Text className="mb-0.5 ml-2 text-[11px] font-semibold text-slate-500" numberOfLines={1}>
            {senderName}
          </Text>
        ) : null}
        <Pressable
          className={`max-w-[82%] rounded-[22px] px-3.5 py-2.5 ${!isMe ? 'shadow-sm shadow-slate-200' : ''} ${highlighted ? 'border-2 border-amber-300' : ''}`}
          onLongPress={openMenu}
          style={{ backgroundColor: isMe ? ownBubbleColor : otherBubbleColor }}
        >
          {message.pinned ? (
            <View className={`mb-1 flex-row items-center gap-1 ${isMe ? 'self-end' : 'self-start'}`}>
              <Pin color={isMe ? '#FFFFFF' : '#64748B'} size={11} />
              <Text className={`text-[10px] font-semibold ${isMe ? 'text-white/80' : 'text-slate-500'}`}>Pinned</Text>
            </View>
          ) : null}

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

          {mediaAttachments.length ? (
            <ImageGridBubble
              attachments={mediaAttachments}
              onOpen={index => onOpenMedia?.(message, index)}
            />
          ) : null}

          {audioAttachments.map((attachment, index) => (
            <VoiceMessageBubble
              attachment={attachment}
              id={`${getEntityId(message)}-audio-${index}`}
              isMe={isMe}
              key={`${attachment.fileUrl}-${index}`}
            />
          ))}

          {fileAttachments.map((attachment, index) => {
            const type = attachment.fileType || message.fileType;
            return (
              <Pressable
                key={`${attachment.fileUrl}-${index}`}
                className={`mb-2 flex-row items-center gap-2 rounded-2xl px-3 py-2 ${isMe ? 'bg-white/15' : 'bg-slate-100'}`}
                onPress={() => Linking.openURL(resolveMediaUrl(attachment.fileUrl)).catch(() => {})}
              >
                <FileText color={isMe ? '#FFFFFF' : '#0A7CFF'} size={17} />
                <View className="min-w-0 flex-1">
                  <Text className={`text-sm font-semibold ${isMe ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
                    {attachment.fileName || (type === 'video' ? 'Video' : 'Attachment')}
                  </Text>
                  <Text className={`text-[11px] ${isMe ? 'text-white/70' : 'text-slate-500'}`} numberOfLines={1}>
                    Tap to open
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {(message as Message).unsent ? (
            <Text className={`text-sm italic ${isMe ? 'text-white/75' : 'text-slate-500'}`} numberOfLines={3}>
              Message unsent
            </Text>
          ) : message.text ? (
            <Text className={`text-[15px] leading-5 ${isMe ? 'text-white' : 'text-slate-950'}`}>
              {message.text}
            </Text>
          ) : null}

          <Text className={`mt-1 text-[10px] ${isMe ? 'text-white/70' : 'text-slate-400'}`} numberOfLines={1}>
            {formatMessageTime(message.createdAt)}{message.editedAt ? ' · Edited' : ''}
          </Text>
        </Pressable>

        {message.reactions?.length ? (
          <Pressable
            className={`-mt-2 rounded-full bg-white px-2 py-0.5 shadow-sm shadow-slate-200 ${isMe ? 'mr-2' : 'ml-2'}`}
            onPress={() => onReactionPress?.(message)}
          >
            <Text className="text-xs" numberOfLines={1}>
              {message.reactions.map(reaction => reaction.emoji).join(' ')}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
