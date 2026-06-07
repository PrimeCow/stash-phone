import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChipBar, type Chip } from '@/components/FilterChipBar';
import { ManageFiltersSheet } from '@/components/ManageFiltersSheet';
import { SceneCard } from '@/components/SceneCard';
import { RECENT_SCENES_ID, useFilterPrefs } from '@/config/FilterPrefsContext';
import { usePlayback, singleScenePlaylist } from '@/config/PlaybackContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { makeClient } from '@/lib/graphql';
import { normalizeForCriterionInput } from '@/lib/normalizeFilter';
import { fetchSavedFilters, fetchScenes } from '@/lib/queries';
import type { SavedFilter, Scene } from '@/types/stash';

const PER_PAGE = 40;
const PREFETCH_MARGIN = 8;

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

export default function ScenesScreen() {
  const config = useServerConfig();
  const prefs = useFilterPrefs();
  const router = useRouter();
  const { setPlaylist } = usePlayback();

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showManage, setShowManage] = useState(false);

  // Mutable refs that should not retrigger renders mid-load.
  const loadToken = useRef(0);
  const currentPage = useRef(0);
  const seed = useRef(randomSeed());

  const chips: Chip[] = useMemo(() => {
    const result: Chip[] = [];
    if (prefs.showRecentScenes) {
      result.push({ id: RECENT_SCENES_ID, title: 'Recent Scenes' });
    }
    for (const f of savedFilters) {
      if (prefs.enabledFilterIDs.includes(f.id)) {
        result.push({ id: f.id, title: f.name });
      }
    }
    return result;
  }, [prefs.showRecentScenes, prefs.enabledFilterIDs, savedFilters]);

  const activeFilter = useMemo<SavedFilter | null>(() => {
    const id = prefs.activeFilterID;
    if (!id || id === RECENT_SCENES_ID) return null;
    return savedFilters.find((f) => f.id === id) ?? null;
  }, [prefs.activeFilterID, savedFilters]);

  const hasMore = scenes.length < totalCount;

  const resolvedSort = useCallback(() => {
    const base = activeFilter?.find_filter?.sort ?? 'date';
    return base.startsWith('random') ? `random_${seed.current}` : base;
  }, [activeFilter]);

  const loadPage = useCallback(
    async (page: number, token: number, isInitial: boolean) => {
      if (!isInitial) setIsLoadingMore(true);
      try {
        const client = makeClient(config);
        const result = await fetchScenes(client, {
          page,
          perPage: PER_PAGE,
          sort: resolvedSort(),
          direction: activeFilter?.find_filter?.direction ?? 'DESC',
          sceneFilter: activeFilter?.object_filter
            ? normalizeForCriterionInput(activeFilter.object_filter)
            : undefined,
        });
        if (token !== loadToken.current) return;
        currentPage.current = page;
        setScenes((prev) => (isInitial ? result.scenes : [...prev, ...result.scenes]));
        setTotalCount(result.count);
        setStatus('loaded');
      } catch (err) {
        if (token !== loadToken.current) return;
        const message = err instanceof Error ? err.message : String(err);
        if (isInitial) {
          setStatus('error');
          setErrorMessage(message);
        } else {
          console.warn('[Scenes] page load failed:', message);
        }
      } finally {
        if (token !== loadToken.current) return;
        if (!isInitial) setIsLoadingMore(false);
      }
    },
    [config, resolvedSort, activeFilter]
  );

  const reload = useCallback(async () => {
    loadToken.current += 1;
    const token = loadToken.current;
    seed.current = randomSeed();
    currentPage.current = 0;
    setScenes([]);
    setTotalCount(0);
    setStatus('loading');
    await loadPage(1, token, true);
  }, [loadPage]);

  // Load saved-filter catalog once configured.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = makeClient(config);
        const filters = await fetchSavedFilters(client, 'SCENES');
        if (!cancelled) setSavedFilters(filters);
      } catch (err) {
        console.warn('[Scenes] saved filters failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config]);

  // Keep the active selection valid as chips change.
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
      setScenes([]);
      setTotalCount(0);
      setStatus('loaded');
      return;
    }
    if (!prefs.activeFilterID) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.activeFilterID, savedFilters, prefs.isLoaded]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const onEndReached = useCallback(() => {
    if (!hasMore || isLoadingMore || status !== 'loaded') return;
    loadPage(currentPage.current + 1, loadToken.current, false);
  }, [hasMore, isLoadingMore, status, loadPage]);

  const openScene = useCallback(
    (scene: Scene) => {
      setPlaylist(singleScenePlaylist(scene));
      router.push('/player');
    },
    [router, setPlaylist]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scenes</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setShowManage(true)}>
            <Ionicons name="options-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {chips.length > 0 && (
        <View style={styles.chipBar}>
          <FilterChipBar
            chips={chips}
            activeID={prefs.activeFilterID}
            onSelect={prefs.setActiveFilterID}
          />
        </View>
      )}

      <Body
        status={status}
        chipsEmpty={chips.length === 0}
        scenes={scenes}
        totalCount={totalCount}
        errorMessage={errorMessage}
        refreshing={refreshing}
        isLoadingMore={isLoadingMore}
        apiKey={config.apiKey}
        onRefresh={onRefresh}
        onRetry={reload}
        onEndReached={onEndReached}
        onOpenScene={openScene}
        onManage={() => setShowManage(true)}
      />

      <ManageFiltersSheet
        visible={showManage}
        onClose={() => setShowManage(false)}
        savedFilters={savedFilters}
      />
    </SafeAreaView>
  );
}

interface BodyProps {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  chipsEmpty: boolean;
  scenes: Scene[];
  totalCount: number;
  errorMessage: string;
  refreshing: boolean;
  isLoadingMore: boolean;
  apiKey: string | null;
  onRefresh: () => void;
  onRetry: () => void;
  onEndReached: () => void;
  onOpenScene: (scene: Scene) => void;
  onManage: () => void;
}

function Body(props: BodyProps) {
  if (props.status === 'loading' || props.status === 'idle') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
        <Text style={styles.dim}>Loading scenes…</Text>
      </View>
    );
  }
  if (props.status === 'error') {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={40} color="#f85149" />
        <Text style={styles.error}>{props.errorMessage}</Text>
        <Pressable style={styles.retryBtn} onPress={props.onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (props.chipsEmpty) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>No filters enabled.</Text>
        <Pressable style={styles.retryBtn} onPress={props.onManage}>
          <Text style={styles.retryText}>Manage Filters</Text>
        </Pressable>
      </View>
    );
  }
  if (props.scenes.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.dim}>No scenes match this filter.</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={props.scenes}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.gridContent}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <SceneCard scene={item} apiKey={props.apiKey} onPress={props.onOpenScene} />
        </View>
      )}
      onEndReached={props.onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          tintColor="#fff"
        />
      }
      ListHeaderComponent={
        <Text style={styles.countText}>
          {props.scenes.length} of {props.totalCount}
        </Text>
      }
      ListFooterComponent={
        props.isLoadingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1b1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBar: { paddingBottom: 8 },
  gridContent: { paddingHorizontal: 12, paddingBottom: 24 },
  cell: { flex: 1, padding: 4 },
  countText: { color: '#8a8f94', fontSize: 13, paddingHorizontal: 4, paddingVertical: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  dim: { color: '#8a8f94', fontSize: 15, textAlign: 'center' },
  error: { color: '#f85149', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#e0245e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  footer: { paddingVertical: 24 },
});
