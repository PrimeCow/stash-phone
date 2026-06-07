import { useRouter } from 'expo-router';

import { FilteredBrowse } from '@/components/FilteredBrowse';
import { MarkerCard } from '@/components/MarkerCard';
import { usePlayback } from '@/config/PlaybackContext';
import { fetchSceneMarkers } from '@/lib/queries';
import type { SceneMarker } from '@/types/stash';

export default function MarkersScreen() {
  const router = useRouter();
  const { setPlaylist } = usePlayback();

  return (
    <FilteredBrowse<SceneMarker>
      mode="markers"
      title="Markers"
      defaultSort="created_at"
      numColumns={2}
      emptyText="No markers match this filter."
      getId={(m) => m.id}
      fetchPage={async (client, args) => {
        const result = await fetchSceneMarkers(client, {
          page: args.page,
          perPage: args.perPage,
          sort: args.sort,
          direction: args.direction,
          markerFilter: args.objectFilter,
        });
        return { count: result.count, items: result.scene_markers };
      }}
      renderCard={(marker, apiKey, ctx) => (
        <MarkerCard
          marker={marker}
          apiKey={apiKey}
          onPress={() => {
            setPlaylist({
              scenes: ctx.items.map((m) => m.scene),
              offsets: ctx.items.map((m) => m.seconds),
              startIndex: ctx.index,
              title: 'Markers',
            });
            router.push('/player');
          }}
        />
      )}
    />
  );
}
