import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OCountBadge } from '@/components/OCountBadge';
import { useOCount } from '@/config/OCountContext';
import { withCookie } from '@/lib/session';
import { authenticatedURL } from '@/lib/stashUrl';
import type { SceneMarker } from '@/types/stash';
import { markerDisplayTitle, markerSubtitleTags, markerTimecode } from '@/types/stash';

interface Props {
  marker: SceneMarker;
  apiKey: string | null;
  onPress: (marker: SceneMarker) => void;
}

export function MarkerCard({ marker, apiKey, onPress }: Props) {
  const url = authenticatedURL(marker.screenshot ?? marker.scene.paths.screenshot, apiKey);
  const subtitle = markerSubtitleTags(marker).join(', ');
  const oCount = useOCount(marker.scene.id, marker.scene.o_counter);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(marker)}>
      <View style={styles.thumbWrap}>
        {url ? (
          <Image style={styles.thumb} source={withCookie(url)} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="bookmark" size={32} color="#555" />
          </View>
        )}
        <View style={styles.timecode}>
          <Text style={styles.timecodeText}>{markerTimecode(marker)}</Text>
        </View>
        <OCountBadge count={oCount} style={styles.oCount} />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {markerDisplayTitle(marker)}
      </Text>
      {subtitle.length > 0 && (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
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
  timecode: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  timecodeText: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  subtitle: { color: '#8a8f94', fontSize: 12, lineHeight: 16 },
});
