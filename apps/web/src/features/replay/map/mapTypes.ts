/**
 * Tipos genéricos para mapas do simulador.
 * Usados pelo editor e pelo engine.
 */

export type MapWall = { x: number; y: number; width: number; height: number };

export type MapZoneType = "site" | "spawn";

export type MapZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: MapZoneType;
};

export type MapSpawnPoint = { x: number; y: number };

export type MapData = {
  name: string;
  width: number;
  height: number;
  walls: MapWall[];
  zones: MapZone[];
  spawnPoints: {
    RED: MapSpawnPoint[];
    BLU: MapSpawnPoint[];
  };
};

/** Centro dos sites para plant/defuse (site-a, site-b) */
export function getSiteCenters(map: MapData): Record<"site-a" | "site-b", { x: number; y: number }> {
  const siteA = map.zones.find((z) => z.id === "site-a" && z.type === "site");
  const siteB = map.zones.find((z) => z.id === "site-b" && z.type === "site");
  return {
    "site-a": siteA ? { x: siteA.x + siteA.width / 2, y: siteA.y + siteA.height / 2 } : { x: 700, y: 100 },
    "site-b": siteB ? { x: siteB.x + siteB.width / 2, y: siteB.y + siteB.height / 2 } : { x: 100, y: 100 }
  };
}

/** Template vazio para novo mapa */
export const EMPTY_MAP: MapData = {
  name: "Novo mapa",
  width: 800,
  height: 600,
  walls: [],
  zones: [],
  spawnPoints: {
    RED: [],
    BLU: []
  }
};
