/**
 * Registro de mapas disponíveis para simulação.
 * Inclui mapas built-in e mapas customizados (API).
 */
import { DUST2_MAP } from "./dust2Map";
import { INFERNO_MAP } from "./inferno";
import type { MapData } from "./mapTypes";

export type MapInfo = { id: string; name: string };

const BUILTIN_MAPS: Map<string, MapData> = new Map([
  ["dust2", { ...DUST2_MAP } as MapData],
  ["inferno", { ...INFERNO_MAP } as MapData]
]);

/** Lista de mapas built-in para seleção rápida */
export const BUILTIN_MAP_IDS = ["dust2", "inferno"] as const;

/** Retorna mapa por id (síncrono, apenas built-in) */
export function getMapSync(id: string): MapData | null {
  return BUILTIN_MAPS.get(id) ?? null;
}

/** Lista ids e nomes dos mapas built-in */
export function getBuiltinMaps(): MapInfo[] {
  return [
    { id: "dust2", name: DUST2_MAP.name },
    { id: "inferno", name: INFERNO_MAP.name }
  ];
}

const getApiBase = () => (import.meta.env?.VITE_API_URL ?? "/api").replace(/\/$/, "");

/** Obtém mapa por id: built-in síncrono ou via API */
export async function getMap(id: string): Promise<MapData | null> {
  const builtin = getMapSync(id);
  if (builtin) return builtin;
  try {
    const res = await fetch(`${getApiBase()}/maps/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as MapData;
  } catch {
    return null;
  }
}

/** Lista todos os mapas (built-in + API) */
export async function getAllMaps(): Promise<MapInfo[]> {
  const builtin = getBuiltinMaps();
  try {
    const res = await fetch(`${getApiBase()}/maps`);
    if (!res.ok) return builtin;
    const apiMaps = (await res.json()) as MapInfo[];
    const seen = new Set(builtin.map((m) => m.id));
    for (const m of apiMaps) {
      if (!seen.has(m.id)) {
        builtin.push(m);
        seen.add(m.id);
      }
    }
  } catch {
    // ignore
  }
  return builtin;
}

/** Salva mapa via API — grava em apps/web/src/features/replay/map/ */
export async function saveMapToFolder(mapData: MapData): Promise<{ id: string; name: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("csm_token") : null;
  const res = await fetch(`${getApiBase()}/maps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(mapData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json();
}
