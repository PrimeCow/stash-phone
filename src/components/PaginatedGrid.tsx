import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import type { usePaginatedList } from '@/hooks/usePaginatedList';

type ListResult<T> = ReturnType<typeof usePaginatedList<T>>;

interface PaginatedGridProps<T> {
  result: ListResult<T>;
  numColumns: number;
  getId: (item: T) => string;
  renderCard: (item: T, apiKey: string | null) => React.ReactElement;
  emptyText: string;
  /** Optional content rendered above the grid (e.g. a detail header). */
  header?: React.ReactElement | null;
  /** Whether to show the "N of M" count row. */
  showCount?: boolean;
}

export function PaginatedGrid<T>({
  result,
  numColumns,
  getId,
  renderCard,
  emptyText,
  header,
  showCount = true,
}: PaginatedGridProps<T>) {
  if (result.status === 'loading' || result.status === 'idle') {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (result.status === 'error') {
    return (
      <View style={styles.center}>
        {header}
        <Ionicons name="warning-outline" size={40} color="#f85149" />
        <Text style={styles.error}>{result.errorMessage}</Text>
        <Pressable style={styles.retryBtn} onPress={result.reload}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (result.items.length === 0) {
    return (
      <View style={styles.center}>
        {header}
        <Text style={styles.dim}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={result.items}
      keyExtractor={getId}
      numColumns={numColumns}
      contentContainerStyle={styles.gridContent}
      renderItem={({ item }) => <View style={styles.cell}>{renderCard(item, result.apiKey)}</View>}
      onEndReached={result.onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={result.refreshing} onRefresh={result.onRefresh} tintColor="#fff" />
      }
      ListHeaderComponent={
        <View>
          {header}
          {showCount && (
            <Text style={styles.countText}>
              {result.items.length} of {result.totalCount}
            </Text>
          )}
        </View>
      }
      ListFooterComponent={
        result.isLoadingMore ? (
          <View style={styles.footer}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
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
