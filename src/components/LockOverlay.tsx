import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PinDots, PinPad } from '@/components/PinPad';
import { useAppLock } from '@/config/AppLockContext';

/**
 * Full-screen lock that covers the app whenever it is not unlocked. Rendered as
 * an absolute sibling of the router so the navigator stays mounted underneath
 * (mirrors the tvOS RootView's PIN gate).
 */
export function LockOverlay() {
  const { status, obscured } = useAppLock();
  if (status === 'loading') return null;
  // While unlocked, only show an opaque cover during the background transition
  // so iOS snapshots a blank screen for the app switcher — no PIN pad needed.
  if (status === 'unlocked') {
    return obscured ? <View style={styles.overlay} /> : null;
  }
  return (
    <View style={styles.overlay}>
      {status === 'needsSetup' ? <SetupView /> : <EntryView />}
    </View>
  );
}

function SetupView() {
  const { setupPIN } = useAppLock();
  const [step, setStep] = useState<'first' | 'confirm'>('first');
  const [firstPIN, setFirstPIN] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onComplete(pin: string) {
    if (step === 'first') {
      setFirstPIN(pin);
      setStep('confirm');
      setValue('');
      setError(null);
    } else if (pin === firstPIN) {
      setupPIN(pin);
    } else {
      setError("PINs didn't match — try again.");
      setFirstPIN('');
      setValue('');
      setStep('first');
    }
  }

  return (
    <View style={styles.content}>
      <Ionicons name="shield-checkmark" size={56} color="#8a8f94" />
      <Text style={styles.title}>{step === 'first' ? 'Create a 4-digit PIN' : 'Confirm your PIN'}</Text>
      <Text style={styles.subtitle}>
        {step === 'first' ? 'Required each time you open the app.' : 'Enter it again to confirm.'}
      </Text>
      <PinDots filled={value.length} />
      <Text style={styles.error}>{error ?? ' '}</Text>
      <PinPad value={value} onChange={setValue} onComplete={onComplete} />
    </View>
  );
}

function EntryView() {
  const { verify, lastError } = useAppLock();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onComplete(pin: string) {
    const ok = await verify(pin);
    if (!ok) {
      setError(lastError ?? 'Incorrect PIN');
      setValue('');
    }
  }

  return (
    <View style={styles.content}>
      <Ionicons name="lock-closed" size={56} color="#8a8f94" />
      <Text style={styles.title}>Enter PIN</Text>
      <PinDots filled={value.length} />
      <Text style={styles.error}>{error ?? ' '}</Text>
      <PinPad value={value} onChange={setValue} onComplete={onComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: { alignItems: 'center', gap: 20, paddingHorizontal: 32 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#8a8f94', fontSize: 15, textAlign: 'center' },
  error: { color: '#f85149', fontSize: 14, minHeight: 18 },
});
