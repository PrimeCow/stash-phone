import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authenticatedURL } from '@/lib/stashUrl';
import type { Performer } from '@/types/stash';

interface Props {
  performer: Performer;
  apiKey: string | null;
  onPress: (performer: Performer) => void;
}

export function PerformerCard({ performer, apiKey, onPress }: Props) {
  const url = authenticatedURL(performer.image_path, apiKey);
  const count = performer.scene_count;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(performer)}>
      <View style={styles.thumbWrap}>
        {url ? (
          <Image style={styles.thumb} source={{ uri: url }} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="person" size={48} color="#555" />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {performer.name}
      </Text>
      {count != null && (
        <Text style={styles.count}>
          {count} scene{count === 1 ? '' : 's'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 6 },
  pressed: { opacity: 0.7 },
  thumbWrap: {
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1b1e',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 14, fontWeight: '600' },
  count: { color: '#8a8f94', fontSize: 12 },
});
