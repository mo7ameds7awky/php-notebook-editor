/** Pure JSON tree model for the response viewer. Hard guards keep huge or
 *  pathological payloads from ever reaching the renderer: past the limits the
 *  caller falls back to Pretty/Raw instead of attempting a tree. */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonNodeKind = "object" | "array" | "string" | "number" | "boolean" | "null";

export interface JsonTreeNode {
  kind: JsonNodeKind;
  /** Property name or stringified array index; null for the root. */
  key: string | null;
  depth: number;
  /** Original value reference — powers node-level copy without duplication. */
  value: JsonValue;
  /** Entry count for objects, length for arrays; 0 for scalars. */
  childCount: number;
  children: JsonTreeNode[];
  /** Short scalar display text; empty for containers. */
  preview: string;
}

export interface TreeGuards {
  /** Total node budget; beyond it the tree is not built at all. */
  maxNodes: number;
  /** Depth budget; beyond it the tree is not built at all. */
  maxDepth: number;
  /** Depth expanded by default when first rendered. */
  initialDepth: number;
  /** Expand-all refuses above this node count to avoid freezing the UI. */
  expandAllLimit: number;
}

export const DEFAULT_TREE_GUARDS: TreeGuards = {
  maxNodes: 50_000,
  maxDepth: 64,
  initialDepth: 2,
  expandAllLimit: 10_000,
};

const SCALAR_PREVIEW_MAX = 120;

export type ParseResult = { ok: true; value: JsonValue } | { ok: false };

/** JSON.parse that reports failure instead of throwing. */
export function safeParseJson(text: string): ParseResult {
  if (text.trim() === "") return { ok: false };
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch {
    return { ok: false };
  }
}

export type TreeBuildResult =
  | { ok: true; root: JsonTreeNode; nodeCount: number; maxDepth: number }
  | { ok: false; reason: "tooManyNodes" | "tooDeep" };

function scalarPreview(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") {
    const shown = value.length > SCALAR_PREVIEW_MAX ? `${value.slice(0, SCALAR_PREVIEW_MAX)}…` : value;
    return JSON.stringify(shown);
  }
  return String(value);
}

/** Builds the full tree within the guards, or refuses with the exceeded limit. */
export function buildTree(
  value: JsonValue,
  guards: TreeGuards = DEFAULT_TREE_GUARDS,
): TreeBuildResult {
  let nodeCount = 0;
  let maxDepth = 0;

  function build(current: JsonValue, key: string | null, depth: number): JsonTreeNode | null {
    if (depth > guards.maxDepth) return null;
    nodeCount += 1;
    if (nodeCount > guards.maxNodes) return null;
    if (depth > maxDepth) maxDepth = depth;

    if (Array.isArray(current)) {
      const children: JsonTreeNode[] = [];
      for (let i = 0; i < current.length; i++) {
        const child = build(current[i], String(i), depth + 1);
        if (child === null) return null;
        children.push(child);
      }
      return { kind: "array", key, depth, value: current, childCount: current.length, children, preview: "" };
    }
    if (current !== null && typeof current === "object") {
      const entries = Object.entries(current);
      const children: JsonTreeNode[] = [];
      for (const [childKey, childValue] of entries) {
        const child = build(childValue, childKey, depth + 1);
        if (child === null) return null;
        children.push(child);
      }
      return { kind: "object", key, depth, value: current, childCount: entries.length, children, preview: "" };
    }

    const kind: JsonNodeKind =
      current === null ? "null" : (typeof current as "string" | "number" | "boolean");
    return { kind, key, depth, value: current, childCount: 0, children: [], preview: scalarPreview(current) };
  }

  const root = build(value, null, 0);
  if (root === null) {
    return { ok: false, reason: nodeCount > guards.maxNodes ? "tooManyNodes" : "tooDeep" };
  }
  return { ok: true, root, nodeCount, maxDepth };
}
