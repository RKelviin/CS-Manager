/**
 * Geração dinâmica de waypoints a partir do mapa.
 * Em mapas complexos, evita destinos dentro de paredes e usa sites/spawns reais.
 */
import { checkWallCollision } from "./dust2Map";
import { getSiteCenters, type MapData } from "./mapTypes";

export type Waypoint = { x: number; y: number };

const isWalkable = (map: MapData, x: number, y: number) =>
  !checkWallCollision(map, x, y) &&
  x >= 14 && x <= map.width - 14 &&
  y >= 14 && y <= map.height - 14;

/** Choke points e corredores derivados do mapa (spawns, sites, mid) — para nav mesh e navegação */
export function getMapChokePoints(map: MapData): {
  mid: Waypoint;
  chokeA: Waypoint;
  chokeB: Waypoint;
  tToA: Waypoint;
  tToB: Waypoint;
  siteA: Waypoint;
  siteB: Waypoint;
} {
  const centers = getSiteCenters(map);
  const redSpawns = map.spawnPoints?.RED ?? [];
  const bluSpawns = map.spawnPoints?.BLU ?? [];
  const redBase =
    redSpawns.length > 0
      ? {
          x: redSpawns.reduce((s, p) => s + p.x, 0) / redSpawns.length,
          y: Math.min(...redSpawns.map((p) => p.y)) - 20
        }
      : { x: map.width / 2, y: map.height - 80 };
  const bluBase =
    bluSpawns.length > 0
      ? {
          x: bluSpawns.reduce((s, p) => s + p.x, 0) / bluSpawns.length,
          y: Math.max(...bluSpawns.map((p) => p.y)) + 30
        }
      : { x: map.width / 2, y: 60 };

  const mid = { x: (redBase.x + bluBase.x) / 2, y: (redBase.y + bluBase.y) / 2 };
  const chokeA = {
    x: (bluBase.x + centers["site-a"].x) / 2,
    y: (bluBase.y + centers["site-a"].y) / 2
  };
  const chokeB = {
    x: (bluBase.x + centers["site-b"].x) / 2,
    y: (bluBase.y + centers["site-b"].y) / 2
  };
  const tToA = {
    x: (redBase.x + centers["site-a"].x) / 2,
    y: (redBase.y + centers["site-a"].y) / 2
  };
  const tToB = {
    x: (redBase.x + centers["site-b"].x) / 2,
    y: (redBase.y + centers["site-b"].y) / 2
  };
  return {
    mid,
    chokeA,
    chokeB,
    tToA,
    tToB,
    siteA: centers["site-a"],
    siteB: centers["site-b"]
  };
}

/** Pontos intermediários entre A e B (corredores) */
function midPoints(a: Waypoint, b: Waypoint, count: number): Waypoint[] {
  const out: Waypoint[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Waypoints válidos (caminháveis) para spawn RED (roster) e BLU (roster) */
export function getMapWaypoints(map: MapData): { red: Waypoint[]; blu: Waypoint[] } {
  const centers = getSiteCenters(map);
  const siteA = centers["site-a"];
  const siteB = centers["site-b"];

  const redSpawns = map.spawnPoints?.RED ?? [];
  const bluSpawns = map.spawnPoints?.BLU ?? [];
  const redBase = redSpawns.length > 0
    ? { x: redSpawns.reduce((s, p) => s + p.x, 0) / redSpawns.length, y: Math.min(...redSpawns.map((p) => p.y)) }
    : { x: map.width / 2, y: map.height - 80 };
  const bluBase = bluSpawns.length > 0
    ? { x: bluSpawns.reduce((s, p) => s + p.x, 0) / bluSpawns.length, y: Math.max(...bluSpawns.map((p) => p.y)) }
    : { x: map.width / 2, y: 80 };

  const collectWalkable = (pts: Waypoint[]): Waypoint[] => {
    const seen = new Set<string>();
    return pts.filter((p) => {
      const key = `${Math.round(p.x / 20)}_${Math.round(p.y / 20)}`;
      if (seen.has(key)) return false;
      if (!isWalkable(map, p.x, p.y)) return false;
      seen.add(key);
      return true;
    });
  };

  const redCandidates: Waypoint[] = [
    ...redSpawns,
    siteA,
    siteB,
    { x: map.width / 2, y: map.height * 0.6 },
    { x: map.width / 2, y: map.height * 0.4 },
    ...midPoints(redBase, siteA, 3),
    ...midPoints(redBase, siteB, 3),
    { x: map.width * 0.2, y: map.height * 0.5 },
    { x: map.width * 0.8, y: map.height * 0.5 }
  ];

  const bluCandidates: Waypoint[] = [
    ...bluSpawns,
    siteA,
    siteB,
    { x: map.width / 2, y: map.height * 0.4 },
    { x: map.width / 2, y: map.height * 0.6 },
    ...midPoints(bluBase, siteA, 3),
    ...midPoints(bluBase, siteB, 3),
    { x: map.width * 0.2, y: map.height * 0.5 },
    { x: map.width * 0.8, y: map.height * 0.5 }
  ];

  const red = collectWalkable(redCandidates);
  const blu = collectWalkable(bluCandidates);

  return { red: red.length >= 3 ? red : [siteA, siteB, redBase], blu: blu.length >= 3 ? blu : [siteA, siteB, bluBase] };
}

/** Sequência rush papel RED: spawn → site alvo (caminho direto) */
export function getRushSequence(map: MapData, site: "site-a" | "site-b"): Waypoint[] {
  const centers = getSiteCenters(map);
  const target = centers[site];
  const redSpawns = map.spawnPoints?.RED ?? [];
  const start = redSpawns.length > 0
    ? { x: redSpawns[2].x, y: redSpawns[2].y }
    : { x: map.width / 2, y: map.height - 80 };

  const pts = [start, ...midPoints(start, target, 4), target];
  return pts.filter((p) => isWalkable(map, p.x, p.y));
}

/** Offset perpendicular à rota (para flancos) */
function perpendicularOffset(a: Waypoint, b: Waypoint, t: number, side: number): Waypoint {
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const off = 55 * side;
  return { x: x + perpX * off, y: y + perpY * off };
}

/**
 * Waypoints do papel RED focados em dominar um bombsite.
 * Inclui rota direta, flanco esquerdo e flanco direito — todos convergem no site.
 */
export function getRedSideWaypointsToSite(map: MapData, site: "site-a" | "site-b"): Waypoint[] {
  const centers = getSiteCenters(map);
  const target = centers[site];
  const redSpawns = map.spawnPoints?.RED ?? [];
  const start = redSpawns.length > 0
    ? { x: redSpawns.reduce((s, p) => s + p.x, 0) / redSpawns.length, y: Math.min(...redSpawns.map((p) => p.y)) - 20 }
    : { x: map.width / 2, y: map.height - 80 };

  const direct = [start, ...midPoints(start, target, 5), target];
  const pts: Waypoint[] = [...direct];

  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    pts.push(perpendicularOffset(start, target, t, 1));
    pts.push(perpendicularOffset(start, target, t, -1));
  }

  const seen = new Set<string>();
  return pts.filter((p) => {
    const key = `${Math.round(p.x / 18)}_${Math.round(p.y / 18)}`;
    if (seen.has(key)) return false;
    if (!isWalkable(map, p.x, p.y)) return false;
    seen.add(key);
    return true;
  });
}
