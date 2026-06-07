import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface AuthGateContextValue {
  /** Whether the web login overlay is currently shown. */
  loginVisible: boolean;
  /** Bumped after each successful web login, so data hooks can reload. */
  authEpoch: number;
  /** Show the web login overlay (e.g. after an AuthRequiredError). */
  promptLogin: () => void;
  /** Called by the login overlay when the user finishes logging in. */
  completeLogin: () => void;
  /** Dismiss the overlay without logging in. */
  cancelLogin: () => void;
}

const Ctx = createContext<AuthGateContextValue | null>(null);

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const [loginVisible, setLoginVisible] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);

  const promptLogin = useCallback(() => setLoginVisible(true), []);
  const cancelLogin = useCallback(() => setLoginVisible(false), []);
  const completeLogin = useCallback(() => {
    setLoginVisible(false);
    setAuthEpoch((n) => n + 1);
  }, []);

  const value = useMemo<AuthGateContextValue>(
    () => ({ loginVisible, authEpoch, promptLogin, completeLogin, cancelLogin }),
    [loginVisible, authEpoch, promptLogin, completeLogin, cancelLogin]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuthGate must be used within AuthGateProvider');
  return ctx;
}
