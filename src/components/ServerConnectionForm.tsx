import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuthGate } from '@/config/AuthGateContext';
import { useServerConfig, type ConnectionMode } from '@/config/ServerConfigContext';
import { AuthRequiredError, makeClient } from '@/lib/graphql';
import { fetchVersion } from '@/lib/queries';
import { normalizeServerURL } from '@/lib/stashUrl';

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; version: string }
  | { kind: 'needsLogin' }
  | { kind: 'error'; message: string };

interface Props {
  submitLabel: string;
  /** Called after credentials are persisted. */
  onSaved: () => void;
}

/**
 * Server URL + API key fields, a connection-mode selector, and a live connection
 * test. Shared by the onboarding setup screen and the Settings tab; pre-fills from
 * the current config so it doubles as an editor.
 */
export function ServerConnectionForm({ submitLabel, onSaved }: Props) {
  const { serverURL, apiKey, connectionMode, setConfig } = useServerConfig();
  const { promptLogin } = useAuthGate();

  const [url, setUrl] = useState(serverURL ?? '');
  const [key, setKey] = useState(apiKey ?? '');
  const [mode, setMode] = useState<ConnectionMode>(connectionMode);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });

  const normalizedURL = normalizeServerURL(url);
  const canSubmit = normalizedURL != null && test.kind !== 'testing';

  function resetTest() {
    setTest({ kind: 'idle' });
  }

  async function runTest() {
    setTest({ kind: 'testing' });
    try {
      const client = makeClient({
        serverURL: normalizedURL,
        apiKey: key.trim() || null,
        connectionMode: mode,
      });
      const version = await fetchVersion(client);
      setTest({ kind: 'ok', version: version.version });
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setTest({ kind: 'needsLogin' });
      } else {
        setTest({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  async function save() {
    await setConfig(normalizedURL, key.trim() || null, mode);
    onSaved();
  }

  // Persist the URL+mode first so the login WebView knows where to go, then prompt.
  async function logInThenTest() {
    await setConfig(normalizedURL, key.trim() || null, mode);
    promptLogin();
  }

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Connection</Text>
      <View style={styles.segment}>
        <SegmentButton
          label="Direct"
          active={mode === 'direct'}
          onPress={() => {
            setMode('direct');
            resetTest();
          }}
        />
        <SegmentButton
          label="Behind a login page"
          active={mode === 'proxy'}
          onPress={() => {
            setMode('proxy');
            resetTest();
          }}
        />
      </View>
      <Text style={styles.hint}>
        {mode === 'direct'
          ? 'Reach Stash directly (LAN or no reverse-proxy auth).'
          : 'Stash is behind an SSO login page (Authelia, Authentik, …). You’ll sign in via a web page.'}
      </Text>

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
          resetTest();
        }}
      />

      <Text style={styles.label}>
        {mode === 'proxy' ? 'Stash API Key (optional, behind the login)' : 'API Key (optional)'}
      </Text>
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
          resetTest();
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
      {test.kind === 'needsLogin' && (
        <View style={styles.needsLogin}>
          <Text style={styles.hint}>This server requires sign-in.</Text>
          <Pressable style={[styles.button, styles.secondaryButton]} onPress={logInThenTest}>
            <Text style={styles.buttonText}>Log In</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.button, styles.primaryButton, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={save}>
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  label: { color: '#c8ccd0', fontSize: 13, fontWeight: '600', marginTop: 8 },
  hint: { color: '#8a8f94', fontSize: 13, lineHeight: 18 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#1a1b1e',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#e0245e' },
  segmentText: { color: '#c8ccd0', fontSize: 14, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
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
  needsLogin: { gap: 4, marginTop: 4 },
});
