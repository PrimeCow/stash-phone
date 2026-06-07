import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LockOverlay } from '@/components/LockOverlay';
import { LoginOverlay } from '@/components/LoginOverlay';
import { AppLockProvider } from '@/config/AppLockContext';
import { AuthGateProvider } from '@/config/AuthGateContext';
import { FilterPrefsProvider } from '@/config/FilterPrefsContext';
import { OCountProvider } from '@/config/OCountContext';
import { PlaybackProvider } from '@/config/PlaybackContext';
import { ServerConfigProvider } from '@/config/ServerConfigContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLockProvider>
        <ServerConfigProvider>
          <AuthGateProvider>
            <FilterPrefsProvider>
              <OCountProvider>
              <PlaybackProvider>
                <ThemeProvider value={DarkTheme}>
                  <StatusBar style="light" />
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: '#000' },
                    }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="setup" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="performer/[id]" />
                    <Stack.Screen name="group/[id]" />
                    <Stack.Screen
                      name="player"
                      options={{ presentation: 'fullScreenModal', animation: 'fade' }}
                    />
                  </Stack>
                  <LoginOverlay />
                  <LockOverlay />
                </ThemeProvider>
              </PlaybackProvider>
              </OCountProvider>
            </FilterPrefsProvider>
          </AuthGateProvider>
        </ServerConfigProvider>
      </AppLockProvider>
    </GestureHandlerRootView>
  );
}
