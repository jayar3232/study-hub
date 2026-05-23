import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../screens/ChatListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useAuth } from '../store/AuthContext';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function BootScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color="#0A7CFF" size="large" />
    </View>
  );
}

export default function AppNavigator() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return <BootScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#FFFFFF' }
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
