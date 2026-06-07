import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useServerConfig } from '@/config/ServerConfigContext';
import { makeClient } from '@/lib/graphql';
import { fetchVersion } from '@/lib/queries';

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; version: string }
  | { kind: 'error'; message: string };

interface Props {
  submitLabel: string;
  /** Called after credentials are persisted. */
  onSaved: () => void;
}

/**
 * Server URL + API key fields with a live connection test, shared by the
 * onboarding setup screen and the Settings tab. Pre-fills from the current
 * config so it doubles as an editor.
 */
export function ServerConnectionForm({ submitLabel, onSaved }: Props) {
  const { serverURL, apiKey, setConfig } = useServerConfig();

  const [url, setUrl] = useState(serverURL ?? '');
  const [key, setKey] = useState(apiKey ?? '');
  const [test, setTest] = useState<TestState>({ kind: 'idle' });

  const normalizedURL = url.trim().replace(/\/+$/, '');
  const canSubmit = normalizedURL.length > 0 && test.kind !== 'testing';

  async function runTest() {
    setTest({ kind: 'testing' });
    try {
      const client = makeClient({ serverURL: normalizedURL, apiKey: key.trim() || null });
      const version = await fetchVersion(client);
      setTest({ kind: 'ok', version: version.version });
    } catch (err) {
      setTest({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function save() {
    await setConfig(normalizedURL, key.trim() || null);
    onSaved();
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Server URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://stash.example.com"
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          setTest({ kind: 'idle' });
        }}
      />

      <Text style={styles.label}>API Key (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Leave blank if no auth"
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={key}
        onChangeText={(t) => {
          setKey(t);
          setTest({ kind: 'idle' });
        }}
      />

      <Pressable
        style={[styles.button, styles.secondaryButton, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={runTest}>
        {test.kind === 'testing' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Test Connection</Text>
        )}
      </Pressable>

      {test.kind === 'ok' && <Text style={styles.success}>✓ Connected to Stash v{test.version}</Text>}
      {test.kind === 'error' && <Text style={styles.error}>{test.message}</Text>}

      <Pressable
        style={[styles.button, styles.primaryButton, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={save}>
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  label: { color: '#c8ccd0', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#1a1b1e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2c30',
  },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  primaryButton: { backgroundColor: '#e0245e' },
  secondaryButton: { backgroundColor: '#2a2c30' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  success: { color: '#3fb950', fontSize: 14, marginTop: 4 },
  error: { color: '#f85149', fontSize: 14, marginTop: 4 },
});
