import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ListRenderItemInfo, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { Play } from 'lucide-react-native';
import type { MediaViewerItem } from '../utils/mediaHelpers';
import MediaViewerFooter from './MediaViewerFooter';
import MediaViewerHeader from './MediaViewerHeader';

type MediaViewerProps = {
  visible: boolean;
  items: MediaViewerItem[];
  initialIndex?: number;
  onClose: () => void;
  onReply?: () => void;
};

type ViewerItemProps = {
  item: MediaViewerItem;
  width: number;
  height: number;
  onClose: () => void;
  onToggleChrome: () => void;
};

function VideoSlide({ item, width, height }: { item: MediaViewerItem; width: number; height: number }) {
  const [started, setStarted] = useState(false);
  const player = useVideoPlayer(item.url, playerInstance => {
    playerInstance.loop = false;
  });

  return (
    <View className="items-center justify-center" style={{ height, width }}>
      <VideoView
        contentFit="contain"
        nativeControls={started}
        player={player}
        style={{ height, width }}
        surfaceType="textureView"
      />
      {!started ? (
        <Pressable
          className="absolute h-16 w-16 items-center justify-center rounded-full bg-black/45"
          onPress={() => {
            setStarted(true);
            player.play();
          }}
        >
          <Play color="#FFFFFF" fill="#FFFFFF" size={30} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ViewerItem({ item, width, height, onClose, onToggleChrome }: ViewerItemProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    scale.value = withSpring(1, { damping: 40, stiffness: 500 });
    translateX.value = withSpring(0, { damping: 40, stiffness: 500 });
    translateY.value = withSpring(0, { damping: 40, stiffness: 500 });
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.02) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate(event => {
      if (scale.value > 1.01) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      } else {
        translateY.value = event.translationY;
        scale.value = Math.max(0.86, 1 - Math.abs(event.translationY) / height);
      }
    })
    .onEnd(event => {
      if (scale.value <= 1.01 && event.translationY > height * 0.3) {
        runOnJS(onClose)();
        return;
      }
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      if (scale.value <= 1.01) reset();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomed = scale.value > 1.01;
      scale.value = withSpring(zoomed ? 1 : 2, { damping: 35, stiffness: 450 });
      translateX.value = withSpring(0, { damping: 35, stiffness: 450 });
      translateY.value = withSpring(0, { damping: 35, stiffness: 450 });
      savedScale.value = zoomed ? 1 : 2;
      savedX.value = 0;
      savedY.value = 0;
    });

  const singleTap = Gesture.Tap()
    .maxDuration(220)
    .onEnd(() => {
      runOnJS(onToggleChrome)();
    });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  useEffect(() => () => {
    if (loadingTimer.current) clearTimeout(loadingTimer.current);
  }, []);

  if (item.type === 'video') {
    return <VideoSlide height={height} item={item} width={width} />;
  }

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View className="items-center justify-center" style={[{ height, width }, imageStyle]}>
        {item.thumbnailUrl ? (
          <ExpoImage
            blurRadius={8}
            cachePolicy="memory-disk"
            contentFit="contain"
            source={{ uri: item.thumbnailUrl }}
            style={{ height, position: 'absolute', width }}
          />
        ) : null}
        <ExpoImage
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={() => {
            setFailed(true);
            setLoading(false);
          }}
          onLoadEnd={() => {
            if (loadingTimer.current) clearTimeout(loadingTimer.current);
            setLoading(false);
          }}
          onLoadStart={() => {
            setFailed(false);
            loadingTimer.current = setTimeout(() => setLoading(true), 1000);
          }}
          source={{ uri: item.url }}
          style={{ height, width }}
          transition={160}
        />
        {loading ? <ActivityIndicator className="absolute" color="#FFFFFF" /> : null}
        {failed ? (
          <View className="absolute items-center rounded-2xl bg-black/60 px-4 py-3">
            <Text className="font-semibold text-white">Could not load media</Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

export default function MediaViewer({ visible, items, initialIndex = 0, onClose, onReply }: MediaViewerProps) {
  const dimensions = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [chromeVisible, setChromeVisible] = useState(true);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(80);
  const listRef = useRef<FlatList<MediaViewerItem>>(null);
  const currentItem = items[index];

  useEffect(() => {
    if (!visible) return;
    setIndex(initialIndex);
    setChromeVisible(true);
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withSpring(0, { damping: 40, stiffness: 500 });
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ animated: false, index: initialIndex });
    });
  }, [initialIndex, opacity, translateY, visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }]
  }));

  const renderItem = ({ item }: ListRenderItemInfo<MediaViewerItem>) => (
    <ViewerItem
      height={dimensions.height}
      item={item}
      onClose={onClose}
      onToggleChrome={() => setChromeVisible(value => !value)}
      width={dimensions.width}
    />
  );

  const keyExtractor = useMemo(() => (item: MediaViewerItem) => item.id, []);

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={visible}>
      <Animated.View className="flex-1 bg-black" style={containerStyle}>
        <FlatList
          data={items}
          getItemLayout={(_, itemIndex) => ({
            index: itemIndex,
            length: dimensions.width,
            offset: dimensions.width * itemIndex
          })}
          horizontal
          initialScrollIndex={initialIndex}
          keyExtractor={keyExtractor}
          onMomentumScrollEnd={event => {
            setIndex(Math.round(event.nativeEvent.contentOffset.x / dimensions.width));
          }}
          pagingEnabled
          ref={listRef}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          windowSize={3}
        />
        <MediaViewerHeader item={currentItem} onClose={onClose} visible={chromeVisible} />
        <MediaViewerFooter
          index={index}
          item={currentItem}
          onReply={onReply}
          total={items.length}
          visible={chromeVisible}
        />
      </Animated.View>
    </Modal>
  );
}
