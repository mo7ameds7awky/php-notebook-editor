import { describe, expect, it } from "vitest";
import {
  applyEnvSuggestion,
  findActivePlaceholder,
  getEnvSuggestions,
} from "./envAutocomplete";
import type { EnvVar } from "../types/notebook";

const vars = (...entries: Array<[string, string] | [string, string, boolean]>): EnvVar[] =>
  entries.map(([name, value, secret]) => ({ name, value, secret: secret ?? false }));

describe("findActivePlaceholder", () => {
  it("activates right after {{ with an empty query", () => {
    expect(findActivePlaceholder("GET {{", 6)).toEqual({ start: 4, query: "" });
  });

  it("activates on a partial identifier fragment", () => {
    expect(findActivePlaceholder("{{ba", 4)).toEqual({ start: 0, query: "ba" });
    expect(findActivePlaceholder("{{_priv", 7)).toEqual({ start: 0, query: "_priv" });
  });

  it("uses the nearest unclosed {{ before the cursor", () => {
    expect(findActivePlaceholder("{{a}} {{to", 10)).toEqual({ start: 6, query: "to" });
  });

  it("does not activate without {{ before the cursor", () => {
    expect(findActivePlaceholder("plain text", 5)).toBeNull();
    expect(findActivePlaceholder("{a", 2)).toBeNull();
  });

  it("does not activate inside an already closed placeholder", () => {
    // Cursor between "ba" and "se" of {{base}}.
    expect(findActivePlaceholder("{{base}}", 4)).toBeNull();
    // Cursor right before }}.
    expect(findActivePlaceholder("{{base}}", 6)).toBeNull();
    // Cursor after }}.
    expect(findActivePlaceholder("{{base}}", 8)).toBeNull();
  });

  it("does not activate on non-identifier fragments", () => {
    expect(findActivePlaceholder("{{1bad", 6)).toBeNull();
    expect(findActivePlaceholder("{{a b", 5)).toBeNull();
    expect(findActivePlaceholder("{{ ", 3)).toBeNull();
  });

  it("treats a brace run's trailing {{ as the active opener", () => {
    expect(findActivePlaceholder("{{{", 3)).toEqual({ start: 1, query: "" });
  });

  it("only looks at text before the cursor for the fragment", () => {
    expect(findActivePlaceholder("{{ba tail", 4)).toEqual({ start: 0, query: "ba" });
  });
});

describe("getEnvSuggestions", () => {
  const pool = vars(["base_url", "u"], ["bar", "v"], ["abase", "w"], ["Token", "t", true]);

  it("returns every variable alphabetically for an empty query", () => {
    expect(getEnvSuggestions("", pool).map((v) => v.name)).toEqual([
      "abase",
      "bar",
      "base_url",
      "Token",
    ]);
  });

  it("puts prefix matches before contains matches, each group alphabetical", () => {
    expect(getEnvSuggestions("ba", pool).map((v) => v.name)).toEqual([
      "bar",
      "base_url",
      "abase",
    ]);
  });

  it("filters case-insensitively", () => {
    expect(getEnvSuggestions("TOK", pool).map((v) => v.name)).toEqual(["Token"]);
    expect(getEnvSuggestions("token", pool).map((v) => v.name)).toEqual(["Token"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(getEnvSuggestions("zzz", pool)).toEqual([]);
  });
});

describe("applyEnvSuggestion", () => {
  it("replaces the fragment from {{ to the cursor and moves the cursor after }}", () => {
    expect(applyEnvSuggestion("GET {{ba", 8, "base_url")).toEqual({
      text: "GET {{base_url}}",
      cursor: 16,
    });
  });

  it("completes a bare {{ and preserves text after the cursor", () => {
    expect(applyEnvSuggestion("{{/users", 2, "base_url")).toEqual({
      text: "{{base_url}}/users",
      cursor: 12,
    });
  });

  it("replaces only the active fragment when earlier placeholders are closed", () => {
    expect(applyEnvSuggestion("{{a}}/{{to", 10, "token")).toEqual({
      text: "{{a}}/{{token}}",
      cursor: 15,
    });
  });

  it("returns the input unchanged without an active fragment", () => {
    expect(applyEnvSuggestion("plain", 3, "base_url")).toEqual({ text: "plain", cursor: 3 });
    expect(applyEnvSuggestion("{{done}}", 8, "base_url")).toEqual({
      text: "{{done}}",
      cursor: 8,
    });
  });
});
