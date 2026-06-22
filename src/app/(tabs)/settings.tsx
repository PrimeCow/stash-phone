import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChangePinModal } from '@/components/ChangePinModal';
import { ServerConnectionForm } from '@/components/ServerConnectionForm';
import { useServerConfig } from '@/config/ServerConfigContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useServerConfig();
  const [savedAt, setSavedAt] = useState(0);
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinChanged, setPinChanged] = useState(false);

  function confirmSignOut() {
    Alert.alert(
      'Sign Out',
      'This clears the saved server URL and API key from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/setup');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.headerTitle}>Settings</Text>

          <Text style={styles.sectionTitle}>Server</Text>
          <ServerConnectionForm submitLabel="Save Changes" onSaved={() => setSavedAt(Date.now())} />
          {savedAt > 0 && <Text style={styles.saved}>✓ Saved</Text>}

          <Text style={[styles.sectionTitle, styles.sectionSpacer]}>Security</Text>
          <Pressable
            style={styles.row}
            onPress={() => {
              setPinChanged(false);
              setShowChangePin(true);
            }}>
            <Ionicons name="key-outline" size={20} color="#fff" />
            <Text style={styles.rowLabel}>Change PIN</Text>
            <Ionicons name="chevron-forward" size={18} color="#5a5e63" />
          </Pressable>
          {pinChanged && <Text style={styles.saved}>✓ PIN updated</Text>}

          <Pressable style={styles.signOut} onPress={confirmSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#f85149" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>

          <Text style={styles.version}>
            stash-phone v{Constants.expoConfig?.version ?? '?'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ChangePinModal
        visible={showChangePin}
        onClose={() => setShowChangePin(false)}
        onChanged={() => {
          setShowChangePin(false);
          setPinChanged(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { padding: 16, paddingBottom: 48 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 16 },
  sectionTitle: {
    color: '#8a8f94',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionSpacer: { marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1a1b1e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { flex: 1, color: '#fff', fontSize: 16 },
  saved: { color: '#3fb950', fontSize: 14, marginTop: 8, textAlign: 'center' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 40,
    paddingVertical: 12,
  },
  signOutText: { color: '#f85149', fontSize: 16, fontWeight: '600' },
  version: { color: '#5a5e63', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
