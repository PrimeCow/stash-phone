import React, { createContext, useContext, useMemo, useState } from 'react';

import type { Scene } from '@/types/stash';
import { sceneDisplayTitle } from '@/types/stash';

export interface ScenePlaylist {
  scenes: Scene[];
  startIndex: number;
  /**
   * Optional per-scene start offset in seconds, aligned to `scenes`. Used when
   * playing a marker list so each scene resumes at its marker's timestamp.
   */
  offsets?: number[];
  title?: string;
}

export function singleScenePlaylist(scene: Scene, startTime?: number): ScenePlaylist {
  return {
    scenes: [scene],
    startIndex: 0,
    offsets: startTime != null ? [startTime] : undefined,
    title: sceneDisplayTitle(scene),
  };
}

interface PlaybackContextValue {
  playlist: ScenePlaylist | null;
  setPlaylist: (playlist: ScenePlaylist | null) => void;
}

const Ctx = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [playlist, setPlaylist] = useState<ScenePlaylist | null>(null);
  const value = useMemo(() => ({ playlist, setPlaylist }), [playlist]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider');
  return ctx;
}
