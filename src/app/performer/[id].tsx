import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaginatedGrid } from '@/components/PaginatedGrid';
import { SceneCard } from '@/components/SceneCard';
import { singleScenePlaylist, usePlayback } from '@/config/PlaybackContext';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { fetchScenesForPerformer } from '@/lib/queries';
import { withCookie } from '@/lib/session';
import { authenticatedURL } from '@/lib/stashUrl';
import type { Performer, Scene } from '@/types/stash';
import { performerAliasesText } from '@/types/stash';

function metadataLine(p: Performer): string {
  const parts: string[] = [];
  if (p.gender) parts.push(p.gender.charAt(0).toUpperCase() + p.gender.slice(1).toLowerCase());
  if (p.country) parts.push(p.country);
  if (p.birthdate) parts.push(`b. ${p.birthdate}`);
  if (p.scene_count != null) parts.push(`${p.scene_count} scenes`);
  return parts.join(' · ');
}

export default function PerformerDetailScreen() {
  const router = useRouter();
  const { setPlaylist } = usePlayback();
  const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();

  const performer = useMemo<Performer | null>(() => {
    if (!data) return null;
    try {
      return JSON.parse(data) as Performer;
    } catch {
      return null;
    }
  }, [data]);

  const fetchPage = useCallback(
    async (client: Parameters<typeof fetchScenesForPerformer>[0], page: number, perPage: number) => {
      const result = await fetchScenesForPerformer(client, id, page, perPage);
      return { count: result.count, items: result.scenes };
    },
    [id]
  );

  const list = usePaginatedList<Scene>(fetchPage, [id]);

  const playScene = useCallback(
    (scene: Scene) => {
      setPlaylist(singleScenePlaylist(scene));
      router.push('/player');
    },
    [router, setPlaylist]
  );

  const playAll = useCallback(() => {
    if (list.items.length === 0) return;
    setPlaylist({
      scenes: list.items,
      startIndex: 0,
      title: performer?.name,
    });
    router.push('/player');
  }, [list.items, performer, router, setPlaylist]);

  const imageURL = authenticatedURL(performer?.image_path, list.apiKey);
  const aliases = performer ? performerAliasesText(performer) : null;
  const meta = performer ? metadataLine(performer) : '';

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.headerRow}>
        {imageURL ? (
          <Image style={styles.portrait} source={withCookie(imageURL)} contentFit="cover" />
        ) : (
          <View style={[styles.portrait, styles.portraitPlaceholder]}>
            <Ionicons name="person" size={48} color="#555" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{performer?.name ?? 'Performer'}</Text>
          {aliases ? <Text style={styles.aliases}>{aliases}</Text> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
      </View>
      {list.items.length > 0 && (
        <Pressable style={styles.playAll} onPress={playAll}>
          <Ionicons name="play" size={18} color="#fff" />
          <Text style={styles.playAllText}>Play All</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>
      <PaginatedGrid<Scene>
        result={list}
        numColumns={2}
        getId={(s) => s.id}
        emptyText="This performer has no scenes yet."
        header={header}
        renderCard={(scene, apiKey) => (
          <SceneCard scene={scene} apiKey={apiKey} onPress={playScene} />
        )}
      />
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
  headerBlock: { paddingTop: 44, paddingHorizontal: 4, gap: 16, marginBottom: 8 },
  headerRow: { flexDirection: 'row', gap: 16 },
  portrait: { width: 120, height: 180, borderRadius: 12, backgroundColor: '#1a1b1e' },
  portraitPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 6 },
  name: { color: '#fff', fontSize: 24, fontWeight: '700' },
  aliases: { color: '#c8ccd0', fontSize: 15 },
  meta: { color: '#8a8f94', fontSize: 13 },
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
});
