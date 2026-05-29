import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Play } from 'lucide-react-native';
import type { MessageAttachment } from '../types';
import { getMediaUrl, getThumbnailUrl } from '../utils/mediaHelpers';

type ImageGridBubbleProps = {
  attachments: MessageAttachment[];
  onOpen: (index: number) => void;
};

type TileProps = {
  attachment: MessageAttachment;
  index: number;
  width: number;
  height: number;
  extraCount?: number;
  onOpen: (index: number) => void;
};

function Tile({ attachment, index, width, height, extraCount = 0, onOpen }: TileProps) {
  const uri = attachment.fileType === 'video' ? getThumbnailUrl(attachment) : getMediaUrl(attachment);

  return (
    <Pressable
      className="overflow-hidden bg-slate-200"
      onPress={() => onOpen(index)}
      style={{ height, width }}
    >
      <ExpoImage
        cachePolicy="memory-disk"
        contentFit="cover"
        source={{ uri }}
        style={{ height, width }}
        transition={120}
      />
      {attachment.fileType === 'video' ? (
        <View className="absolute inset-0 items-center justify-center bg-black/10">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-black/45">
            <Play color="#FFFFFF" fill="#FFFFFF" size={16} />
          </View>
        </View>
      ) : null}
      {extraCount > 0 ? (
        <View className="absolute inset-0 items-center justify-center bg-black/55">
          <Text className="text-2xl font-bold text-white">+{extraCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ImageGridBubble({ attachments, onOpen }: ImageGridBubbleProps) {
  const visible = attachments.slice(0, 4);
  const extraCount = Math.max(0, attachments.length - 4);
  const gap = 2;
  const size = 224;

  if (attachments.length === 1) {
    return (
      <View className="mb-1 overflow-hidden rounded-[14px]">
        <Tile attachment={attachments[0]} height={224} index={0} onOpen={onOpen} width={224} />
      </View>
    );
  }

  if (attachments.length === 2) {
    return (
      <View className="mb-1 flex-row overflow-hidden rounded-[14px]" style={{ gap }}>
        {visible.map((attachment, index) => (
          <Tile attachment={attachment} height={176} index={index} key={`${attachment.fileUrl}-${index}`} onOpen={onOpen} width={(size - gap) / 2} />
        ))}
      </View>
    );
  }

  if (attachments.length === 3) {
    return (
      <View className="mb-1 flex-row overflow-hidden rounded-[14px]" style={{ gap, height: size, width: size }}>
        <Tile attachment={visible[0]} height={size} index={0} onOpen={onOpen} width={(size - gap) / 2} />
        <View style={{ gap }}>
          <Tile attachment={visible[1]} height={(size - gap) / 2} index={1} onOpen={onOpen} width={(size - gap) / 2} />
          <Tile attachment={visible[2]} height={(size - gap) / 2} index={2} onOpen={onOpen} width={(size - gap) / 2} />
        </View>
      </View>
    );
  }

  return (
    <View className="mb-1 overflow-hidden rounded-[14px]" style={{ gap, width: size }}>
      {[0, 2].map(rowStart => (
        <View className="flex-row" key={rowStart} style={{ gap }}>
          {visible.slice(rowStart, rowStart + 2).map((attachment, offset) => {
            const index = rowStart + offset;
            return (
              <Tile
                attachment={attachment}
                extraCount={index === 3 ? extraCount : 0}
                height={(size - gap) / 2}
                index={index}
                key={`${attachment.fileUrl}-${index}`}
                onOpen={onOpen}
                width={(size - gap) / 2}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
