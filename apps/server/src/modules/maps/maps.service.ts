import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Pasta de mapas customizados: apps/web/src/features/replay/map */
const MAPS_DIR = path.resolve(__dirname, "../../../../web/src/features/replay/map");

type MapData = {
  name: string;
  width: number;
  height: number;
  walls: { x: number; y: number; width: number; height: number }[];
  zones: { id: string; name: string; x: number; y: number; width: number; height: number; type: string }[];
  spawnPoints: { RED: { x: number; y: number }[]; BLU: { x: number; y: number }[] };
};

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

export async function listMaps(): Promise<{ id: string; name: string }[]> {
  const builtin = [{ id: "dust2", name: "Dust 2 (Simplificado)" }];
  try {
    if (!fs.existsSync(MAPS_DIR)) return builtin;
    const files = fs.readdirSync(MAPS_DIR);
    const custom: { id: string; name: string }[] = [];
    for (const f of files) {
      if (!f.endsWith(".map.json")) continue;
      const id = f.replace(".map.json", "");
      try {
        const raw = fs.readFileSync(path.join(MAPS_DIR, f), "utf-8");
        const data = JSON.parse(raw) as MapData;
        custom.push({ id, name: data.name || id });
      } catch {
        custom.push({ id, name: id });
      }
    }
    return [...builtin, ...custom];
  } catch {
    return builtin;
  }
}

export async function getMap(id: string): Promise<MapData | null> {
  if (id === "dust2") return null;
  try {
    const p = path.join(MAPS_DIR, `${id}.map.json`);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as MapData;
  } catch {
    return null;
  }
}

export async function saveMap(data: MapData): Promise<{ id: string; name: string }> {
  if (!data?.name || !data?.walls || !data?.zones || !data?.spawnPoints) {
    throw new Error("Dados do mapa inválidos");
  }
  const id = slugify(data.name) || "custom-map";
  const jsonPath = path.join(MAPS_DIR, `${id}.map.json`);
  const tsPath = path.join(MAPS_DIR, `${id}.ts`);

  if (!fs.existsSync(path.dirname(MAPS_DIR))) {
    fs.mkdirSync(path.dirname(MAPS_DIR), { recursive: true });
  }
  if (!fs.existsSync(MAPS_DIR)) {
    fs.mkdirSync(MAPS_DIR, { recursive: true });
  }

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  const tsContent = `/**
 * Mapa customizado: ${data.name}
 * Gerado pelo Editor de mapas.
 */
import type { MapData } from "./mapTypes";

export const ${id.replace(/-/g, "_").toUpperCase()}_MAP: MapData = ${JSON.stringify(data, null, 2)};
`;

  fs.writeFileSync(tsPath, tsContent);

  return { id, name: data.name };
}
