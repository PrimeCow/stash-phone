import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { withCookie } from '@/lib/session';
import { authenticatedURL } from '@/lib/stashUrl';
import type { Group } from '@/types/stash';

interface Props {
  group: Group;
  apiKey: string | null;
  onPress: (group: Group) => void;
}

export function GroupCard({ group, apiKey, onPress }: Props) {
  const url = authenticatedURL(group.front_image_path ?? group.back_image_path, apiKey);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(group)}>
      <View style={styles.thumbWrap}>
        {url ? (
          <Image style={styles.thumb} source={withCookie(url)} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="albums" size={44} color="#555" />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {group.name}
      </Text>
      <Text style={styles.count}>
        {group.scene_count} scene{group.scene_count === 1 ? '' : 's'}
      </Text>
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
