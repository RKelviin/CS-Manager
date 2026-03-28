/**
 * Mapa Dust2 simplificado — mesmas dimensoes e layout do motor legado (src/App.tsx).
 */
import type { MapData } from "./mapTypes";

export const DUST2_MAP: MapData = {
  name: "Dust 2 (Simplificado)",
  width: 800,
  height: 600,
  walls: [
    { x: 0, y: 0, width: 800, height: 10 },
    { x: 0, y: 590, width: 800, height: 10 },
    { x: 0, y: 0, width: 10, height: 600 },
    { x: 790, y: 0, width: 10, height: 600 },
    { x: 150, y: 150, width: 150, height: 150 },
    { x: 450, y: 150, width: 150, height: 300 },
    { x: 150, y: 400, width: 150, height: 100 }
  ],
  zones: [
    { id: "site-a", name: "Site A", x: 650, y: 50, width: 100, height: 100, type: "site" },
    { id: "site-b", name: "Site B", x: 50, y: 50, width: 100, height: 100, type: "site" },
    { id: "spawn-t", name: "T Spawn", x: 300, y: 500, width: 200, height: 80, type: "spawn" },
    { id: "spawn-ct", name: "CT Spawn", x: 300, y: 20, width: 200, height: 80, type: "spawn" }
  ],
  spawnPoints: {
    RED: [
      { x: 320, y: 540 },
      { x: 360, y: 540 },
      { x: 400, y: 540 },
      { x: 440, y: 540 },
      { x: 480, y: 540 }
    ],
    BLU: [
      { x: 320, y: 60 },
      { x: 360, y: 60 },
      { x: 400, y: 60 },
      { x: 440, y: 60 },
      { x: 480, y: 60 }
    ]
  },
  interestPoints: [
    { id: "d2-long-a", x: 520, y: 120, type: "angle", side: "CT", aimAngle: -Math.PI * 0.15 },
    { id: "d2-short-a", x: 580, y: 280, type: "flank", side: "TR", aimAngle: -Math.PI * 0.35 },
    { id: "d2-site-a-hold", x: 680, y: 95, type: "cover", side: "CT", aimAngle: Math.PI * 0.5 },
    { id: "d2-mid-doors", x: 400, y: 260, type: "choke", side: "both", aimAngle: -Math.PI / 2 },
    { id: "d2-b-apps", x: 180, y: 130, type: "angle", side: "both", aimAngle: Math.PI * 0.25 },
    { id: "d2-site-b", x: 120, y: 95, type: "cover", side: "CT", aimAngle: 0 },
    { id: "d2-lower-tunnel", x: 260, y: 420, type: "choke", side: "TR", aimAngle: -Math.PI * 0.4 }
  ],
  tacticalSpots: [
    { x: 540, y: 140, watchAngle: -Math.PI * 0.2, label: "long-A", side: "CT" },
    { x: 620, y: 240, watchAngle: -Math.PI / 2, label: "short-A", side: "both" },
    { x: 400, y: 240, watchAngle: Math.PI / 2, label: "mid-doors", side: "both" },
    { x: 200, y: 110, watchAngle: 0.4, label: "B-apps", side: "CT" },
    { x: 130, y: 130, watchAngle: Math.PI * 0.35, label: "B-site", side: "CT" },
    { x: 400, y: 400, watchAngle: -Math.PI / 2, label: "T-mid", side: "TR" }
  ]
};

const PLAY_MARGIN = 14;
/** Raio visual/colisao do bot (players um pouco maiores no mapa) */
export const BOT_RADIUS = 12;

/** Bot dentro do retangulo do site (para plant). */
export function botInSite(map: MapData, bot: { x: number; y: number }, siteId: "site-a" | "site-b"): boolean {
  const z = map.zones.find((z) => z.id === siteId);
  if (!z || z.type !== "site") return false;
  return bot.x >= z.x && bot.x <= z.x + z.width && bot.y >= z.y && bot.y <= z.y + z.height;
}

export function checkWallCollision(map: MapData, x: number, y: number, radius: number = BOT_RADIUS): boolean {
  return map.walls.some(
    (w) => x + radius > w.x && x - radius < w.x + w.width && y + radius > w.y && y - radius < w.y + w.height
  );
}

/** Move tentando (dx,dy); se colidir, tenta eixo X ou Y sozinho (slide). */
export function tryMove(
  map: MapData,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number = BOT_RADIUS
): { x: number; y: number } {
  const maxX = map.width - PLAY_MARGIN;
  const maxY = map.height - PLAY_MARGIN;
  const minX = PLAY_MARGIN;
  const minY = PLAY_MARGIN;

  const clampPos = (nx: number, ny: number) => ({
    x: Math.min(maxX - radius, Math.max(minX + radius, nx)),
    y: Math.min(maxY - radius, Math.max(minY + radius, ny))
  });

  let next = clampPos(x + dx, y + dy);
  if (!checkWallCollision(map, next.x, next.y, radius)) return next;

  const slideX = clampPos(x + dx, y);
  if (!checkWallCollision(map, slideX.x, slideX.y, radius)) return slideX;

  const slideY = clampPos(x, y + dy);
  if (!checkWallCollision(map, slideY.x, slideY.y, radius)) return slideY;

  for (const scale of [0.42, 0.22]) {
    const micro = clampPos(x + dx * scale, y + dy * scale);
    if (!checkWallCollision(map, micro.x, micro.y, radius)) return micro;
  }

  return { x, y };
}

/** Linha de visao bloqueada por parede (amostragem como no legado) */
export function lineIntersectsWall(map: MapData, p1: { x: number; y: number }, p2: { x: number; y: number }): boolean {
  for (const w of map.walls) {
    const left = w.x;
    const right = w.x + w.width;
    const top = w.y;
    const bottom = w.y + w.height;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / 15);
    for (let i = 1; i < steps; i++) {
      const checkX = p1.x + dx * (i / steps);
      const checkY = p1.y + dy * (i / steps);
      if (checkX >= left && checkX <= right && checkY >= top && checkY <= bottom) return true;
    }
  }
  return false;
}

/**
 * Slab method: menor t em que o raio O + t·D (D qualquer, não precisa normalizado) entra no retângulo sólido.
 * null se não há interseção à frente do sentido do raio.
 */
function raySolidRectEnterDistance(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number | null {
  let tNear = -Infinity;
  let tFar = Infinity;
  const EPS = 1e-9;

  if (Math.abs(dx) < EPS) {
    if (ox < minX || ox > maxX) return null;
  } else {
    const inv = 1 / dx;
    const t1 = (minX - ox) * inv;
    const t2 = (maxX - ox) * inv;
    const n = Math.min(t1, t2);
    const f = Math.max(t1, t2);
    tNear = Math.max(tNear, n);
    tFar = Math.min(tFar, f);
  }

  if (Math.abs(dy) < EPS) {
    if (oy < minY || oy > maxY) return null;
  } else {
    const inv = 1 / dy;
    const t1 = (minY - oy) * inv;
    const t2 = (maxY - oy) * inv;
    const n = Math.min(t1, t2);
    const f = Math.max(t1, t2);
    tNear = Math.max(tNear, n);
    tFar = Math.min(tFar, f);
  }

  if (tNear > tFar || tFar < 0) return null;
  if (tNear >= 0) return tNear;
  if (tNear < 0 && tFar >= 0) return 0;
  return null;
}

/** Margem para o preenchimento do cone não “vazar” sobre o traço da parede */
const RAY_CLIP_EPS = 2.5;

/**
 * Distância ao longo do raio (origem → direção) até a primeira parede, limitada a maxDist.
 * dirX/dirY não precisam ser normalizados.
 */
export function unobstructedRayDistance(
  map: MapData,
  ox: number,
  oy: number,
  dirX: number,
  dirY: number,
  maxDist: number
): number {
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-9) return 0;
  const dx = dirX / len;
  const dy = dirY / len;
  let best = maxDist;
  for (const w of map.walls) {
    const t = raySolidRectEnterDistance(ox, oy, dx, dy, w.x, w.y, w.x + w.width, w.y + w.height);
    if (t !== null && t >= 0 && t < best) best = t;
  }
  return Math.max(0, best - RAY_CLIP_EPS);
}
