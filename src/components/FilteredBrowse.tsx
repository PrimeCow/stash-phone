import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChipBar } from '@/components/FilterChipBar';
import { ManageFiltersSheet } from '@/components/ManageFiltersSheet';
import { useAuthGate } from '@/config/AuthGateContext';
import type { BrowseMode } from '@/config/FilterPrefsContext';
import { useFilteredBrowse, type PageArgs } from '@/hooks/useFilteredBrowse';
import type { StashClient } from '@/lib/graphql';

interface FilteredBrowseProps<T> {
  mode: BrowseMode;
  title: string;
  defaultSort: string;
  numColumns: number;
  fetchPage: (client: StashClient, args: PageArgs) => Promise<{ count: number; items: T[] }>;
  getId: (item: T) => string;
  renderCard: (item: T, apiKey: string | null) => React.ReactElement;
  emptyText: string;
}

export function FilteredBrowse<T>(props: FilteredBrowseProps<T>) {
  const b = useFilteredBrowse<T>({
    mode: props.mode,
    defaultSort: props.defaultSort,
    fetchPage: props.fetchPage,
    getId: props.getId,
  });
  const [showManage, setShowManage] = useState(false);
  const { promptLogin } = useAuthGate();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{props.title}</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setShowManage(true)}>
            <Ionicons name="options-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={b.onRefresh}>
            <Ionicons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {b.chips.length > 0 && (
        <View style={styles.chipBar}>
          <FilterChipBar chips={b.chips} activeID={b.activeFilterID} onSelect={b.setActiveFilterID} />
        </View>
      )}

      {b.status === 'loading' || b.status === 'idle' ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : b.status === 'authRequired' ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={40} color="#8a8f94" />
          <Text style={styles.dim}>Sign in to your server to continue.</Text>
          <Pressable style={styles.retryBtn} onPress={promptLogin}>
            <Text style={styles.retryText}>Log In</Text>
          </Pressable>
        </View>
      ) : b.status === 'error' ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color="#f85149" />
          <Text style={styles.error}>{b.errorMessage}</Text>
          <Pressable style={styles.retryBtn} onPress={b.reload}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : b.chips.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.dim}>No filters enabled.</Text>
          <Pressable style={styles.retryBtn} onPress={() => setShowManage(true)}>
            <Text style={styles.retryText}>Manage Filters</Text>
          </Pressable>
        </View>
      ) : b.items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.dim}>{props.emptyText}</Text>
        </View>
      ) : (
        <FlashList
          data={b.items}
          keyExtractor={props.getId}
          numColumns={props.numColumns}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => <View style={styles.cell}>{props.renderCard(item, b.apiKey)}</View>}
          onEndReached={b.onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={b.refreshing} onRefresh={b.onRefresh} tintColor="#fff" />
          }
          ListHeaderComponent={
            <Text style={styles.countText}>
              {b.items.length} of {b.totalCount}
            </Text>
          }
          ListFooterComponent={
            b.isLoadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null
          }
        />
      )}

      <ManageFiltersSheet
        visible={showManage}
        onClose={() => setShowManage(false)}
        mode={props.mode}
        savedFilters={b.savedFilters}
      />
    </SafeAreaView>
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
  retryBtn: { backgroundColor: '#e0245e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  footer: { paddingVertical: 24 },
});
