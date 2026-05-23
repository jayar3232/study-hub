import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, LogOut } from 'lucide-react-native';
import Avatar from '../components/Avatar';
import { useAuth } from '../store/AuthContext';
import type { RootStackParamList } from '../types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-white pt-12">
      <View className="h-14 flex-row items-center px-3">
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-slate-100" onPress={() => navigation.goBack()}>
          <ArrowLeft color="#0F172A" size={22} />
        </Pressable>
        <Text className="ml-2 text-lg font-semibold text-slate-950">Profile</Text>
      </View>

      <View className="items-center px-6 pt-8">
        <Avatar user={user} size={104} sharedTag="profile-avatar" />
        <Text className="mt-5 text-2xl font-bold text-slate-950" numberOfLines={1}>
          {user?.name || 'Syncrova user'}
        </Text>
        <Text className="mt-1 text-sm text-slate-500" numberOfLines={1}>
          {user?.email}
        </Text>
      </View>

      <View className="mt-10 px-5">
        <View className="rounded-3xl bg-slate-50 p-4">
          <Text className="text-xs font-semibold uppercase text-slate-400">Course</Text>
          <Text className="mt-1 text-base text-slate-950" numberOfLines={2}>
            {user?.course || 'Not set'}
          </Text>
          <View className="my-4 h-px bg-slate-200" />
          <Text className="text-xs font-semibold uppercase text-slate-400">Campus</Text>
          <Text className="mt-1 text-base text-slate-950" numberOfLines={2}>
            {user?.campus || 'Not set'}
          </Text>
        </View>

        <Pressable className="mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-red-50" onPress={logout}>
          <LogOut color="#DC2626" size={18} />
          <Text className="font-semibold text-red-600">Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}
