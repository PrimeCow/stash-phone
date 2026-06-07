import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaginatedGrid } from '@/components/PaginatedGrid';
import { PerformerCard } from '@/components/PerformerCard';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { fetchPerformers } from '@/lib/queries';
import type { Performer } from '@/types/stash';

export default function PerformersScreen() {
  const router = useRouter();

  const fetchPage = useCallback(async (client: Parameters<typeof fetchPerformers>[0], page: number, perPage: number) => {
    const result = await fetchPerformers(client, page, perPage);
    return { count: result.count, items: result.performers };
  }, []);

  const list = usePaginatedList<Performer>(fetchPage, []);

  const openPerformer = useCallback(
    (performer: Performer) => {
      router.push({
        pathname: '/performer/[id]',
        params: { id: performer.id, data: JSON.stringify(performer) },
      });
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Performers</Text>
      </View>
      <PaginatedGrid<Performer>
        result={list}
        numColumns={3}
        getId={(p) => p.id}
        emptyText="No performers on this server."
        renderCard={(performer, apiKey) => (
          <PerformerCard performer={performer} apiKey={apiKey} onPress={openPerformer} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },
});
