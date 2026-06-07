import { useRouter } from 'expo-router';

import { FilteredBrowse } from '@/components/FilteredBrowse';
import { SceneCard } from '@/components/SceneCard';
import { singleScenePlaylist, usePlayback } from '@/config/PlaybackContext';
import { fetchScenes } from '@/lib/queries';
import type { Scene } from '@/types/stash';

export default function ScenesScreen() {
  const router = useRouter();
  const { setPlaylist } = usePlayback();

  return (
    <FilteredBrowse<Scene>
      mode="scenes"
      title="Scenes"
      defaultSort="date"
      numColumns={2}
      emptyText="No scenes match this filter."
      getId={(s) => s.id}
      fetchPage={async (client, args) => {
        const result = await fetchScenes(client, {
          page: args.page,
          perPage: args.perPage,
          sort: args.sort,
          direction: args.direction,
          sceneFilter: args.objectFilter,
        });
        return { count: result.count, items: result.scenes };
      }}
      renderCard={(scene, apiKey) => (
        <SceneCard
          scene={scene}
          apiKey={apiKey}
          onPress={(s) => {
            setPlaylist(singleScenePlaylist(s));
            router.push('/player');
          }}
        />
      )}
    />
  );
}
