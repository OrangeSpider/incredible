import type { LevelDefinition } from "../engine/types.ts";
import { validateLevel } from "./catalog.ts";

export type LevelFile = { level: LevelDefinition; path: string };
type ReadableLevelFile = { name: string; webkitRelativePath?: string; text: () => Promise<string> };
export type LevelDirectory = {
  name: string;
  values: () => AsyncIterable<LevelDirectory | LevelFileHandle>;
  kind: "directory";
  getDirectoryHandle: (name: string, options?: { create: boolean }) => Promise<LevelDirectory>;
  getFileHandle: (name: string, options?: { create: boolean }) => Promise<LevelFileHandle>;
};
type LevelFileHandle = { name: string; kind: "file"; getFile: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }> };
type DirectoryWindow = Window & { showDirectoryPicker?: (options: { mode: "read" | "readwrite" }) => Promise<LevelDirectory> };

export function supportsLevelFolders() { return typeof window !== "undefined" && !!(window as DirectoryWindow).showDirectoryPicker; }
export async function pickLevelDirectory(mode: "read" | "readwrite") {
  const picker = (window as DirectoryWindow).showDirectoryPicker;
  if (!picker) throw new Error("Dieser Browser kann Ordner nur einlesen. Speichere Level mit „JSON herunterladen“.");
  return picker.call(window, { mode });
}
export function levelFilename(level: LevelDefinition) { return `${String(level.number).padStart(2, "0")}-${level.id.replace(/[^a-z0-9_-]/gi, "-")}.json`; }

export async function readLevelFiles(files: Iterable<ReadableLevelFile>): Promise<LevelFile[]> {
  const candidates = [...files].filter(file => /\.json$/i.test(file.name) && !/\.schema\.json$/i.test(file.name));
  const levels = await Promise.all(candidates.map(async file => {
    const path = file.webkitRelativePath || file.name;
    try { return { level: validateLevel(JSON.parse(await file.text())), path }; }
    catch (error) { throw new Error(`${path}: ${error instanceof Error ? error.message : "Ungültiges Level"}`); }
  }));
  if (!levels.length) throw new Error("Der Ordner enthält keine Leveldateien (.json).");
  const ids = new Set<string>();
  for (const file of levels) {
    if (ids.has(file.level.id)) throw new Error(`Doppelte Level-ID im Ordner: ${file.level.id}`);
    ids.add(file.level.id);
  }
  return levels.sort((a, b) => a.level.number - b.level.number || a.path.localeCompare(b.path, "de", { numeric: true }));
}

export async function readLevelDirectory(directory: LevelDirectory): Promise<LevelFile[]> {
  const files: ReadableLevelFile[] = [];
  const visit = async (folder: LevelDirectory, prefix: string) => {
    for await (const entry of folder.values()) {
      if (entry.kind === "directory") await visit(entry, `${prefix}${entry.name}/`);
      else if (/\.json$/i.test(entry.name)) files.push({ name: entry.name, webkitRelativePath: `${prefix}${entry.name}`, text: async () => (await entry.getFile()).text() });
    }
  };
  await visit(directory, "");
  return readLevelFiles(files);
}

export async function writeLevelFile(directory: LevelDirectory, level: LevelDefinition, path = levelFilename(level)): Promise<string> {
  const validated = validateLevel(level);
  const segments = path.split(/[\\/]/);
  if (segments.some(segment => !segment || segment === "." || segment === "..") || !/\.json$/i.test(segments.at(-1)!)) throw new Error("Ungültiger Level-Dateiname.");
  let folder = directory;
  for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true });
  const file = await folder.getFileHandle(segments.at(-1)!, { create: true });
  const writable = await file.createWritable();
  await writable.write(`${JSON.stringify(validated, null, 2)}\n`);
  await writable.close();
  return path;
}

export function downloadLevel(level: LevelDefinition) {
  const blob = new Blob([JSON.stringify(validateLevel(level), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = levelFilename(level); anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
