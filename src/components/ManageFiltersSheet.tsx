import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useModeFilterPrefs, type BrowseMode } from '@/config/FilterPrefsContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import type { SavedFilter } from '@/types/stash';

interface Props {
  visible: boolean;
  onClose: () => void;
  mode: BrowseMode;
  savedFilters: SavedFilter[];
}

export function ManageFiltersSheet({ visible, onClose, mode, savedFilters }: Props) {
  const prefs = useModeFilterPrefs(mode);
  const config = useServerConfig();
  const recentLabel = mode === 'markers' ? 'Recent Markers' : 'Recent Scenes';
  const recentSub = mode === 'markers' ? 'Newest markers, no filter' : 'Newest scenes, no filter';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Row
            label={recentLabel}
            sublabel={recentSub}
            value={prefs.showRecent}
            onValueChange={prefs.setShowRecent}
          />

          {savedFilters.length > 0 && <Text style={styles.sectionTitle}>Saved Filters</Text>}
          {savedFilters.map((f) => (
            <Row
              key={f.id}
              label={f.name}
              value={prefs.enabledFilterIDs.includes(f.id)}
              onValueChange={() => prefs.toggleFilter(f.id)}
            />
          ))}

          {savedFilters.length === 0 && (
            <Text style={styles.empty}>
              No saved filters found on this server. Create them in the Stash web UI.
            </Text>
          )}

          <Pressable style={styles.signOut} onPress={config.signOut}>
            <Ionicons name="log-out-outline" size={18} color="#f85149" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Row({
  label,
  sublabel,
  value,
  onValueChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel && <Text style={styles.rowSub}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: '#e0245e', false: '#3a3c40' }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  closeBtn: { padding: 4 },
  content: { padding: 16, gap: 4 },
  sectionTitle: {
    color: '#8a8f94',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1c1d20',
  },
  rowLabel: { color: '#fff', fontSize: 16 },
  rowSub: { color: '#8a8f94', fontSize: 13, marginTop: 2 },
  empty: { color: '#8a8f94', fontSize: 14, marginTop: 16, lineHeight: 20 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    paddingVertical: 12,
  },
  signOutText: { color: '#f85149', fontSize: 16, fontWeight: '600' },
});
