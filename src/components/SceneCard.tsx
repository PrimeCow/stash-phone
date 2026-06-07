import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OCountBadge } from '@/components/OCountBadge';
import { useOCount } from '@/config/OCountContext';
import { authenticatedURL } from '@/lib/stashUrl';
import type { Scene } from '@/types/stash';
import { sceneDisplayTitle } from '@/types/stash';

interface Props {
  scene: Scene;
  apiKey: string | null;
  onPress: (scene: Scene) => void;
}

export function SceneCard({ scene, apiKey, onPress }: Props) {
  const url = authenticatedURL(scene.paths.screenshot, apiKey);
  const tags = scene.tags.map((t) => t.name).join(', ');
  const oCount = useOCount(scene.id, scene.o_counter);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(scene)}>
      <View style={styles.thumbWrap}>
        {url ? (
          <Image
            style={styles.thumb}
            source={{ uri: url }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={36} color="#555" />
          </View>
        )}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={14} color="#fff" />
        </View>
        <OCountBadge count={oCount} style={styles.oCount} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {sceneDisplayTitle(scene)}
      </Text>
      {tags.length > 0 && (
        <Text style={styles.tags} numberOfLines={2}>
          {tags}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 6 },
  pressed: { opacity: 0.7 },
  thumbWrap: {
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1b1e',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  oCount: { position: 'absolute', top: 6, left: 6 },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tags: { color: '#8a8f94', fontSize: 12, lineHeight: 16 },
});
