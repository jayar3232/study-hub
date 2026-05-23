import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Camera, ImagePlus, Send, X } from 'lucide-react-native';
import type { ImagePickerAsset } from 'expo-image-picker';

type MessageInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttach: (assets: ImagePickerAsset[]) => void;
  sending?: boolean;
  replyLabel?: string;
  onClearReply?: () => void;
};

export default function MessageInput({
  value,
  onChangeText,
  onSend,
  onAttach,
  sending = false,
  replyLabel,
  onClearReply
}: MessageInputProps) {
  const scale = useSharedValue(1);
  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const canSend = Boolean(value.trim()) && !sending;

  const pickLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach media.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.86,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium
    });

    if (!result.canceled) onAttach(result.assets);
  };

  const openCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to capture media.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.86,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium
    });

    if (!result.canceled) onAttach(result.assets);
  };

  return (
    <View className="border-t border-slate-200/80">
      <BlurView intensity={82} style={StyleSheet.absoluteFill} tint="light" />
      <View className="px-3 pb-3 pt-2">
        {replyLabel ? (
          <View className="mb-2 flex-row items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2">
            <View className="h-8 w-1 rounded-full bg-blue-600" />
            <Text className="flex-1 text-xs text-slate-600" numberOfLines={2}>
              {replyLabel}
            </Text>
            <Pressable className="h-8 w-8 items-center justify-center rounded-full bg-white" onPress={onClearReply}>
              <X color="#475569" size={16} />
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-end gap-2">
          <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-slate-100" onPress={pickLibrary}>
            <ImagePlus color="#0A7CFF" size={22} />
          </Pressable>
          <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-slate-100" onPress={openCamera}>
            <Camera color="#0A7CFF" size={22} />
          </Pressable>
          <TextInput
            className="max-h-32 min-h-11 flex-1 rounded-3xl bg-slate-100 px-4 py-3 text-[15px] text-slate-950"
            multiline
            numberOfLines={1}
            onChangeText={onChangeText}
            placeholder="Message"
            placeholderTextColor="#94A3B8"
            value={value}
          />
          <Animated.View style={sendStyle}>
            <Pressable
              className={`h-11 w-11 items-center justify-center rounded-full ${canSend ? 'bg-blue-600' : 'bg-slate-300'}`}
              disabled={!canSend}
              onPress={onSend}
              onPressIn={() => {
                scale.value = withSpring(0.88, { damping: 14, stiffness: 280 });
              }}
              onPressOut={() => {
                scale.value = withSpring(1, { damping: 14, stiffness: 280 });
              }}
            >
              {sending ? <ActivityIndicator color="white" size="small" /> : <Send color="white" size={19} />}
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
