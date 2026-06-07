// GraphQL operations + typed wrappers, ported from the tvOS Queries/.

import type { Group, Performer, Scene, SavedFilter, SceneMarker } from '@/types/stash';
import { StashClient } from './graphql';

const SCENE_FIELDS = `
  id
  title
  details
  date
  rating100
  paths { screenshot preview stream }
  files { basename duration width height }
  studio { id name image_path }
  performers { id name image_path }
  tags { id name }
`;

// version --------------------------------------------------------------------

const VERSION_QUERY = `
query Version {
  version { version build_time hash }
}`;

export interface VersionInfo {
  version: string;
  build_time?: string | null;
  hash?: string | null;
}

export async function fetchVersion(client: StashClient): Promise<VersionInfo> {
  const data = await client.execute<{ version: VersionInfo }>('Version', VERSION_QUERY);
  return data.version;
}

// saved filters --------------------------------------------------------------

const FIND_SAVED_FILTERS_QUERY = `
query FindSavedFilters($mode: FilterMode) {
  findSavedFilters(mode: $mode) {
    id
    mode
    name
    find_filter { q sort direction per_page }
    object_filter
  }
}`;

export async function fetchSavedFilters(
  client: StashClient,
  mode: string
): Promise<SavedFilter[]> {
  const data = await client.execute<{ findSavedFilters: SavedFilter[] }>(
    'FindSavedFilters',
    FIND_SAVED_FILTERS_QUERY,
    { mode }
  );
  return [...data.findSavedFilters].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

// scenes ---------------------------------------------------------------------

const FIND_SCENES_QUERY = `
query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
  findScenes(filter: $filter, scene_filter: $scene_filter) {
    count
    scenes {${SCENE_FIELDS}}
  }
}`;

export interface FindScenesArgs {
  page?: number;
  perPage?: number;
  sort?: string;
  direction?: string;
  sceneFilter?: unknown;
}

export interface FindScenesResult {
  count: number;
  scenes: Scene[];
}

export async function fetchScenes(
  client: StashClient,
  args: FindScenesArgs
): Promise<FindScenesResult> {
  const variables: Record<string, unknown> = {
    filter: {
      page: args.page ?? 1,
      per_page: args.perPage ?? 40,
      sort: args.sort ?? 'date',
      direction: args.direction ?? 'DESC',
    },
  };
  if (args.sceneFilter != null) {
    variables.scene_filter = args.sceneFilter;
  }
  const data = await client.execute<{ findScenes: FindScenesResult }>(
    'FindScenes',
    FIND_SCENES_QUERY,
    variables
  );
  return data.findScenes;
}

// scene markers --------------------------------------------------------------

const FIND_SCENE_MARKERS_QUERY = `
query FindSceneMarkers($filter: FindFilterType, $scene_marker_filter: SceneMarkerFilterType) {
  findSceneMarkers(filter: $filter, scene_marker_filter: $scene_marker_filter) {
    count
    scene_markers {
      id
      title
      seconds
      end_seconds
      stream
      preview
      screenshot
      primary_tag { id name }
      tags { id name }
      scene {${SCENE_FIELDS}}
    }
  }
}`;

export interface FindMarkersArgs {
  page?: number;
  perPage?: number;
  sort?: string;
  direction?: string;
  markerFilter?: unknown;
}

export interface FindMarkersResult {
  count: number;
  scene_markers: SceneMarker[];
}

export async function fetchSceneMarkers(
  client: StashClient,
  args: FindMarkersArgs
): Promise<FindMarkersResult> {
  const variables: Record<string, unknown> = {
    filter: {
      page: args.page ?? 1,
      per_page: args.perPage ?? 40,
      sort: args.sort ?? 'created_at',
      direction: args.direction ?? 'DESC',
    },
  };
  if (args.markerFilter != null) {
    variables.scene_marker_filter = args.markerFilter;
  }
  const data = await client.execute<{ findSceneMarkers: FindMarkersResult }>(
    'FindSceneMarkers',
    FIND_SCENE_MARKERS_QUERY,
    variables
  );
  return data.findSceneMarkers;
}

// performers -----------------------------------------------------------------

const FIND_PERFORMERS_QUERY = `
query FindPerformers($filter: FindFilterType) {
  findPerformers(filter: $filter) {
    count
    performers {
      id
      name
      alias_list
      gender
      country
      birthdate
      image_path
      scene_count
    }
  }
}`;

export interface FindPerformersResult {
  count: number;
  performers: Performer[];
}

export async function fetchPerformers(
  client: StashClient,
  page: number,
  perPage: number,
  sort = 'name',
  direction = 'ASC'
): Promise<FindPerformersResult> {
  const data = await client.execute<{ findPerformers: FindPerformersResult }>(
    'FindPerformers',
    FIND_PERFORMERS_QUERY,
    { filter: { page, per_page: perPage, sort, direction } }
  );
  return data.findPerformers;
}

/** Scenes featuring a given performer (sorted newest first), for detail screens. */
export async function fetchScenesForPerformer(
  client: StashClient,
  performerID: string,
  page: number,
  perPage: number
): Promise<FindScenesResult> {
  return fetchScenes(client, {
    page,
    perPage,
    sort: 'date',
    direction: 'DESC',
    sceneFilter: {
      performers: { value: [performerID], modifier: 'INCLUDES' },
    },
  });
}

// groups ---------------------------------------------------------------------

const GROUP_FIELDS = `
  id
  name
  aliases
  duration
  date
  rating100
  director
  synopsis
  scene_count
  front_image_path
  back_image_path
  studio { id name image_path }
`;

const FIND_GROUPS_QUERY = `
query FindGroups($filter: FindFilterType) {
  findGroups(filter: $filter) {
    count
    groups {${GROUP_FIELDS}}
  }
}`;

export interface FindGroupsResult {
  count: number;
  groups: Group[];
}

export async function fetchGroups(
  client: StashClient,
  page: number,
  perPage: number,
  sort = 'name',
  direction = 'ASC'
): Promise<FindGroupsResult> {
  const data = await client.execute<{ findGroups: FindGroupsResult }>(
    'FindGroups',
    FIND_GROUPS_QUERY,
    { filter: { page, per_page: perPage, sort, direction } }
  );
  return data.findGroups;
}

const FIND_GROUP_QUERY = `
query FindGroup($id: ID!) {
  findGroup(id: $id) {
    ${GROUP_FIELDS}
    scenes {${SCENE_FIELDS}}
  }
}`;

export async function fetchGroup(client: StashClient, id: string): Promise<Group | null> {
  const data = await client.execute<{ findGroup: Group | null }>('FindGroup', FIND_GROUP_QUERY, {
    id,
  });
  return data.findGroup;
}
