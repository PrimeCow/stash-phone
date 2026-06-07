// Domain types mirroring the Stash GraphQL schema, ported from the tvOS app.

export interface Tag {
  id: string;
  name: string;
}

export interface Studio {
  id: string;
  name: string;
  image_path?: string | null;
}

export interface ScenePaths {
  screenshot?: string | null;
  preview?: string | null;
  stream?: string | null;
}

export interface SceneFile {
  basename?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface Performer {
  id: string;
  name: string;
  image_path?: string | null;
  alias_list?: string[] | null;
  gender?: string | null;
  country?: string | null;
  birthdate?: string | null;
  scene_count?: number | null;
}

export interface Scene {
  id: string;
  title?: string | null;
  details?: string | null;
  date?: string | null;
  rating100?: number | null;
  paths: ScenePaths;
  files: SceneFile[];
  studio?: Studio | null;
  performers: Performer[];
  tags: Tag[];
}

export interface SavedFindFilter {
  q?: string | null;
  sort?: string | null;
  direction?: string | null;
  per_page?: number | null;
}

export interface SavedFilter {
  id: string;
  mode: string;
  name: string;
  find_filter?: SavedFindFilter | null;
  // object_filter comes back as the web UI's internal shape; see normalizeFilter.ts
  object_filter?: unknown;
}

// Helpers -------------------------------------------------------------------

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

export function sceneDisplayTitle(scene: Scene): string {
  const title = scene.title?.trim();
  if (title) return title;
  const basename = scene.files[0]?.basename?.trim();
  if (basename) return stripExtension(basename);
  return 'Untitled';
}

export function performerAliasesText(performer: Performer): string | null {
  const list = performer.alias_list;
  if (!list || list.length === 0) return null;
  return list.join(', ');
}
