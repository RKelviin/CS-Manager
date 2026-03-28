/**
 * Grafo de navegacao: pontos em areas caminhaveis + arestas com LOS sem parede.
 * Caminho via BFS; fallback para linha reta se necessario.
 * Choke points e mid dinamicos por mapa para rotas mais naturais.
 */
import { checkWallCollision, lineIntersectsWall } from "./dust2Map";
import { getSiteCenters, type MapData } from "./mapTypes";
import { getMapChokePoints } from "./mapWaypoints";
import type { Bot } from "../types";

export type NavPoint = { x: number; y: number };

const dist = (a: NavPoint, b: NavPoint) => Math.hypot(a.x - b.x, a.y - b.y);

type NavMeshCache = {
  nodes: NavPoint[];
  adj: Map<number, number[]>;
  canTravelLine: (a: NavPoint, b: NavPoint) => boolean;
  findNavPath: (from: NavPoint, to: NavPoint) => NavPoint[];
};

const cache = new Map<string, NavMeshCache>();

const mapCacheKey = (map: MapData) => `${map.name}-${map.width}x${map.height}-${map.walls.length}`;

function buildNavMesh(map: MapData): NavMeshCache {
  const key = mapCacheKey(map);
  const cached = cache.get(key);
  if (cached) return cached;

  const check = (x: number, y: number) => checkWallCollision(map, x, y);
  const los = (a: NavPoint, b: NavPoint) => !lineIntersectsWall(map, a, b);

  const canTravelLine = (a: NavPoint, b: NavPoint): boolean => {
    if (check(a.x, a.y) || check(b.x, b.y)) return false;
    return los(a, b);
  };

  /** Grid mais denso em mapas complexos (muitas paredes) para cobrir corredores */
  const wallCount = map.walls?.length ?? 0;
  const GRID_STEP = wallCount > 12 ? 55 : wallCount > 6 ? 65 : 85;
  const MAX_EDGE = wallCount > 12 ? 280 : 320;

  const nodes: NavPoint[] = [];
  const margin = 55;
  const maxX = map.width - margin;
  const maxY = map.height - margin;
  for (let x = margin; x <= maxX; x += GRID_STEP) {
    for (let y = margin; y <= maxY; y += GRID_STEP) {
      if (!check(x, y)) nodes.push({ x, y });
    }
  }

  /** Pontos do mapa (sites, spawns, chokes) garantem cobertura dos objetivos e rotas dinamicas */
  const extra: NavPoint[] = [];
  const centers = getSiteCenters(map);
  extra.push(centers["site-a"], centers["site-b"]);
  for (const sp of map.spawnPoints?.RED ?? []) extra.push(sp);
  for (const sp of map.spawnPoints?.BLU ?? []) extra.push(sp);
  if (map.zones?.some((z) => z.id === "site-a")) {
    const chokes = getMapChokePoints(map);
    extra.push(chokes.mid, chokes.chokeA, chokes.chokeB, chokes.tToA, chokes.tToB);
  }
  /** Fallback para Dust2-like (mapas sem zones/spawns definidos) */
  if (extra.length <= 2) {
    extra.push(
      { x: 400, y: 520 },
      { x: 400, y: 300 },
      { x: 100, y: 100 },
      { x: 700, y: 100 },
      { x: map.width / 2, y: map.height - 60 },
      { x: map.width / 2, y: 60 }
    );
  }
  for (const p of extra) {
    if (p.x >= 0 && p.x < map.width && p.y >= 0 && p.y < map.height && !check(p.x, p.y) && !nodes.some((q) => dist(q, p) < 20)) {
      nodes.push(p);
    }
  }

  const adj: Map<number, number[]> = new Map();
  const n = nodes.length;
  for (let i = 0; i < n; i++) adj.set(i, []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dist(nodes[i], nodes[j]);
      if (d > MAX_EDGE) continue;
      if (!canTravelLine(nodes[i], nodes[j])) continue;
      adj.get(i)!.push(j);
      adj.get(j)!.push(i);
    }
  }

  const nearestNodeIndex = (p: NavPoint): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = dist(p, nodes[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const findNavPath = (from: NavPoint, to: NavPoint): NavPoint[] => {
    if (canTravelLine(from, to)) return [to];

    const startNodes: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (canTravelLine(from, nodes[i])) startNodes.push(i);
    }
    if (startNodes.length === 0) startNodes.push(nearestNodeIndex(from));

    const endNodes = new Set<number>();
    for (let i = 0; i < nodes.length; i++) {
      if (canTravelLine(nodes[i], to)) endNodes.add(i);
    }
    if (endNodes.size === 0) endNodes.add(nearestNodeIndex(to));

    const parent = new Map<number, number | null>();
    const queue: number[] = [];
    for (const s of startNodes) {
      parent.set(s, null);
      queue.push(s);
    }

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (endNodes.has(u)) {
        const chain: number[] = [];
        let cur: number | null = u;
        while (cur !== null) {
          chain.unshift(cur);
          cur = parent.get(cur) ?? null;
        }
        const waypoints: NavPoint[] = chain.map((idx) => ({ ...nodes[idx] }));
        waypoints.push({ ...to });
        return waypoints;
      }
      for (const v of adj.get(u) ?? []) {
        if (!parent.has(v)) {
          parent.set(v, u);
          queue.push(v);
        }
      }
    }

    return [to];
  };

  const mesh: NavMeshCache = { nodes, adj, canTravelLine, findNavPath };
  cache.set(key, mesh);
  return mesh;
}

/** Linha entre dois pontos nao atravessa parede e extremos sao caminhaveis */
export const canTravelLine = (map: MapData, a: NavPoint, b: NavPoint): boolean =>
  buildNavMesh(map).canTravelLine(a, b);

/**
 * Caminho de sub-waypoints ate o objetivo (nao inclui posicao atual).
 */
export const findNavPath = (map: MapData, from: NavPoint, to: NavPoint): NavPoint[] =>
  buildNavMesh(map).findNavPath(from, to);

export const syncNavToGoal = (map: MapData, bot: Bot, arriveDist: number) => {
  const mesh = buildNavMesh(map);
  const gx = bot.targetX;
  const gy = bot.targetY;
  if (Math.abs(bot.navGoalX - gx) > 3 || Math.abs(bot.navGoalY - gy) > 3) {
    bot.navGoalX = gx;
    bot.navGoalY = gy;
    bot.navPath = mesh.findNavPath({ x: bot.x, y: bot.y }, { x: gx, y: gy });
    bot.navStuckTicks = 0;
  }
  if (!Array.isArray(bot.navPath)) bot.navPath = [];

  while (bot.navPath.length > 0) {
    const w = bot.navPath[0];
    if (dist(bot, w) < arriveDist) bot.navPath.shift();
    else break;
  }

  const dGoal = dist(bot, { x: gx, y: gy });
  if (bot.navPath.length === 0 && dGoal > arriveDist) {
    bot.navPath = mesh.findNavPath({ x: bot.x, y: bot.y }, { x: gx, y: gy });
  }
};
