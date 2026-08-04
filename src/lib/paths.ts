/** Pure helpers for notebook file paths. */

export const PNB_EXTENSION = ".pnb.json";

export function ensurePnbExtension(path: string): string {
  if (path.endsWith(PNB_EXTENSION)) return path;
  if (path.endsWith(".json")) return `${path.slice(0, -".json".length)}${PNB_EXTENSION}`;
  return `${path}${PNB_EXTENSION}`;
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function titleFromPath(path: string): string {
  const name = fileNameFromPath(path);
  const stem = name.endsWith(PNB_EXTENSION)
    ? name.slice(0, -PNB_EXTENSION.length)
    : name.replace(/\.[^.]+$/, "");
  return stem || "Untitled notebook";
}
