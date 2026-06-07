import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function PinDots({ filled, total = 4 }: { filled: number; total?: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i < filled && styles.dotFilled]} />
      ))}
    </View>
  );
}

type Key = number | 'clear' | 'backspace';

const ROWS: Key[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  ['clear', 0, 'backspace'],
];

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  onComplete: (pin: string) => void;
  maxLength?: number;
}

export function PinPad({ value, onChange, onComplete, maxLength = 4 }: PinPadProps) {
  function handle(key: Key) {
    if (key === 'clear') {
      onChange('');
      return;
    }
    if (key === 'backspace') {
      if (value.length > 0) onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    const next = value + String(key);
    onChange(next);
    if (next.length === maxLength) onComplete(next);
  }

  return (
    <View style={styles.pad}>
      {ROWS.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={String(key)}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
              onPress={() => handle(key)}>
              {key === 'backspace' ? (
                <Ionicons name="backspace-outline" size={26} color="#fff" />
              ) : key === 'clear' ? (
                <Text style={styles.keyClear}>Clear</Text>
              ) : (
                <Text style={styles.keyDigit}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 18 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotFilled: { backgroundColor: '#fff' },
  pad: { gap: 16 },
  row: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1a1b1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: '#2a2c30' },
  keyDigit: { color: '#fff', fontSize: 30, fontWeight: '500' },
  keyClear: { color: '#c8ccd0', fontSize: 15 },
});
