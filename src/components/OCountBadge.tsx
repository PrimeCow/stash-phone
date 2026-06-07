import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

interface Props {
  count?: number | null;
  style?: ViewStyle;
}

/** Small o-counter pill. Renders nothing when the count is zero/absent. */
export function OCountBadge({ count, style }: Props) {
  if (!count || count <= 0) return null;
  return (
    <View style={[styles.badge, style]}>
      <Ionicons name="water" size={11} color="#fff" />
      <Text style={styles.text}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
