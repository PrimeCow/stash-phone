import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ServerConnectionForm } from '@/components/ServerConnectionForm';

export default function SetupScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Connect to Stash</Text>
          <Text style={styles.subtitle}>
            Enter your self-hosted Stash server URL and (if required) an API key from
            Settings → Security.
          </Text>

          <ServerConnectionForm
            submitLabel="Save & Continue"
            onSaved={() => router.replace('/(tabs)')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 24 },
  subtitle: { color: '#9aa0a6', fontSize: 15, lineHeight: 21, marginBottom: 12 },
});
