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
  o_counter?: number | null;
  paths: ScenePaths;
  files: SceneFile[];
  studio?: Studio | null;
  performers: Performer[];
  tags: Tag[];
}

export interface Group {
  id: string;
  name: string;
  aliases?: string | null;
  duration?: number | null;
  date?: string | null;
  rating100?: number | null;
  director?: string | null;
  synopsis?: string | null;
  scene_count: number;
  front_image_path?: string | null;
  back_image_path?: string | null;
  studio?: Studio | null;
  scenes?: Scene[] | null;
}

export interface SceneMarker {
  id: string;
  title: string;
  seconds: number;
  end_seconds?: number | null;
  stream?: string | null;
  preview?: string | null;
  screenshot?: string | null;
  primary_tag: Tag;
  tags: Tag[];
  scene: Scene;
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

export function markerDisplayTitle(marker: SceneMarker): string {
  const trimmed = marker.title.trim();
  return trimmed || marker.primary_tag.name;
}

export function markerSubtitleTags(marker: SceneMarker): string[] {
  const trimmed = marker.title.trim();
  const others = marker.tags
    .filter((t) => t.id !== marker.primary_tag.id)
    .map((t) => t.name);
  return trimmed ? [marker.primary_tag.name, ...others] : others;
}

export function markerTimecode(marker: SceneMarker): string {
  const total = Math.floor(marker.seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
