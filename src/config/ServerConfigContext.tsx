import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SERVER_URL_KEY = 'stash.serverURL';
const API_KEY_ACCOUNT = 'stash.apiKey';
const CONNECTION_MODE_KEY = 'stash.connectionMode';

// 'direct': reach Stash directly with an optional Stash API key (LAN / no proxy).
// 'proxy':  Stash sits behind a login page (Authelia, Authentik, …); the user
//           logs in via a web session whose cookie then authorizes all requests.
export type ConnectionMode = 'direct' | 'proxy';

export interface ServerConfig {
  serverURL: string | null;
  apiKey: string | null;
  connectionMode: ConnectionMode;
}

interface ServerConfigContextValue extends ServerConfig {
  isLoaded: boolean;
  isConfigured: boolean;
  setConfig: (
    serverURL: string | null,
    apiKey: string | null,
    connectionMode: ConnectionMode
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<ServerConfigContextValue | null>(null);

export function ServerConfigProvider({ children }: { children: React.ReactNode }) {
  const [serverURL, setServerURL] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('direct');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [url, mode, key] = await Promise.all([
          AsyncStorage.getItem(SERVER_URL_KEY),
          AsyncStorage.getItem(CONNECTION_MODE_KEY),
          SecureStore.getItemAsync(API_KEY_ACCOUNT),
        ]);
        setServerURL(url);
        setConnectionMode(mode === 'proxy' ? 'proxy' : 'direct');
        setApiKey(key);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setConfig = React.useCallback(
    async (url: string | null, key: string | null, mode: ConnectionMode) => {
      const normalizedURL = url?.trim().replace(/\/+$/, '') || null;
      const normalizedKey = key?.trim() || null;

      if (normalizedURL) await AsyncStorage.setItem(SERVER_URL_KEY, normalizedURL);
      else await AsyncStorage.removeItem(SERVER_URL_KEY);

      await AsyncStorage.setItem(CONNECTION_MODE_KEY, mode);

      if (normalizedKey) await SecureStore.setItemAsync(API_KEY_ACCOUNT, normalizedKey);
      else await SecureStore.deleteItemAsync(API_KEY_ACCOUNT);

      setServerURL(normalizedURL);
      setConnectionMode(mode);
      setApiKey(normalizedKey);
    },
    []
  );

  const signOut = React.useCallback(() => setConfig(null, null, 'direct'), [setConfig]);

  const value = useMemo<ServerConfigContextValue>(
    () => ({
      serverURL,
      apiKey,
      connectionMode,
      isLoaded,
      isConfigured: serverURL != null,
      setConfig,
      signOut,
    }),
    [serverURL, apiKey, connectionMode, isLoaded, setConfig, signOut]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServerConfig(): ServerConfigContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useServerConfig must be used within ServerConfigProvider');
  return ctx;
}
