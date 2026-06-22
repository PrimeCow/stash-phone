import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinDots, PinPad } from '@/components/PinPad';
import { useAppLock } from '@/config/AppLockContext';

type Step = 'current' | 'new' | 'confirm';

const TITLES: Record<Step, string> = {
  current: 'Enter current PIN',
  new: 'Enter new PIN',
  confirm: 'Confirm new PIN',
};

/**
 * Settings sheet for changing the app PIN. Confirms the current PIN, then takes
 * the new one twice before writing it via AppLockContext.changePIN. Reuses the
 * same PinPad/PinDots as the lock screen so the entry feels identical.
 */
export function ChangePinModal({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { changePIN } = useAppLock();
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [firstNew, setFirstNew] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep('current');
    setCurrent('');
    setFirstNew('');
    setValue('');
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function onComplete(pin: string) {
    if (step === 'current') {
      setCurrent(pin);
      setStep('new');
      setValue('');
      setError(null);
      return;
    }
    if (step === 'new') {
      setFirstNew(pin);
      setStep('confirm');
      setValue('');
      setError(null);
      return;
    }
    // confirm
    if (pin !== firstNew) {
      setError("PINs didn't match — try again.");
      setFirstNew('');
      setValue('');
      setStep('new');
      return;
    }
    const ok = await changePIN(current, pin);
    if (ok) {
      reset();
      onChanged();
    } else {
      // changePIN only fails here if the current PIN was wrong (new PIN is
      // already validated as 4 digits by the pad), so send the user back.
      setError('Current PIN was incorrect.');
      setCurrent('');
      setFirstNew('');
      setValue('');
      setStep('current');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.bar}>
          <Pressable onPress={close} hitSlop={12} style={styles.barBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.barTitle}>Change PIN</Text>
          <View style={styles.barBtn} />
        </View>
        <View style={styles.content}>
          <Ionicons name="lock-closed" size={56} color="#8a8f94" />
          <Text style={styles.title}>{TITLES[step]}</Text>
          <PinDots filled={value.length} />
          <Text style={styles.error}>{error ?? ' '}</Text>
          <PinPad value={value} onChange={setValue} onComplete={onComplete} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  barBtn: { minWidth: 50 },
  barTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  error: { color: '#f85149', fontSize: 14, minHeight: 18 },
});
