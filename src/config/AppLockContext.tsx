import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const PIN_ACCOUNT = 'stash.appPIN';

// needsSetup: no PIN stored yet. locked: PIN exists, awaiting entry.
export type LockStatus = 'loading' | 'needsSetup' | 'locked' | 'unlocked';

interface AppLockContextValue {
  status: LockStatus;
  lastError: string | null;
  setupPIN: (pin: string) => Promise<void>;
  verify: (pin: string) => Promise<boolean>;
}

const Ctx = createContext<AppLockContextValue | null>(null);

function isValidPIN(pin: string): boolean {
  return pin.length === 4 && /^[0-9]{4}$/.test(pin);
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LockStatus>('loading');
  const [lastError, setLastError] = useState<string | null>(null);
  const statusRef = useRef<LockStatus>('loading');
  statusRef.current = status;

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(PIN_ACCOUNT);
      setStatus(stored ? 'locked' : 'needsSetup');
    })();
  }, []);

  // Re-lock whenever the app leaves the foreground (matches the tvOS app).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' && statusRef.current === 'unlocked') {
        setStatus('locked');
      }
    });
    return () => sub.remove();
  }, []);

  const setupPIN = useCallback(async (pin: string) => {
    if (!isValidPIN(pin)) return;
    await SecureStore.setItemAsync(PIN_ACCOUNT, pin);
    setLastError(null);
    setStatus('unlocked');
  }, []);

  const verify = useCallback(async (pin: string) => {
    const stored = await SecureStore.getItemAsync(PIN_ACCOUNT);
    if (stored && stored === pin) {
      setLastError(null);
      setStatus('unlocked');
      return true;
    }
    setLastError('Incorrect PIN');
    return false;
  }, []);

  const value = useMemo<AppLockContextValue>(
    () => ({ status, lastError, setupPIN, verify }),
    [status, lastError, setupPIN, verify]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
