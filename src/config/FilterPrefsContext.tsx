import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Phase 1 covers the Scenes mode only; markers prefs come with the Markers tab.
export const RECENT_SCENES_ID = 'recent';

const KEYS = {
  enabledFilterIDs: 'stash.enabledFilterIDs',
  showRecentScenes: 'stash.showRecentScenes',
  activeFilterID: 'stash.activeFilterID',
};

interface FilterPrefsContextValue {
  isLoaded: boolean;
  enabledFilterIDs: string[];
  showRecentScenes: boolean;
  activeFilterID: string | null;
  setEnabledFilterIDs: (ids: string[]) => void;
  toggleFilter: (id: string) => void;
  setShowRecentScenes: (value: boolean) => void;
  setActiveFilterID: (id: string | null) => void;
}

const Ctx = createContext<FilterPrefsContextValue | null>(null);

export function FilterPrefsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [enabledFilterIDs, setEnabledState] = useState<string[]>([]);
  const [showRecentScenes, setShowRecentState] = useState(true);
  const [activeFilterID, setActiveState] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          KEYS.enabledFilterIDs,
          KEYS.showRecentScenes,
          KEYS.activeFilterID,
        ]);
        const map = Object.fromEntries(entries);
        if (map[KEYS.enabledFilterIDs]) {
          setEnabledState(JSON.parse(map[KEYS.enabledFilterIDs]!));
        }
        if (map[KEYS.showRecentScenes] != null) {
          setShowRecentState(map[KEYS.showRecentScenes] === 'true');
        }
        setActiveState(map[KEYS.activeFilterID] ?? null);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setEnabledFilterIDs = useCallback((ids: string[]) => {
    setEnabledState(ids);
    AsyncStorage.setItem(KEYS.enabledFilterIDs, JSON.stringify(ids));
  }, []);

  const toggleFilter = useCallback((id: string) => {
    setEnabledState((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(KEYS.enabledFilterIDs, JSON.stringify(next));
      return next;
    });
  }, []);

  const setShowRecentScenes = useCallback((value: boolean) => {
    setShowRecentState(value);
    AsyncStorage.setItem(KEYS.showRecentScenes, String(value));
  }, []);

  const setActiveFilterID = useCallback((id: string | null) => {
    setActiveState(id);
    if (id) AsyncStorage.setItem(KEYS.activeFilterID, id);
    else AsyncStorage.removeItem(KEYS.activeFilterID);
  }, []);

  const value = useMemo<FilterPrefsContextValue>(
    () => ({
      isLoaded,
      enabledFilterIDs,
      showRecentScenes,
      activeFilterID,
      setEnabledFilterIDs,
      toggleFilter,
      setShowRecentScenes,
      setActiveFilterID,
    }),
    [
      isLoaded,
      enabledFilterIDs,
      showRecentScenes,
      activeFilterID,
      setEnabledFilterIDs,
      toggleFilter,
      setShowRecentScenes,
      setActiveFilterID,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilterPrefs(): FilterPrefsContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilterPrefs must be used within FilterPrefsProvider');
  return ctx;
}
