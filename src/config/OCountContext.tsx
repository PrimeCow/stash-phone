import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Session-wide overrides for scene o-counters. When the player increments a
 * scene's o-count, the browse grids hold their own (now-stale) copy of that
 * scene — this store lets the new value propagate to every card without
 * refetching the list. Keyed by scene id.
 */
interface OCountContextValue {
  overrides: Record<string, number>;
  setOCount: (sceneID: string, count: number) => void;
}

const Ctx = createContext<OCountContextValue | null>(null);

export function OCountProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const setOCount = useCallback((sceneID: string, count: number) => {
    setOverrides((prev) => (prev[sceneID] === count ? prev : { ...prev, [sceneID]: count }));
  }, []);

  const value = useMemo<OCountContextValue>(() => ({ overrides, setOCount }), [overrides, setOCount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useOCountStore(): OCountContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOCount must be used within OCountProvider');
  return ctx;
}

/** The effective o-count for a scene: the live override if any, else the fallback. */
export function useOCount(sceneID: string, fallback: number | null | undefined): number {
  const { overrides } = useOCountStore();
  return overrides[sceneID] ?? fallback ?? 0;
}

/** Writer for the o-count store (used by the player). */
export function useSetOCount(): (sceneID: string, count: number) => void {
  return useOCountStore().setOCount;
}
