// Port of JSONValue.normalizedForCriterionInput from the tvOS app.
//
// Stash's `findSavedFilters` returns `object_filter` in the web UI's internal
// shape rather than the `SceneFilterType` input shape. Two common divergences
// for multi-id criteria:
//
//  - Plain multi-criterion (performers, etc.):
//      value: [{id, label}, …]            -> value: [id, …]
//  - Hierarchical multi-criterion (tags, studios, etc.):
//      value: { depth, items: [{id,label}…] }
//                                         -> value: [id, …]  (+ depth lifted)
//
// Other shapes (Int/String/Float/Date criteria) pass through unchanged.

type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };

export function normalizeForCriterionInput(value: unknown): unknown {
  return normalize(value as JSONValue);
}

function normalize(value: JSONValue): JSONValue {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value !== null && typeof value === 'object') {
    return normalizeObject(value as Record<string, JSONValue>);
  }
  return value;
}

function normalizeObject(dict: Record<string, JSONValue>): JSONValue {
  const out: Record<string, JSONValue> = {};
  let liftedDepth: JSONValue | undefined;

  for (const [key, raw] of Object.entries(dict)) {
    const recursed = normalize(raw);
    if (key === 'value' || key === 'excludes') {
      const { normalized, depth } = unwrapCriterionValue(recursed);
      out[key] = normalized;
      if (key === 'value' && depth !== undefined) liftedDepth = depth;
    } else {
      out[key] = recursed;
    }
  }

  if (liftedDepth !== undefined && out['depth'] === undefined) {
    out['depth'] = liftedDepth;
  }
  return out;
}

function unwrapCriterionValue(value: JSONValue): {
  normalized: JSONValue;
  depth?: JSONValue;
} {
  // Hierarchical: { items: [...], depth }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const items = (value as Record<string, JSONValue>)['items'];
    if (Array.isArray(items)) {
      const ids = extractIDs(items);
      if (ids) {
        return { normalized: ids, depth: (value as Record<string, JSONValue>)['depth'] };
      }
    }
    return { normalized: value };
  }
  // Plain: [{id, label}, …]
  if (Array.isArray(value)) {
    const ids = extractIDs(value);
    if (ids) return { normalized: ids };
  }
  return { normalized: value };
}

function extractIDs(items: JSONValue[]): JSONValue[] | null {
  if (items.length === 0) return null;
  const ids: JSONValue[] = [];
  for (const item of items) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }
    const id = (item as Record<string, JSONValue>)['id'];
    if (id === undefined) return null;
    ids.push(id);
  }
  return ids;
}
