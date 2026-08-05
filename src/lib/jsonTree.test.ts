import { describe, expect, it } from "vitest";
import {
  buildTree,
  DEFAULT_TREE_GUARDS,
  safeParseJson,
  type JsonValue,
  type TreeGuards,
} from "./jsonTree";

const guards = (partial: Partial<TreeGuards>): TreeGuards => ({
  ...DEFAULT_TREE_GUARDS,
  ...partial,
});

const okTree = (value: JsonValue, g?: TreeGuards) => {
  const result = buildTree(value, g);
  if (!result.ok) throw new Error(`expected ok tree, got ${result.reason}`);
  return result;
};

describe("safeParseJson", () => {
  it("parses valid JSON of every type", () => {
    expect(safeParseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(safeParseJson("[1,2]")).toEqual({ ok: true, value: [1, 2] });
    expect(safeParseJson('"s"')).toEqual({ ok: true, value: "s" });
    expect(safeParseJson("null")).toEqual({ ok: true, value: null });
  });

  it("reports failure for invalid or empty input without throwing", () => {
    expect(safeParseJson("{broken").ok).toBe(false);
    expect(safeParseJson("").ok).toBe(false);
    expect(safeParseJson("   ").ok).toBe(false);
  });
});

describe("buildTree", () => {
  it("models objects and arrays with counts, keys, and depths", () => {
    const { root, nodeCount, maxDepth } = okTree({ user: { name: "Ada" }, tags: ["a", "b"] });
    expect(root.kind).toBe("object");
    expect(root.key).toBeNull();
    expect(root.childCount).toBe(2);

    const user = root.children[0];
    expect(user).toMatchObject({ kind: "object", key: "user", depth: 1, childCount: 1 });
    expect(user.children[0]).toMatchObject({
      kind: "string",
      key: "name",
      depth: 2,
      preview: '"Ada"',
    });

    const tags = root.children[1];
    expect(tags).toMatchObject({ kind: "array", key: "tags", childCount: 2 });
    expect(tags.children[1]).toMatchObject({ key: "1", preview: '"b"' });

    expect(nodeCount).toBe(6);
    expect(maxDepth).toBe(2);
  });

  it("previews every scalar kind and truncates long strings", () => {
    const { root } = okTree([null, true, 42, 4.5, "x".repeat(200)]);
    const previews = root.children.map((c) => c.preview);
    expect(previews[0]).toBe("null");
    expect(previews[1]).toBe("true");
    expect(previews[2]).toBe("42");
    expect(previews[3]).toBe("4.5");
    expect(previews[4]).toContain("…");
    expect(previews[4].length).toBeLessThan(140);
  });

  it("keeps the original value reference on every node for copy actions", () => {
    const value = { nested: { deep: [1, 2, 3] } };
    const { root } = okTree(value);
    expect(root.value).toBe(value);
    expect(root.children[0].children[0].value).toBe(value.nested.deep);
  });

  it("refuses trees over the node budget with a typed reason", () => {
    const wide = Array.from({ length: 100 }, (_, i) => i);
    const result = buildTree(wide, guards({ maxNodes: 50 }));
    expect(result).toEqual({ ok: false, reason: "tooManyNodes" });
  });

  it("refuses trees over the depth budget with a typed reason", () => {
    let deep: JsonValue = "leaf";
    for (let i = 0; i < 20; i++) deep = [deep];
    const result = buildTree(deep, guards({ maxDepth: 10 }));
    expect(result).toEqual({ ok: false, reason: "tooDeep" });
  });

  it("handles big arrays inside the default guards", () => {
    const big = Array.from({ length: 5_000 }, (_, i) => ({ i }));
    const { nodeCount } = okTree(big);
    expect(nodeCount).toBe(1 + 5_000 * 2);
  });

  it("builds scalar roots as leaf-only trees", () => {
    const { root, nodeCount } = okTree("just a string");
    expect(root).toMatchObject({ kind: "string", childCount: 0, depth: 0 });
    expect(nodeCount).toBe(1);
  });
});
