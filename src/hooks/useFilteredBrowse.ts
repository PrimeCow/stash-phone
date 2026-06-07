import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Chip } from '@/components/FilterChipBar';
import { useAuthGate } from '@/config/AuthGateContext';
import {
  MODE_INFO,
  useModeFilterPrefs,
  type BrowseMode,
} from '@/config/FilterPrefsContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { AuthRequiredError, makeClient, type StashClient } from '@/lib/graphql';
import { normalizeForCriterionInput } from '@/lib/normalizeFilter';
import { fetchSavedFilters } from '@/lib/queries';
import type { SavedFilter } from '@/types/stash';

const PER_PAGE = 40;

export type BrowseStatus = 'idle' | 'loading' | 'loaded' | 'error' | 'authRequired';

export interface PageArgs {
  page: number;
  perPage: number;
  sort: string;
  direction: string;
  objectFilter?: unknown;
}

interface Config<T> {
  mode: BrowseMode;
  defaultSort: string;
  fetchPage: (
    client: StashClient,
    args: PageArgs
  ) => Promise<{ count: number; items: T[] }>;
  getId: (item: T) => string;
}

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

/**
 * Saved-filter-driven paginated browse, shared by the Scenes and Markers tabs.
 * Ports BrowseViewModel / MarkersBrowseViewModel from the tvOS app: saved-filter
 * chips, infinite scroll, refresh, and random-sort re-seeding.
 */
export function useFilteredBrowse<T>(config: Config<T>) {
  const { mode, defaultSort, fetchPage, getId } = config;
  const server = useServerConfig();
  const prefs = useModeFilterPrefs(mode);
  const { promptLogin, authEpoch } = useAuthGate();

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<BrowseStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authBlocked, setAuthBlocked] = useState(false);

  const loadToken = useRef(0);
  const currentPage = useRef(0);
  const seed = useRef(randomSeed());

  const chips: Chip[] = useMemo(() => {
    const result: Chip[] = [];
    if (prefs.showRecent) {
      result.push({ id: prefs.recentChipID, title: mode === 'markers' ? 'Recent Markers' : 'Recent Scenes' });
    }
    for (const f of savedFilters) {
      if (prefs.enabledFilterIDs.includes(f.id)) {
        result.push({ id: f.id, title: f.name });
      }
    }
    return result;
  }, [prefs.showRecent, prefs.enabledFilterIDs, prefs.recentChipID, savedFilters, mode]);

  const activeFilter = useMemo<SavedFilter | null>(() => {
    const id = prefs.activeFilterID;
    if (!id || id === prefs.recentChipID) return null;
    return savedFilters.find((f) => f.id === id) ?? null;
  }, [prefs.activeFilterID, prefs.recentChipID, savedFilters]);

  const hasMore = items.length < totalCount;

  const resolvedSort = useCallback(() => {
    const base = activeFilter?.find_filter?.sort ?? defaultSort;
    return base.startsWith('random') ? `random_${seed.current}` : base;
  }, [activeFilter, defaultSort]);

  const loadPage = useCallback(
    async (page: number, token: number, isInitial: boolean) => {
      if (!isInitial) setIsLoadingMore(true);
      try {
        const client = makeClient(server);
        const result = await fetchPage(client, {
          page,
          perPage: PER_PAGE,
          sort: resolvedSort(),
          direction: activeFilter?.find_filter?.direction ?? 'DESC',
          objectFilter: activeFilter?.object_filter
            ? normalizeForCriterionInput(activeFilter.object_filter)
            : undefined,
        });
        if (token !== loadToken.current) return;
        currentPage.current = page;
        setItems((prev) => (isInitial ? result.items : [...prev, ...result.items]));
        setTotalCount(result.count);
        setStatus('loaded');
      } catch (err) {
        if (token !== loadToken.current) return;
        if (err instanceof AuthRequiredError) {
          setAuthBlocked(true);
          promptLogin();
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        if (isInitial) {
          setStatus('error');
          setErrorMessage(message);
        } else {
          console.warn(`[${mode}] page load failed:`, message);
        }
      } finally {
        if (token === loadToken.current && !isInitial) setIsLoadingMore(false);
      }
    },
    [server, resolvedSort, activeFilter, fetchPage, mode, promptLogin]
  );

  const reload = useCallback(async () => {
    loadToken.current += 1;
    const token = loadToken.current;
    seed.current = randomSeed();
    currentPage.current = 0;
    setItems([]);
    setTotalCount(0);
    setStatus('loading');
    await loadPage(1, token, true);
  }, [loadPage]);

  // Load the saved-filter catalog once configured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = makeClient(server);
        const filters = await fetchSavedFilters(client, MODE_INFO[mode].stashFilterMode);
        if (!cancelled) setSavedFilters(filters);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthRequiredError) {
          setAuthBlocked(true);
          promptLogin();
        } else {
          console.warn(`[${mode}] saved filters failed:`, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [server, mode, authEpoch, promptLogin]);

  // Clear the auth block after a successful login so data reloads.
  useEffect(() => {
    setAuthBlocked(false);
  }, [authEpoch]);

  // Keep the active chip selection valid as chips change.
  useEffect(() => {
    if (!prefs.isLoaded) return;
    const ids = chips.map((c) => c.id);
    if (prefs.activeFilterID && ids.includes(prefs.activeFilterID)) return;
    prefs.setActiveFilterID(ids[0] ?? null);
  }, [chips, prefs.isLoaded, prefs.activeFilterID]);

  // Reload whenever the active filter resolves/changes.
  useEffect(() => {
    if (!prefs.isLoaded) return;
    if (chips.length === 0) {
      setItems([]);
      setTotalCount(0);
      setStatus('loaded');
      return;
    }
    if (!prefs.activeFilterID) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.activeFilterID, savedFilters, prefs.isLoaded, authEpoch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const onEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore || status !== 'loaded') return;
    loadPage(currentPage.current + 1, loadToken.current, false);
  }, [hasMore, isLoadingMore, status, loadPage]);

  return {
    savedFilters,
    chips,
    apiKey: server.apiKey,
    activeFilterID: prefs.activeFilterID,
    setActiveFilterID: prefs.setActiveFilterID,
    items,
    totalCount,
    status: authBlocked ? ('authRequired' as BrowseStatus) : status,
    errorMessage,
    isLoadingMore,
    refreshing,
    hasMore,
    getId,
    reload,
    onRefresh,
    onEndReached,
  };
}
