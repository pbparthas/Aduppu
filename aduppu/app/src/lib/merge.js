// Per-item conflict resolution: when a remote item arrives, decide what the
// local store should hold. Simple newer-wins (LWW) for all item types:
//   - local copy untouched since last sync  -> remote wins outright
//   - both sides changed                    -> newer wins (last-writer-wins)
//   - equal timestamps                      -> remote wins so devices converge
// No conflict copies — meal planning items don't need them; a checkbox/title
// race doesn't merit a duplicate.

export function resolveItem(remote, local) {
  if (!local || !local.dirty) return { winner: remote, conflictCopy: null };

  const winner = local.updated_at > remote.updated_at ? local : remote;
  return { winner, conflictCopy: null };
}

export function newItem(partial) {
  return {
    id: crypto.randomUUID(),
    type: 'dish',
    deleted: false,
    deleted_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    dirty: 0,
    ...partial,
  };
}
