import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SceneCard } from '@/components/SceneCard';
import { useAuthGate } from '@/config/AuthGateContext';
import { usePlayback } from '@/config/PlaybackContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { AuthRequiredError, makeClient } from '@/lib/graphql';
import { fetchGroup } from '@/lib/queries';
import { authenticatedURL } from '@/lib/stashUrl';
import type { Group, Scene } from '@/types/stash';

export default function GroupDetailScreen() {
  const router = useRouter();
  const server = useServerConfig();
  const { setPlaylist } = usePlayback();
  const { promptLogin, authEpoch } = useAuthGate();
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();

  const initial = useMemo<Group | null>(() => {
    if (!data) return null;
    try {
      return JSON.parse(data) as Group;
    } catch {
      return null;
    }
  }, [data]);

  const [group, setGroup] = useState<Group | null>(initial);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const client = makeClient(server);
        const full = await fetchGroup(client, id);
        if (cancelled) return;
        if (full) {
          setGroup(full);
          setStatus('loaded');
        } else {
          setStatus('error');
          setErrorMessage('Group not found on server.');
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthRequiredError) {
          promptLogin();
          return;
        }
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, server, authEpoch, promptLogin]);

  const scenes = group?.scenes ?? [];

  const playFrom = useCallback(
    (startIndex: number) => {
      if (scenes.length === 0) return;
      setPlaylist({ scenes, startIndex, title: group?.name });
      router.push('/player');
    },
    [scenes, group, router, setPlaylist]
  );

  const headerURL = authenticatedURL(
    group?.front_image_path ?? group?.back_image_path,
    server.apiKey
  );

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.headerRow}>
        {headerURL ? (
          <Image style={styles.cover} source={{ uri: headerURL }} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="albums" size={44} color="#555" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{group?.name ?? 'Group'}</Text>
          {group?.studio?.name ? <Text style={styles.studio}>{group.studio.name}</Text> : null}
          {group?.synopsis ? (
            <Text style={styles.synopsis} numberOfLines={6}>
              {group.synopsis}
            </Text>
          ) : null}
        </View>
      </View>
      {scenes.length > 0 && (
        <Pressable style={styles.playAll} onPress={() => playFrom(0)}>
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.playAllText}>Play All</Text>
        </Pressable>
      )}
      <Text style={styles.sectionTitle}>Scenes</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>

      {status === 'loading' && scenes.length === 0 ? (
        <View style={styles.center}>{header}<ActivityIndicator color="#fff" /></View>
      ) : status === 'error' && scenes.length === 0 ? (
        <View style={styles.center}>
          {header}
          <Ionicons name="warning-outline" size={40} color="#f85149" />
          <Text style={styles.error}>{errorMessage}</Text>
        </View>
      ) : (
        <FlashList
          data={scenes}
          keyExtractor={(s) => s.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          ListHeaderComponent={header}
          ListEmptyComponent={
            status === 'loaded' ? (
              <Text style={styles.dim}>This group has no scenes yet.</Text>
            ) : null
          }
          renderItem={({ item, index }: { item: Scene; index: number }) => (
            <View style={styles.cell}>
              <SceneCard scene={item} apiKey={server.apiKey} onPress={() => playFrom(index)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  back: {
    position: 'absolute',
    top: 50,
    left: 8,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: { paddingHorizontal: 12, paddingBottom: 24 },
  cell: { flex: 1, padding: 4 },
  headerBlock: { paddingTop: 44, paddingHorizontal: 4, gap: 16, marginBottom: 8 },
  headerRow: { flexDirection: 'row', gap: 16 },
  cover: { width: 120, height: 180, borderRadius: 12, backgroundColor: '#1a1b1e' },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 6 },
  name: { color: '#fff', fontSize: 24, fontWeight: '700' },
  studio: { color: '#c8ccd0', fontSize: 15 },
  synopsis: { color: '#8a8f94', fontSize: 13, lineHeight: 18 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  playAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e0245e',
    paddingVertical: 12,
    borderRadius: 10,
  },
  playAllText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  dim: { color: '#8a8f94', fontSize: 15, textAlign: 'center', padding: 24 },
  error: { color: '#f85149', fontSize: 14, textAlign: 'center' },
});
