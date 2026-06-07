import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePlayback } from '@/config/PlaybackContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { authenticatedURL } from '@/lib/stashUrl';

export default function PlayerScreen() {
  const router = useRouter();
  const { playlist } = usePlayback();
  const { apiKey } = useServerConfig();

  // Build the ordered list of playable stream URLs from startIndex onward.
  const items = useMemo(() => {
    if (!playlist) return [];
    return playlist.scenes
      .slice(playlist.startIndex)
      .map((scene) => authenticatedURL(scene.paths.stream, apiKey))
      .filter((url): url is string => url != null);
  }, [playlist, apiKey]);

  const [index, setIndex] = useState(0);
  // Keep a live ref to items so the listener always sees the current list.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const player = useVideoPlayer(items[0] ?? null, (p) => {
    if (playlist?.startTime && playlist.startTime > 0) {
      p.currentTime = playlist.startTime;
    }
    p.play();
  });

  // Auto-advance through the playlist when each item finishes.
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next < itemsRef.current.length) {
          player.replace(itemsRef.current[next]);
          player.play();
          return next;
        }
        return prev;
      });
    });
    return () => sub.remove();
  }, [player]);

  if (!playlist || items.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={40} color="#f85149" />
        <Text style={styles.errorText}>No playable stream for this scene.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        allowsPictureInPicture
        nativeControls
      />
      <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-down" size={28} color="#fff" />
      </Pressable>
      {items.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {items.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 56,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: { color: '#f85149', fontSize: 15 },
  backBtn: { backgroundColor: '#e0245e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backText: { color: '#fff', fontWeight: '600' },
});
