import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { FilterPrefsProvider } from '@/config/FilterPrefsContext';
import { PlaybackProvider } from '@/config/PlaybackContext';
import { ServerConfigProvider } from '@/config/ServerConfigContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ServerConfigProvider>
        <FilterPrefsProvider>
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
            </ThemeProvider>
          </PlaybackProvider>
        </FilterPrefsProvider>
      </ServerConfigProvider>
    </GestureHandlerRootView>
  );
}
