import { ScrollView, StyleSheet, Text, Pressable } from 'react-native';

export interface Chip {
  id: string;
  title: string;
}

interface Props {
  chips: Chip[];
  activeID: string | null;
  onSelect: (id: string) => void;
}

export function FilterChipBar({ chips, activeID, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {chips.map((chip) => {
        const active = chip.id === activeID;
        return (
          <Pressable
            key={chip.id}
            onPress={() => onSelect(chip.id)}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {chip.title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1a1b1e',
    borderWidth: 1,
    borderColor: '#2a2c30',
  },
  chipActive: { backgroundColor: '#e0245e', borderColor: '#e0245e' },
  chipText: { color: '#c8ccd0', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
});
