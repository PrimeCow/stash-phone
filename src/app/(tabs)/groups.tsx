import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupCard } from '@/components/GroupCard';
import { PaginatedGrid } from '@/components/PaginatedGrid';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { fetchGroups } from '@/lib/queries';
import type { Group } from '@/types/stash';

export default function GroupsScreen() {
  const router = useRouter();

  const fetchPage = useCallback(
    async (client: Parameters<typeof fetchGroups>[0], page: number, perPage: number) => {
      const result = await fetchGroups(client, page, perPage);
      return { count: result.count, items: result.groups };
    },
    []
  );

  const list = usePaginatedList<Group>(fetchPage, []);

  const openGroup = useCallback(
    (group: Group) => {
      router.push({ pathname: '/group/[id]', params: { id: group.id, data: JSON.stringify(group) } });
    },
    [router]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
      </View>
      <PaginatedGrid<Group>
        result={list}
        numColumns={3}
        getId={(g) => g.id}
        emptyText="No groups on this server."
        renderCard={(group, apiKey) => (
          <GroupCard group={group} apiKey={apiKey} onPress={openGroup} />
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
