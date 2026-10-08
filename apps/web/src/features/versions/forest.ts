import type { components } from '@llm-music/api-client';

type Version = components['schemas']['VersionRead'];

// Display only relationships supported by the complete saved API response.
export function versionForest(versions: Version[], projectId: string) {
  const byId = new Map<string, Version>();
  const children = new Map<string, Version[]>();
  const roots: Version[] = [];
  for (const version of versions) {
    if (version.project_id !== projectId || byId.has(version.id)) return null;
    byId.set(version.id, version);
  }
  for (const version of [...versions].reverse()) {
    if (version.parent_version_id === null) roots.push(version);
    else {
      if (!byId.has(version.parent_version_id)) return null;
      const siblings = children.get(version.parent_version_id) ?? [];
      siblings.push(version);
      children.set(version.parent_version_id, siblings);
    }
  }
  const rows: { version: Version; depth: number }[] = [];
  const visited = new Set<string>();
  const pending = [...roots].reverse().map(version => ({ version, depth: 0 }));
  while (pending.length) {
    const row = pending.pop();
    if (!row || visited.has(row.version.id)) return null;
    visited.add(row.version.id);
    rows.push(row);
    for (const child of [...(children.get(row.version.id) ?? [])].reverse()) pending.push({ version: child, depth: row.depth + 1 });
  }
  // A parent cycle cannot be reached from a root in a single-parent graph.
  return visited.size === versions.length ? { rows, byId } : null;
}
