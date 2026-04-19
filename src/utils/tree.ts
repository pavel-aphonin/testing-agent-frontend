/**
 * Build a parent_id-linked flat array into a nested tree.
 *
 * Used by Ant Design's Tree and Table (which natively support `children`
 * for hierarchical rendering with unlimited depth).
 *
 * Orphans (parent_id pointing at something not in the list) become roots.
 * Cycles are broken by tracking visited ids — if a node would be visited
 * twice it's flattened to root level.
 */
export interface TreeNode<T extends { id: string; parent_id: string | null }> {
  /** The original item, with `children` populated. */
  item: T;
  children: TreeNode<T>[];
}

export function buildTree<T extends { id: string; parent_id: string | null }>(
  items: T[],
): TreeNode<T>[] {
  const byId = new Map<string, TreeNode<T>>();
  for (const item of items) {
    byId.set(item.id, { item, children: [] });
  }

  const roots: TreeNode<T>[] = [];
  for (const node of byId.values()) {
    const pid = node.item.parent_id;
    if (pid && byId.has(pid) && pid !== node.item.id) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Flatten a tree back to a list (depth-first). Useful for select dropdowns. */
export function flattenTree<T extends { id: string; parent_id: string | null }>(
  nodes: TreeNode<T>[],
  depth = 0,
): { item: T; depth: number }[] {
  const out: { item: T; depth: number }[] = [];
  for (const node of nodes) {
    out.push({ item: node.item, depth });
    out.push(...flattenTree(node.children, depth + 1));
  }
  return out;
}
