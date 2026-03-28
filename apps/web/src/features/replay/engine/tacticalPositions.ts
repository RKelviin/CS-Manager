/**
 * Posições táticas por role e estratégia: âncoras CT, formação TR, corredores.
 */
import { getRushSequence } from "../map/mapWaypoints";
import { getSiteCenters, type MapData } from "../map/mapTypes";
import { getCtSiteForBot } from "./ctStrategy";
import type { Bot, MatchState } from "../types";

export type TacticalPoint = { x: number; y: number };

/** Micro-variação nas âncoras para evitar previsibilidade (px) */
const ANCHOR_JITTER = 8;

const jitter = (p: TacticalPoint): TacticalPoint => ({
  x: p.x + (Math.random() - 0.5) * 2 * ANCHOR_JITTER,
  y: p.y + (Math.random() - 0.5) * 2 * ANCHOR_JITTER
});

/** Âncoras CT por site (A ou B) e role. Site = qual site o T vai atacar (tsExecuteSite). */
const CT_ANCHOR_SITE_A: Record<string, TacticalPoint> = {
  AWP: { x: 150, y: 180 },
  Entry: { x: 400, y: 200 },
  Support: { x: 550, y: 140 },
  Lurker: { x: 320, y: 220 },
  IGL: { x: 400, y: 150 },
  Sniper: { x: 150, y: 180 }
};

const CT_ANCHOR_SITE_B: Record<string, TacticalPoint> = {
  AWP: { x: 650, y: 180 },
  Entry: { x: 400, y: 200 },
  Support: { x: 250, y: 140 },
  Lurker: { x: 480, y: 220 },
  IGL: { x: 400, y: 150 },
  Sniper: { x: 650, y: 180 }
};

/** Posição de âncora para CT. Site conforme estratégia (3-2, stack-a, stack-b). */
export function getCtHoldPosition(bot: Bot, state: MatchState): TacticalPoint {
  const map = state.mapData as MapData | undefined;
  const centers = map ? getSiteCenters(map) : null;
  const slot = parseInt(bot.id.split("-")[1] ?? "0", 10) % 5;
  const site = getCtSiteForBot(slot, state.bluStrategy, state.tsExecuteSite ?? "site-a", state.bombPlantSite);
  const siteCenter = centers ? centers[site] : null;

  if (siteCenter) {
    const roleKey = bot.displayRole ?? (bot.role === "AWP" ? "Sniper" : bot.role === "IGL" ? "IGL" : "Support");
    const offset = (roleKey === "AWP" || roleKey === "Sniper") ? { x: -60, y: -30 } : { x: 0, y: 20 };
    return jitter({ x: siteCenter.x + offset.x, y: siteCenter.y + offset.y });
  }

  const anchors = (site === "site-a" ? CT_ANCHOR_SITE_A : CT_ANCHOR_SITE_B) as Record<string, TacticalPoint>;
  const roleKey = bot.displayRole ?? (bot.role === "AWP" ? "Sniper" : bot.role === "IGL" ? "IGL" : "Support");
  const pos = anchors[roleKey] ?? anchors.Support;
  return jitter(pos);
}

/** Posições de patrulha para CT — pontos no site atribuído conforme estratégia */
export function getCtHoldPatrolPositions(bot: Bot, state: MatchState): TacticalPoint[] {
  const map = state.mapData as MapData | undefined;
  const centers = map ? getSiteCenters(map) : null;
  const bluSpawns = map?.spawnPoints?.BLU ?? [];
  const bluBase = bluSpawns.length > 0
    ? { x: bluSpawns.reduce((s, p) => s + p.x, 0) / bluSpawns.length, y: Math.max(...bluSpawns.map((p) => p.y)) + 30 }
    : { x: (map?.width ?? 800) / 2, y: 100 };

  if (!centers) return [getCtHoldPosition(bot, state)];

  const slot = parseInt(bot.id.split("-")[1] ?? "0", 10) % 5;
  const site = getCtSiteForBot(slot, state.bluStrategy, state.tsExecuteSite ?? "site-a", state.bombPlantSite);
  const siteCenter = centers[site];
  const offset = (slot - 2) * 35;

  const choke = { x: (bluBase.x + siteCenter.x) / 2 + offset, y: (bluBase.y + siteCenter.y) / 2 };
  const nearSite = { x: siteCenter.x + offset * 0.6, y: siteCenter.y + 20 };
  const mid = { x: bluBase.x + offset * 0.3, y: (bluBase.y + siteCenter.y) / 2 };

  return [choke, nearSite, mid];
}

/** Offsets de formação TR em relação ao carrier (direção = para o site). Formação mais unida para dominar site. */
export const TR_FORMATION_OFFSETS: Record<string, { forward: number; lateral: number }> = {
  Entry: { forward: 55, lateral: 0 },
  AWP: { forward: -65, lateral: 45 },
  Support: { forward: 10, lateral: 35 },
  Lurker: { forward: 15, lateral: -50 },
  IGL: { forward: -25, lateral: -20 },
  Sniper: { forward: -65, lateral: 45 }
};

/**
 * Sequências ordenadas de waypoints para rush TR (spawn → site).
 * Cada sequência vai do spawn (alto y) em direção ao site alvo.
 */
const RUSH_SEQUENCE_A: TacticalPoint[] = [
  { x: 400, y: 450 },
  { x: 400, y: 360 },
  { x: 400, y: 300 },
  { x: 400, y: 220 },
  { x: 700, y: 100 }
];

const RUSH_SEQUENCE_B: TacticalPoint[] = [
  { x: 400, y: 450 },
  { x: 400, y: 360 },
  { x: 400, y: 300 },
  { x: 400, y: 220 },
  { x: 100, y: 100 }
];

const ARRIVE_THRESHOLD = 55;

/**
 * Retorna o próximo waypoint na sequência de rush com base na posição atual.
 * Usa waypoints derivados do mapa para suportar layouts variados.
 */
export function pickNextRushWaypoint(
  bot: { x: number; y: number },
  state: MatchState,
  map: MapData
): TacticalPoint {
  const site = state.tsExecuteSite ?? "site-a";
  const seq = getRushSequence(map, site);
  if (seq.length === 0) {
    const fallback = site === "site-a" ? RUSH_SEQUENCE_A : RUSH_SEQUENCE_B;
    return fallback[Math.min(1, fallback.length - 1)];
  }
  const sitePoint = seq[seq.length - 1];

  if (Math.hypot(bot.x - sitePoint.x, bot.y - sitePoint.y) < ARRIVE_THRESHOLD) {
    return sitePoint;
  }

  let lastReached = -1;
  for (let i = 0; i < seq.length; i++) {
    if (Math.hypot(bot.x - seq[i].x, bot.y - seq[i].y) < ARRIVE_THRESHOLD) {
      lastReached = i;
    }
  }
  const targetIndex = Math.min(lastReached + 1, seq.length - 1);
  return seq[targetIndex];
}

/** Filtra waypoints por role. TR: pool já focada no bombsite; roles definem abordagem. */
export function getWaypointPoolForRole(
  pool: TacticalPoint[],
  bot: { displayRole?: string; role: string; id: string; team: string },
  strategy: string,
  isRed: boolean
): TacticalPoint[] {
  if (pool.length === 0) return pool;
  const role = bot.displayRole ?? (bot.role === "AWP" ? "Sniper" : bot.role === "IGL" ? "IGL" : "Support");
  const slot = parseInt(bot.id.split("-")[1] ?? "0", 10) % 5;

  if (isRed) {
    const midX = 400;
    switch (strategy) {
      case "rush":
        return pool;
      case "split":
        const goRight = slot % 2 === 0;
        if (role === "Entry" || role === "Support") return pool.filter((p) => (goRight ? p.x >= midX - 40 : p.x <= midX + 40));
        if (role === "Lurker") return pool.filter((p) => (goRight ? p.x <= midX + 40 : p.x >= midX - 40));
        if (role === "AWP" || role === "Sniper") return pool.filter((p) => Math.abs(p.x - midX) < 80);
        return pool;
      case "slow":
        if (role === "Entry") return pool;
        if (role === "AWP" || role === "Sniper") return pool.filter((p) => Math.abs(p.x - midX) < 100);
        if (role === "Lurker") return pool.filter((p) => Math.abs(p.x - midX) > 60);
        return pool;
      default:
        return pool;
    }
  } else {
    switch (strategy) {
      case "aggressive":
        if (role === "AWP" || role === "Sniper") return pool.filter((p) => p.y <= 300);
        if (role === "Entry") return pool.filter((p) => p.y >= 280);
        if (role === "Lurker") return pool.filter((p) => Math.abs(p.x - 400) > 120);
        return pool;
      case "retake":
      case "rotate":
        if (role === "AWP" || role === "Sniper") return pool.filter((p) => p.y <= 250);
        return pool;
      case "hold":
      case "default":
      case "stack-a":
      case "stack-b":
        return pool;
      default:
        return pool;
    }
  }
}
