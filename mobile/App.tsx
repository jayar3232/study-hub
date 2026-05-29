import 'react-native-gesture-handler';
import './global.css';

import React from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useOnlineStatus } from './src/hooks/useOnlineStatus';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider, useAuth } from './src/store/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { getEntityId } from './src/utils/ids';

function PresenceBootstrap() {
  const { user } = useAuth();
  useOnlineStatus(getEntityId(user));
  return null;
}

function ThemedStatusBar() {
  const { resolvedMode } = useTheme();
  return <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <PresenceBootstrap />
            <ThemedStatusBar />
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  }
});
