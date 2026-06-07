import { useCallback, useEffect, useRef, useState } from 'react';

import { useServerConfig } from '@/config/ServerConfigContext';
import { makeClient, type StashClient } from '@/lib/graphql';

const PER_PAGE = 40;

export type ListStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Plain page-by-page list loader (no saved filters), used by the Performers and
 * Groups grids and by the per-entity scene lists on detail screens. Ports the
 * loadInitial / prefetchIfNeeded pattern from the tvOS view models.
 */
export function usePaginatedList<T>(
  fetchPage: (
    client: StashClient,
    page: number,
    perPage: number
  ) => Promise<{ count: number; items: T[] }>,
  deps: unknown[] = []
) {
  const server = useServerConfig();

  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<ListStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadToken = useRef(0);
  const currentPage = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const hasMore = items.length < totalCount;

  const loadPage = useCallback(
    async (page: number, token: number, isInitial: boolean) => {
      if (!isInitial) setIsLoadingMore(true);
      try {
        const client = makeClient(server);
        const result = await fetchRef.current(client, page, PER_PAGE);
        if (token !== loadToken.current) return;
        currentPage.current = page;
        setItems((prev) => (isInitial ? result.items : [...prev, ...result.items]));
        setTotalCount(result.count);
        setStatus('loaded');
      } catch (err) {
        if (token !== loadToken.current) return;
        const message = err instanceof Error ? err.message : String(err);
        if (isInitial) {
          setStatus('error');
          setErrorMessage(message);
        } else {
          console.warn('[list] page load failed:', message);
        }
      } finally {
        if (token === loadToken.current && !isInitial) setIsLoadingMore(false);
      }
    },
    [server]
  );

  const reload = useCallback(async () => {
    loadToken.current += 1;
    const token = loadToken.current;
    currentPage.current = 0;
    setItems([]);
    setTotalCount(0);
    setStatus('loading');
    await loadPage(1, token, true);
  }, [loadPage]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

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
    items,
    totalCount,
    status,
    errorMessage,
    isLoadingMore,
    refreshing,
    hasMore,
    apiKey: server.apiKey,
    reload,
    onRefresh,
    onEndReached,
  };
}
