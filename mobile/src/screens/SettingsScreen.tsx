import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Database, Gauge, LogOut } from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useAuth } from '../store/AuthContext';
import type { RootStackParamList } from '../types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const { logout } = useAuth();

  return (
    <View className="flex-1 bg-white pt-12">
      <View className="h-14 flex-row items-center px-3">
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-slate-100" onPress={() => navigation.goBack()}>
          <ArrowLeft color="#0F172A" size={22} />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-slate-950">Settings</Text>
      </View>

      <View className="gap-3 px-5 pt-5">
        <View className="rounded-3xl bg-slate-50 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Gauge color="#0A7CFF" size={20} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-semibold text-slate-950">Native performance mode</Text>
              <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={2}>
                FlashList, Reanimated, and gesture-handler are active in this app.
              </Text>
            </View>
          </View>
        </View>

        <View className="rounded-3xl bg-slate-50 p-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-200">
              <Database color="#0F172A" size={20} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-semibold text-slate-950">Backend</Text>
              <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={3}>
                {API_BASE_URL}
              </Text>
            </View>
          </View>
        </View>

        <Pressable className="mt-2 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-red-50" onPress={logout}>
          <LogOut color="#DC2626" size={18} />
          <Text className="font-semibold text-red-600">Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}
