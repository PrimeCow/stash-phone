import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// Filterable browse modes. Each maps to a Stash FilterMode and keeps its own
// enabled-filter set, active chip, and "recent" toggle — mirroring the tvOS app.
export type BrowseMode = 'scenes' | 'markers';

export const MODE_INFO: Record<
  BrowseMode,
  { recentChipID: string; stashFilterMode: string }
> = {
  scenes: { recentChipID: 'recent', stashFilterMode: 'SCENES' },
  markers: { recentChipID: 'recent_markers', stashFilterMode: 'SCENE_MARKERS' },
};

interface ModeState {
  enabledFilterIDs: string[];
  showRecent: boolean;
  activeFilterID: string | null;
}

const DEFAULT_MODE_STATE: ModeState = {
  enabledFilterIDs: [],
  showRecent: true,
  activeFilterID: null,
};

function keyFor(mode: BrowseMode) {
  return {
    enabled: `stash.${mode}.enabledFilterIDs`,
    showRecent: `stash.${mode}.showRecent`,
    active: `stash.${mode}.activeFilterID`,
  };
}

export interface ModeFilterPrefs {
  isLoaded: boolean;
  recentChipID: string;
  enabledFilterIDs: string[];
  showRecent: boolean;
  activeFilterID: string | null;
  toggleFilter: (id: string) => void;
  setShowRecent: (value: boolean) => void;
  setActiveFilterID: (id: string | null) => void;
}

interface FilterPrefsContextValue {
  isLoaded: boolean;
  states: Record<BrowseMode, ModeState>;
  update: (mode: BrowseMode, patch: Partial<ModeState>) => void;
}

const Ctx = createContext<FilterPrefsContextValue | null>(null);

export function FilterPrefsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [states, setStates] = useState<Record<BrowseMode, ModeState>>({
    scenes: { ...DEFAULT_MODE_STATE },
    markers: { ...DEFAULT_MODE_STATE },
  });

  useEffect(() => {
    (async () => {
      try {
        const modes: BrowseMode[] = ['scenes', 'markers'];
        const allKeys = modes.flatMap((m) => Object.values(keyFor(m)));
        const entries = Object.fromEntries(await AsyncStorage.multiGet(allKeys));
        const next = {} as Record<BrowseMode, ModeState>;
        for (const m of modes) {
          const k = keyFor(m);
          next[m] = {
            enabledFilterIDs: entries[k.enabled] ? JSON.parse(entries[k.enabled]!) : [],
            showRecent: entries[k.showRecent] != null ? entries[k.showRecent] === 'true' : true,
            activeFilterID: entries[k.active] ?? null,
          };
        }
        setStates(next);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const update = useCallback((mode: BrowseMode, patch: Partial<ModeState>) => {
    setStates((prev) => {
      const merged = { ...prev[mode], ...patch };
      const k = keyFor(mode);
      if (patch.enabledFilterIDs !== undefined) {
        AsyncStorage.setItem(k.enabled, JSON.stringify(merged.enabledFilterIDs));
      }
      if (patch.showRecent !== undefined) {
        AsyncStorage.setItem(k.showRecent, String(merged.showRecent));
      }
      if (patch.activeFilterID !== undefined) {
        if (merged.activeFilterID) AsyncStorage.setItem(k.active, merged.activeFilterID);
        else AsyncStorage.removeItem(k.active);
      }
      return { ...prev, [mode]: merged };
    });
  }, []);

  const value = useMemo<FilterPrefsContextValue>(
    () => ({ isLoaded, states, update }),
    [isLoaded, states, update]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Mode-scoped view of the filter preferences, matching the tvOS per-mode API. */
export function useModeFilterPrefs(mode: BrowseMode): ModeFilterPrefs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useModeFilterPrefs must be used within FilterPrefsProvider');
  const state = ctx.states[mode];

  const toggleFilter = useCallback(
    (id: string) => {
      const set = ctx.states[mode].enabledFilterIDs;
      const next = set.includes(id) ? set.filter((x) => x !== id) : [...set, id];
      ctx.update(mode, { enabledFilterIDs: next });
    },
    [ctx, mode]
  );

  const setShowRecent = useCallback(
    (value: boolean) => ctx.update(mode, { showRecent: value }),
    [ctx, mode]
  );

  const setActiveFilterID = useCallback(
    (id: string | null) => ctx.update(mode, { activeFilterID: id }),
    [ctx, mode]
  );

  return {
    isLoaded: ctx.isLoaded,
    recentChipID: MODE_INFO[mode].recentChipID,
    enabledFilterIDs: state.enabledFilterIDs,
    showRecent: state.showRecent,
    activeFilterID: state.activeFilterID,
    toggleFilter,
    setShowRecent,
    setActiveFilterID,
  };
}
