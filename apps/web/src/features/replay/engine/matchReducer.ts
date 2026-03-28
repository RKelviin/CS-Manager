import { createMatchState } from "./createMatchState";
import {
  BASE_DAMAGE_MAX,
  BASE_DAMAGE_MIN,
  HEADSHOT_DAMAGE_MULTIPLIER,
  SNIPER_FIXED_DAMAGE
} from "./combatConstants";
import {
  getDamageMultiplierForRole,
  getFireCooldownTicksForRole,
  getHeadshotChanceForRole,
  getHitChanceBonusForRole,
  getRangePenaltyMultiplier,
  getRotateStepForRole,
  getWeaponFovForRole,
  getWeaponRangeForRole
} from "./roleCombat";
import { weaponKind, weaponTierValue } from "../ui/weaponIcons";
import {
  canSeeWithFov,
  computeDesiredAimAngle,
  DAMAGE_MEMORY_TICKS,
  panicPenalty,
  getPlantedBombWorldPos,
  getTrMovementExecuteSite,
  pickCombatVictim
} from "./situationalBrain";
import { applyPlayerDecision } from "./playerDecision";
import { buildPlayerView } from "./playerView";
import { botInSite, tryMove, DUST2_MAP } from "../map/dust2Map";
import { findNavPath, syncNavToGoal } from "../map/navMesh";
import {
  DEFUSE_KIT_DROP_PICKUP_RADIUS,
  DEFUSE_KIT_MS,
  DEFUSE_NO_KIT_MS,
  DEFUSE_RADIUS,
  PLANT_TIME_MS,
  POST_PLANT_EXPLODE_MS,
  WEAPON_DROP_PICKUP_RADIUS
} from "./bombConstants";
import {
  DEFUSE_BONUS,
  KILL_REWARD,
  LOSS_BONUS_TIERS,
  MAX_MONEY,
  PLANT_BONUS,
  ROUND_WIN_BONUS
} from "./economyConstants";
import { chooseBluStrategyForRound, getCtSiteForBot } from "./ctStrategy";
import { damageAfterArmor } from "./roundBuy";
import { applyMoraleAfterRound, applyPendingRoundAdvance, snapshotBotsForAdvance } from "./roundAdvance";
import { clamp, pushLog, timeLabel } from "./matchUtils";
import {
  getCtTeamFromState,
  getTrTeam,
  getTrTeamFromState,
  OT_MAX_ROUND,
  OT_POINTS_TO_WIN_PERIOD,
  OT_ROUNDS_PER_PERIOD,
  REGULATION_MAX_ROUNDS,
  ROUNDS_TO_WIN_MATCH,
  ROUNDS_TO_WIN_OT
} from "./matchConstants";
import { getWaypointPoolForRole, pickNextRushWaypoint } from "./tacticalPositions";
import { getMapWaypoints, getTrWaypointsToSite } from "../map/mapWaypoints";
import { getSiteCenters } from "../map/mapTypes";
import type { Bot, MatchEvent, MatchState, TeamSide } from "../types";

const mapFor = (s: MatchState) => s.mapData ?? DUST2_MAP;

const normalizeAngle = (a: number) => {
  let x = a;
  while (x < -Math.PI) x += Math.PI * 2;
  while (x > Math.PI) x -= Math.PI * 2;
  return x;
};

const rotateTowards = (bot: Bot, targetAngle: number, step: number) => {
  let diff = normalizeAngle(targetAngle - bot.angle);
  if (Math.abs(diff) < step) bot.angle = normalizeAngle(targetAngle);
  else bot.angle = normalizeAngle(bot.angle + Math.sign(diff) * step);
};

/** Waypoints fallback (Dust2) quando mapa não fornece suficientes */
const NAV_RED_FALLBACK = [
  { x: 400, y: 450 },
  { x: 400, y: 300 },
  { x: 700, y: 100 },
  { x: 100, y: 100 },
  { x: 260, y: 480 },
  { x: 540, y: 480 },
  { x: 500, y: 400 },
  { x: 350, y: 320 }
];
const NAV_BLU_FALLBACK = [
  { x: 400, y: 150 },
  { x: 400, y: 300 },
  { x: 700, y: 100 },
  { x: 100, y: 100 },
  { x: 120, y: 250 },
  { x: 680, y: 260 },
  { x: 500, y: 400 },
  { x: 320, y: 200 },
  { x: 400, y: 72 }
];

const filterNav = (pts: { x: number; y: number }[], pred: (p: { x: number; y: number }) => boolean) => {
  const f = pts.filter(pred);
  return f.length > 0 ? f : pts;
};

const pickNewTarget = (bot: Bot, state: MatchState) => {
  const isRed = bot.team === "RED";
  const map = mapFor(state);
  const execSite = isRed ? getTrMovementExecuteSite(state) : (state.tsExecuteSite ?? "site-a");

  if (isRed) {
    const sitePool = getTrWaypointsToSite(map as import("../map/mapTypes").MapData, execSite);
    const list = sitePool.length >= 4 ? sitePool : NAV_RED_FALLBACK;
    const centers = (map as import("../map/mapTypes").MapData).zones?.some((z) => z.id === "site-a")
      ? getSiteCenters(map as import("../map/mapTypes").MapData)
      : null;
    const siteCenter = centers ? centers[execSite] : { x: map.width / 2, y: 80 };

    if (state.redStrategy === "rush") {
      const next = pickNextRushWaypoint(bot, state, map as import("../map/mapTypes").MapData);
      bot.targetX = next.x;
      bot.targetY = next.y;
      return;
    }

    let pool: { x: number; y: number }[];
    const slot = Number(bot.id.split("-")[1]) % 5;
    const midX = map.width / 2;

    switch (state.redStrategy) {
      case "split":
        pool = slot % 2 === 0
          ? filterNav(list, (p) => p.x >= midX - 30)
          : filterNav(list, (p) => p.x <= midX + 30);
        break;
      case "slow":
        pool = filterNav(list, (p) => Math.hypot(p.x - siteCenter.x, p.y - siteCenter.y) > 80);
        break;
      default:
        pool = list;
    }

    const rolePool = getWaypointPoolForRole(pool, bot, state.redStrategy, true);
    const effectivePool = rolePool.length > 0 ? rolePool : pool;
    const trTeam = getTrTeamFromState(state);
    const allies = state.bots.filter((b) => b.team === trTeam && b.hp > 0 && b.id !== bot.id);
    const avgAlly = allies.length > 0
      ? { x: allies.reduce((s, a) => s + a.x, 0) / allies.length, y: allies.reduce((s, a) => s + a.y, 0) / allies.length }
      : null;
    const scoreWaypoint = (p: { x: number; y: number }) => {
      let s = 0.4 + Math.random() * 0.3;
      const dExec = Math.hypot(p.x - siteCenter.x, p.y - siteCenter.y);
      s += 120 / (dExec + 25);
      if (avgAlly) {
        const dAlly = Math.hypot(p.x - avgAlly.x, p.y - avgAlly.y);
        s += 40 / (dAlly + 80);
      }
      const distFromCurrent = Math.hypot(p.x - bot.targetX, p.y - bot.targetY);
      if (distFromCurrent < 35) s -= 0.4;
      return s;
    };
    const sorted = [...effectivePool].sort((a, b) => scoreWaypoint(b) - scoreWaypoint(a));
    let next = sorted[0];
    let guard = 0;
    while (guard < 8 && next && Math.hypot(next.x - bot.targetX, next.y - bot.targetY) < 45) {
      next = sorted[guard + 1] ?? sorted[Math.floor(Math.random() * effectivePool.length)];
      guard++;
    }
    bot.targetX = next.x;
    bot.targetY = next.y;
    return;
  }

  const { blu } = getMapWaypoints(map);
  const list = blu.length >= 4 ? blu : NAV_BLU_FALLBACK;
  const midY = map.height / 2;
  const centers = (map as import("../map/mapTypes").MapData).zones?.some((z) => z.id === "site-a")
    ? getSiteCenters(map as import("../map/mapTypes").MapData)
    : null;
  let pool: { x: number; y: number }[];

  {
    const slot = parseInt(bot.id.split("-")[1] ?? "0", 10) % 5;
    const execSite = state.tsExecuteSite ?? "site-a";
    const ctSite = getCtSiteForBot(slot, state.bluStrategy, execSite, state.bombPlantSite);

    switch (state.bluStrategy) {
      case "aggressive":
        pool = filterNav(list, (p) => p.y >= midY - 50);
        break;
      case "hold":
      case "default":
        pool = filterNav(list, (p) => p.y <= midY + 20);
        if (centers) {
          const sc = centers[ctSite];
          const so = centers[ctSite === "site-a" ? "site-b" : "site-a"];
          pool = pool.filter((p) => Math.hypot(p.x - sc.x, p.y - sc.y) <= Math.hypot(p.x - so.x, p.y - so.y) + 60);
        }
        break;
      case "stack-a":
        pool = filterNav(list, (p) => p.y <= midY + 20);
        if (centers) {
          const sc = centers["site-a"];
          pool = pool.filter((p) => Math.hypot(p.x - sc.x, p.y - sc.y) < 220);
        }
        break;
      case "stack-b":
        pool = filterNav(list, (p) => p.y <= midY + 20);
        if (centers) {
          const sc = centers["site-b"];
          pool = pool.filter((p) => Math.hypot(p.x - sc.x, p.y - sc.y) < 220);
        }
        break;
      case "retake":
      case "rotate":
        pool = filterNav(list, (p) => p.y <= midY + 100);
        break;
      default:
        pool = list;
    }
  }

  const rolePool = getWaypointPoolForRole(
    pool,
    bot,
    isRed ? state.redStrategy : state.bluStrategy,
    isRed
  );
  const effectivePool = rolePool.length > 0 ? rolePool : pool;

  const bluSlot = parseInt(bot.id.split("-")[1] ?? "0", 10) % 5;
  const ctSite = getCtSiteForBot(bluSlot, state.bluStrategy, execSite, state.bombPlantSite);
  const scoreWaypoint = (p: { x: number; y: number }) => {
    let s = 0.5 + Math.random() * 0.5;
    if (centers) {
      const dExec = Math.hypot(p.x - centers[execSite].x, p.y - centers[execSite].y);
      const dOther = Math.hypot(p.x - centers[execSite === "site-a" ? "site-b" : "site-a"].x, p.y - centers[execSite === "site-a" ? "site-b" : "site-a"].y);
      if (isRed) {
        s += 80 / (dExec + 30);
      } else {
        const dCtSite = Math.hypot(p.x - centers[ctSite].x, p.y - centers[ctSite].y);
        s += 50 / (dCtSite + 40);
      }
    }
    const distFromCurrent = Math.hypot(p.x - bot.targetX, p.y - bot.targetY);
    if (distFromCurrent < 35) s -= 0.4;
    return s;
  };

  const sorted = [...effectivePool].sort((a, b) => scoreWaypoint(b) - scoreWaypoint(a));
  let next = sorted[0];
  let guard = 0;
  while (guard < 8 && next && Math.hypot(next.x - bot.targetX, next.y - bot.targetY) < 45) {
    next = sorted[guard + 1] ?? sorted[Math.floor(Math.random() * effectivePool.length)];
    guard++;
  }
  bot.targetX = next.x;
  bot.targetY = next.y;
};

const MOVE_SPEED = 4.5;
const ARRIVE_DIST = 48;
const BOMB_PICKUP_RADIUS = 48;

const isCtPostPlant = (bot: Bot, state: MatchState) =>
  Boolean(state.bombPlanted && state.bombPlantSite && bot.team === getCtTeamFromState(state) && bot.hp > 0);

const isTrPostPlant = (bot: Bot, state: MatchState) =>
  Boolean(state.bombPlanted && state.bombPlantSite && bot.team === getTrTeamFromState(state) && bot.hp > 0);

/** TR focado em plantar ou recuperar C4: portador, escolta ou indo buscar bomba — não trocar alvo ao chegar */
const isTrPlantPriority = (bot: Bot, state: MatchState) => {
  if (bot.team !== getTrTeamFromState(state) || bot.hp <= 0) return false;
  if (bot.hasBomb) return true;
  if (state.bombPlanted) return false;
  if (state.bombDroppedAt) return true;
  const carrier = state.bots.find((b) => b.team === getTrTeamFromState(state) && b.hasBomb && b.hp > 0);
  return !!carrier;
};

/** Destino = bomba (rush defuse) — precisa chegar dentro de DEFUSE_RADIUS */
const ctTargetIsBomb = (bot: Bot, state: MatchState): boolean => {
  const bomb = getPlantedBombWorldPos(state);
  if (!bomb) return false;
  return Math.hypot(bot.targetX - bomb.x, bot.targetY - bomb.y) < 10;
};

/** Destino = kit no chao (0b) */
const ctTargetIsKitDrop = (bot: Bot, state: MatchState): boolean => {
  const drops = state.defuseKitDrops;
  if (!drops || drops.length === 0 || bot.hasDefuseKit) return false;
  return drops.some((d) => Math.hypot(bot.targetX - d.x, bot.targetY - d.y) < 14);
};

const botTargetIsWeaponUpgradeDrop = (bot: Bot, state: MatchState): boolean => {
  const drops = state.weaponDrops;
  if (!drops?.length) return false;
  const myTier = weaponTierValue(bot.primaryWeapon);
  return drops.some(
    (d) =>
      weaponTierValue(d.primaryWeapon) > myTier &&
      Math.hypot(bot.targetX - d.x, bot.targetY - d.y) < 18
  );
};

/** Distancia "cheguei" ao waypoint: defuse exige entrar no raio da C4; pickup kit tambem */
const arriveDistForBot = (bot: Bot, state: MatchState): number => {
  if (isCtPostPlant(bot, state)) {
    /** Defuse: chegar bem dentro de DEFUSE_RADIUS (28px) para garantir que o CT inicie o defuse */
    if (ctTargetIsBomb(bot, state)) return Math.min(ARRIVE_DIST, DEFUSE_RADIUS - 10);
    if (ctTargetIsKitDrop(bot, state)) return Math.min(ARRIVE_DIST, DEFUSE_KIT_DROP_PICKUP_RADIUS - 6);
  }
  if (botTargetIsWeaponUpgradeDrop(bot, state)) return Math.min(ARRIVE_DIST, WEAPON_DROP_PICKUP_RADIUS - 6);
  return ARRIVE_DIST;
};

/** Fila circular: TR0, CT0, TR1, CT1, ..., TR4, CT4. Rotação por round: startIndex = (round - 1) % 10 */
const getBotBySlot = (bots: Bot[], team: TeamSide, slot: number): Bot | undefined =>
  bots.find((b) => b.team === team && (parseInt(b.id.split("-")[1] ?? "0", 10) % 5) === slot);

/**
 * Ordem por tick: fila circular TR1, CT1, TR2, CT2, ..., TR5, CT5.
 * A cada início de round a fila avança: o 2.º passa a ser 1.º.
 */
export const getDecisionOrder = (state: MatchState): Bot[] => {
  const trTeam = getTrTeamFromState(state);
  const ctTeam = getCtTeamFromState(state);
  const { bots } = state;

  const queue: Bot[] = [];
  for (let slot = 0; slot < 5; slot++) {
    const tr = getBotBySlot(bots, trTeam, slot);
    const ct = getBotBySlot(bots, ctTeam, slot);
    if (tr) queue.push(tr);
    if (ct) queue.push(ct);
  }

  const startIndex = (state.round - 1) % 10;
  if (startIndex === 0) return queue;
  return [...queue.slice(startIndex), ...queue.slice(0, startIndex)];
};

/** Fase de decisão: mira e movimento na ordem da fila circular. Retorna ordem para runCombat. */
const applyDecisions = (state: MatchState): Bot[] => {
  const order = getDecisionOrder(state);
  aimAtThreats(state, order);
  moveBots(state, order);
  return order;
};

const aimAtThreats = (state: MatchState, order: Bot[]) => {
  for (const bot of order) {
    if (bot.hp <= 0) continue;
    const enemies = state.bots.filter((b) => b.team !== bot.team && b.hp > 0);
    if (enemies.length === 0) continue;

    const view = buildPlayerView(bot, state);
    const targetAngle = computeDesiredAimAngle(bot, state, state.tickId, view);
    const visibleCount = view.enemiesInFov.length;
    const reactBoost =
      bot.lastDamageTick >= 0 &&
      state.tickId - bot.lastDamageTick < DAMAGE_MEMORY_TICKS &&
      visibleCount === 0;
    const step = getRotateStepForRole(bot);
    rotateTowards(bot, targetAngle, reactBoost ? step * 1.32 : step);
  }
};

const moveBots = (state: MatchState, order: Bot[]) => {
  for (const bot of order) {
    if (bot.hp <= 0) continue;

    const view = buildPlayerView(bot, state);
    applyPlayerDecision(bot, state, view);
    const arriveDist = arriveDistForBot(bot, state);
    syncNavToGoal(mapFor(state), bot, arriveDist);

    const tx = bot.navPath.length > 0 ? bot.navPath[0].x : bot.targetX;
    const ty = bot.navPath.length > 0 ? bot.navPath[0].y : bot.targetY;

    const dx = tx - bot.x;
    const dy = ty - bot.y;
    const dist = Math.hypot(dx, dy);
    if (dist < arriveDist) {
      /** Pos-plant: alvo vem do situacional — nao trocar por waypoint aleatorio */
      if (isCtPostPlant(bot, state) || isTrPostPlant(bot, state)) {
        syncNavToGoal(mapFor(state), bot, arriveDist);
        continue;
      }
      /** TR prioridade plant: portador ou escolta permanecem no alvo (site/formacao) */
      if (isTrPlantPriority(bot, state)) {
        syncNavToGoal(mapFor(state), bot, arriveDist);
        continue;
      }
      /** Chegou ao alvo: escolhe próximo */
      pickNewTarget(bot, state);
      syncNavToGoal(mapFor(state), bot, ARRIVE_DIST);
      continue;
    }

    const step = Math.min(MOVE_SPEED, dist);
    const mx = (dx / dist) * step;
    const my = (dy / dist) * step;
    const prevX = bot.x;
    const prevY = bot.y;
    const moved = tryMove(mapFor(state), bot.x, bot.y, mx, my);
    bot.x = moved.x;
    bot.y = moved.y;
    if (moved.x !== prevX || moved.y !== prevY) bot.lastMoveTick = state.tickId;

    if (moved.x === prevX && moved.y === prevY && dist > 5) {
      bot.navStuckTicks += 1;
      if (bot.navStuckTicks === 4) {
        if (bot.navPath.length > 1) bot.navPath.shift();
        else bot.navPath = findNavPath(mapFor(state), { x: bot.x, y: bot.y }, { x: bot.targetX, y: bot.targetY });
      }
      const stuckThreshold = (state.mapData?.walls?.length ?? 0) > 12 ? 10 : 14;
      if (bot.navStuckTicks >= stuckThreshold) {
        bot.navStuckTicks = 0;
        if (!isCtPostPlant(bot, state) && !isTrPostPlant(bot, state) && !isTrPlantPriority(bot, state)) {
          pickNewTarget(bot, state);
        }
        syncNavToGoal(mapFor(state), bot, arriveDistForBot(bot, state));
      }
    } else {
      bot.navStuckTicks = 0;
    }
  }
};

const pickupDefuseKit = (state: MatchState) => {
  if (!Array.isArray(state.defuseKitDrops)) state.defuseKitDrops = [];
  const drops = state.defuseKitDrops;
  if (drops.length === 0) return;
  const blusAlive = state.bots
    .filter((b) => b.team === "BLU" && b.hp > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (let i = drops.length - 1; i >= 0; i--) {
    const { x, y } = drops[i];
    for (const bot of blusAlive) {
      if (bot.hasDefuseKit) continue;
      if (Math.hypot(bot.x - x, bot.y - y) < DEFUSE_KIT_DROP_PICKUP_RADIUS) {
        bot.hasDefuseKit = true;
        drops.splice(i, 1);
        pushLog(state, `${bot.name} pegou o kit de desarme`);
        return;
      }
    }
  }
};

const pickupWeaponDrops = (state: MatchState) => {
  if (!Array.isArray(state.weaponDrops)) state.weaponDrops = [];
  const drops = state.weaponDrops;
  if (drops.length === 0) return;
  const alive = state.bots.filter((b) => b.hp > 0).sort((a, b) => a.id.localeCompare(b.id));
  for (const bot of alive) {
    const myTier = weaponTierValue(bot.primaryWeapon);
    let bestIdx = -1;
    let bestTier = -1;
    let bestDist = Infinity;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const t = weaponTierValue(d.primaryWeapon);
      if (t <= myTier) continue;
      const dist = Math.hypot(bot.x - d.x, bot.y - d.y);
      if (dist >= WEAPON_DROP_PICKUP_RADIUS) continue;
      if (t > bestTier || (t === bestTier && dist < bestDist)) {
        bestTier = t;
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) continue;
    const taken = drops[bestIdx]!;
    const oldWeapon = bot.primaryWeapon;
    bot.primaryWeapon = taken.primaryWeapon;
    drops.splice(bestIdx, 1);
    if (weaponTierValue(oldWeapon) > 0) {
      const h =
        (bot.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 360) * (Math.PI / 180);
      drops.push({
        id: `wd-swap-${state.tickId}-${bot.id}`,
        x: bot.x + Math.cos(h) * 10,
        y: bot.y + Math.sin(h) * 8,
        primaryWeapon: oldWeapon,
        angle: bot.angle
      });
    }
    pushLog(state, `${bot.name} recolheu ${taken.primaryWeapon} do chao`);
  }
};

const pickupBomb = (state: MatchState) => {
  if (state.bombPlanted) return;
  if (!state.bombDroppedAt) return;
  const { x, y } = state.bombDroppedAt;
  const trTeam = getTrTeamFromState(state);
  const trsAlive = state.bots
    .filter((b) => b.team === trTeam && b.hp > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const bot of trsAlive) {
    if (Math.hypot(bot.x - x, bot.y - y) < BOMB_PICKUP_RADIUS) {
      trsAlive.forEach((r) => {
        r.hasBomb = false;
      });
      bot.hasBomb = true;
      state.bombDroppedAt = null;
      pushLog(state, `${bot.name} pegou a C4`);
      return;
    }
  }
};

const runCombat = (state: MatchState, order: Bot[]) => {
  for (const attacker of order) {
    if (attacker.hp <= 0) continue;
    /** Plantando ou defusando: nao pode atirar (acao ja abortada em processBombPhase se houver inimigo) */
    const isPlanting =
      !state.bombPlanted &&
      attacker.team === getTrTeamFromState(state) &&
      attacker.hasBomb &&
      state.plantProgressMs > 0;
    const isDefusing = state.defuserId === attacker.id && state.defuseProgressMs > 0;
    if (isPlanting || isDefusing) continue;

    const view = buildPlayerView(attacker, state);
    const inSight = view.enemiesInFov.map((x) => x.bot);
    if (inSight.length === 0) continue;

    const cd = getFireCooldownTicksForRole(attacker);
    if (attacker.lastFireTick >= 0 && state.tickId - attacker.lastFireTick < cd) continue;

    const victim = pickCombatVictim(attacker, inSight, state);
    if (!victim) continue;

    const maxR = getWeaponRangeForRole(attacker);
    const distToVictim = Math.hypot(attacker.x - victim.x, attacker.y - victim.y);
    const rangePenalty =
      (distToVictim / maxR) * 0.11 * getRangePenaltyMultiplier(attacker);
    /** Peeker's advantage: quem se move em direção ao alvo ganha bônus pequeno de hit chance */
    const tx = attacker.navPath?.length ? attacker.navPath[0].x : attacker.targetX;
    const ty = attacker.navPath?.length ? attacker.navPath[0].y : attacker.targetY;
    const moveDx = tx - attacker.x;
    const moveDy = ty - attacker.y;
    const toVictimDx = victim.x - attacker.x;
    const toVictimDy = victim.y - attacker.y;
    const moveLen = Math.hypot(moveDx, moveDy);
    const toVictimLen = Math.hypot(toVictimDx, toVictimDy);
    const peekerBonus =
      moveLen > 2 && toVictimLen > 1
        ? Math.max(0, (moveDx * toVictimDx + moveDy * toVictimDy) / (moveLen * toVictimLen)) * 0.04
        : 0;
    const hitChance = clamp(
      0.5 +
        attacker.aim / 165 +
        getHitChanceBonusForRole(attacker) -
        rangePenalty -
        panicPenalty(attacker, state) +
        peekerBonus,
      0.39,
      0.945
    );
    attacker.lastFireTick = state.tickId;

    if (Math.random() > hitChance) continue;

    const kind = weaponKind(attacker.primaryWeapon);
    const base =
      kind === "sniper"
        ? SNIPER_FIXED_DAMAGE
        : BASE_DAMAGE_MIN + Math.random() * (BASE_DAMAGE_MAX - BASE_DAMAGE_MIN);
    let raw = Math.floor(base * getDamageMultiplierForRole(attacker));
    const isHeadshot = Math.random() < getHeadshotChanceForRole(attacker);
    if (isHeadshot) raw = Math.floor(raw * HEADSHOT_DAMAGE_MULTIPLIER);
    const dmg = damageAfterArmor(raw, victim.armor, isHeadshot, kind);
    attacker.damageDealt += dmg;
    victim.hp = clamp(victim.hp - dmg, 0, 100);
    victim.lastDamageTick = state.tickId;
    victim.lastDamageFromX = attacker.x;
    victim.lastDamageFromY = attacker.y;
    const contrib = victim.damageContributors ?? [];
    if (!contrib.includes(attacker.id)) {
      victim.damageContributors = [...contrib, attacker.id];
    }

    if (victim.id === state.defuserId) {
      state.defuseProgressMs = 0;
      state.defuserId = null;
    }

    if (victim.hp <= 0) {
      victim.deaths += 1;
      attacker.kills += 1;
      attacker.killsThisRound = (attacker.killsThisRound ?? 0) + 1;
      attacker.money = clamp(attacker.money + KILL_REWARD, 0, MAX_MONEY);
      for (const id of victim.damageContributors) {
        if (id === attacker.id) continue;
        const helper = state.bots.find((b) => b.id === id);
        if (helper && helper.team === attacker.team) {
          helper.assists += 1;
        }
      }
      pushLog(state, `[${timeLabel(state.timeLeftMs)}] ${attacker.name} eliminou ${victim.name}`);
      if (victim.hasBomb && victim.team === getTrTeamFromState(state)) {
        victim.hasBomb = false;
        state.bombDroppedAt = { x: victim.x, y: victim.y };
      }
      if (victim.team === getCtTeamFromState(state) && victim.hasDefuseKit) {
        victim.hasDefuseKit = false;
        if (!Array.isArray(state.defuseKitDrops)) state.defuseKitDrops = [];
        state.defuseKitDrops.push({ x: victim.x, y: victim.y });
        pushLog(state, `Kit de desarme largado (${victim.name})`);
      }
      if (weaponTierValue(victim.primaryWeapon) > 0) {
        if (!Array.isArray(state.weaponDrops)) state.weaponDrops = [];
        const slot = Number.parseInt(victim.id.replace(/\D+/g, "") || "0", 10);
        const ox = Math.cos(slot * 1.9 + victim.id.length * 0.31) * 14;
        const oy = Math.sin(slot * 1.9 + victim.id.length * 0.31) * 11;
        state.weaponDrops.push({
          id: `wd-${state.tickId}-${victim.id}`,
          x: victim.x + ox,
          y: victim.y + oy,
          primaryWeapon: victim.primaryWeapon,
          angle: victim.angle
        });
      }
    }
  }
};

const tickRoundEndBanner = (state: MatchState, deltaMs: number) => {
  if (state.roundEndBanner != null && state.roundEndBannerMs > 0) {
    state.roundEndBannerMs = Math.max(0, state.roundEndBannerMs - deltaMs);
    if (state.roundEndBannerMs <= 0) {
      state.roundEndBanner = null;
      applyPendingRoundAdvance(state);
    }
  }
};

const resolveRound = (state: MatchState, winner: TeamSide, cause: string) => {
  if (state.pendingRoundAdvance != null) return;

  state.score[winner] += 1;
  if (winner === "RED") {
    state.lossStreak.RED = 0;
    state.lossStreak.BLU = Math.min(state.lossStreak.BLU + 1, 5);
  } else {
    state.lossStreak.BLU = 0;
    state.lossStreak.RED = Math.min(state.lossStreak.RED + 1, 5);
  }

  applyMoraleAfterRound(state, winner);

  const isOvertime = state.round >= REGULATION_MAX_ROUNDS;
  const isCompetitiveOt = state.matchType === "tournament" && isOvertime;

  if (isCompetitiveOt) {
    state.otPeriodScore ??= { RED: 0, BLU: 0 };
    state.otPeriodScore[winner] += 1;
  }

  pushLog(state, `[${timeLabel(state.timeLeftMs)}] Round ${state.round}: ${winner} venceu (${cause})`);

  if (isCompetitiveOt) {
    if (state.otPeriodScore![winner] >= OT_POINTS_TO_WIN_PERIOD) {
      state.lastRoundResult = { roundNumber: state.round, winner, cause };
      state.matchWinner = winner;
      state.matchDraw = false;
      state.matchEndReason = cause;
      state.postMatchPauseMs = 5000;
      state.isRunning = false;
      state.pendingResumeAfterRound = false;
      state.pendingRoundAdvance = null;
      state.roundEndBanner = null;
      state.roundEndBannerMs = 0;
      pushLog(
        state,
        `FIM DE PARTIDA: ${winner} venceu ${state.score.RED} x ${state.score.BLU} (OT — ${OT_POINTS_TO_WIN_PERIOD} no período) — ${cause}`
      );
      return;
    }
    const otRoundsInPeriod =
      (state.round - REGULATION_MAX_ROUNDS) % OT_ROUNDS_PER_PERIOD;
    if (otRoundsInPeriod === 3) {
      const r = state.otPeriodScore!.RED;
      const b = state.otPeriodScore!.BLU;
      if (r === 2 && b === 2) {
        state.otPeriodScore = { RED: 0, BLU: 0 };
        pushLog(state, "OVERTIME: empate 2-2 no período — novo período de 4 rounds.");
      }
    }
  } else {
    const roundsToWin = isOvertime ? ROUNDS_TO_WIN_OT : ROUNDS_TO_WIN_MATCH;
    if (state.score[winner] >= roundsToWin) {
      state.lastRoundResult = { roundNumber: state.round, winner, cause };
      state.matchWinner = winner;
      state.matchDraw = false;
      state.matchEndReason = cause;
      state.postMatchPauseMs = 5000;
      state.isRunning = false;
      state.pendingResumeAfterRound = false;
      state.pendingRoundAdvance = null;
      state.roundEndBanner = null;
      state.roundEndBannerMs = 0;
      const otNote = isOvertime ? " (OT)" : "";
      pushLog(
        state,
        `FIM DE PARTIDA: ${winner} venceu ${state.score.RED} x ${state.score.BLU}${otNote} — ultimo round: ${cause}`
      );
      return;
    }

    if (state.round >= OT_MAX_ROUND && state.score.RED === state.score.BLU) {
      state.lastRoundResult = { roundNumber: state.round, winner, cause };
      state.matchWinner = null;
      state.matchDraw = true;
      state.matchEndReason = "empate-OT";
      state.postMatchPauseMs = 5000;
      state.isRunning = false;
      state.pendingResumeAfterRound = false;
      state.pendingRoundAdvance = null;
      state.roundEndBanner = null;
      state.roundEndBannerMs = 0;
      pushLog(
        state,
        `FIM DE PARTIDA: EMPATE ${state.score.RED} x ${state.score.BLU} (OT — 6 rounds)`
      );
      return;
    }
  }

  const finishedRound = state.round;
  state.lastRoundResult = { roundNumber: finishedRound, winner, cause };
  state.roundEndBanner = { roundNumber: finishedRound, winner, cause };
  state.roundEndBannerMs = 5000;
  state.pendingResumeAfterRound = state.isRunning;

  /** Bonus vitoria/derrota aplicado imediatamente quando o round acaba (banner "vitoria do time X") */
  for (const b of state.bots) {
    const won = b.team === winner;
    const lossIdx = won ? 0 : Math.max(0, state.lossStreak[b.team] - 1);
    const delta = won ? ROUND_WIN_BONUS : LOSS_BONUS_TIERS[Math.min(lossIdx, LOSS_BONUS_TIERS.length - 1)];
    b.money = clamp(b.money + delta, 0, MAX_MONEY);
  }

  /** Durante os 5s do banner os bots continuam a mover-se / plantar; o tempo do round fica congelado */
  state.pendingRoundAdvance = {
    winner,
    oldBotsSnapshot: snapshotBotsForAdvance(state.bots),
    hadBombPlantedAtResolve: state.bombPlanted
  };
};

const processBombPhase = (state: MatchState, deltaMs: number) => {
  const order = getDecisionOrder(state);

  if (state.bombPlanted && state.bombPlantSite) {
    const bombPos = getPlantedBombWorldPos(state)!;
    let defuser: Bot | null = null;
    /** Prioridade: quem já começou a defusar continua (se ainda em range e vivo) */
    if (state.defuserId && state.defuseProgressMs > 0) {
      const current = state.bots.find((b) => b.id === state.defuserId);
      if (
        current &&
        current.hp > 0 &&
        current.team === getCtTeamFromState(state) &&
        Math.hypot(current.x - bombPos.x, current.y - bombPos.y) < DEFUSE_RADIUS
      ) {
        defuser = current;
      }
    }
    if (!defuser) {
      for (const b of order) {
        if (
          b.team === getCtTeamFromState(state) &&
          b.hp > 0 &&
          Math.hypot(b.x - bombPos.x, b.y - bombPos.y) < DEFUSE_RADIUS
        ) {
          defuser = b;
          break;
        }
      }
    }
    if (defuser) {
      /** Defusando: se vir inimigo, para para atirar (nao pode atirar enquanto defusa) */
      const enemies = state.bots.filter((b) => b.team !== defuser!.team && b.hp > 0);
      const enemyInSight = enemies.some((e) =>
        canSeeWithFov(mapFor(state), defuser!, e, getWeaponFovForRole(defuser!), getWeaponRangeForRole(defuser!))
      );
      if (enemyInSight) {
        state.defuseProgressMs = 0;
        state.defuserId = null;
      } else if (state.defuserId && state.defuserId !== defuser.id) {
        state.defuseProgressMs = 0;
      } else {
        state.defuserId = defuser.id;
        const need = defuser.hasDefuseKit ? DEFUSE_KIT_MS : DEFUSE_NO_KIT_MS;
        const prevDefuseMs = state.defuseProgressMs;
        state.defuseProgressMs += deltaMs;
        defuser.lastFireTick = state.tickId;
        if (prevDefuseMs === 0 && state.defuseProgressMs > 0) {
          pushLog(
            state,
            `[${timeLabel(state.timeLeftMs)}] ${defuser.name} comecou a defusar — barulho audivel no site`
          );
        }
        if (state.defuseProgressMs >= need) {
          const ctTeam = getCtTeamFromState(state);
          for (const b of state.bots) {
            if (b.team === ctTeam) {
              b.money = clamp(b.money + DEFUSE_BONUS, 0, MAX_MONEY);
            }
          }
          resolveRound(state, ctTeam, "defuse da C4");
          return;
        }
      }
    } else {
      state.defuseProgressMs = 0;
      state.defuserId = null;
    }

    state.postPlantTimeLeftMs = Math.max(0, state.postPlantTimeLeftMs - deltaMs);
    if (state.postPlantTimeLeftMs <= 0) {
      resolveRound(state, getTrTeamFromState(state), "explosao da C4");
    }
    return;
  }

  const trTeam = getTrTeamFromState(state);
  const carrier = state.bots.find((b) => b.team === trTeam && b.hp > 0 && b.hasBomb);
  const trPlantSite = getTrMovementExecuteSite(state);
  if (carrier && botInSite(mapFor(state), carrier, trPlantSite)) {
    /** Plantando: se vir inimigo, para para atirar (nao pode atirar enquanto planta) */
    const enemies = state.bots.filter((b) => b.team !== carrier.team && b.hp > 0);
    const enemyInSight = enemies.some((e) =>
      canSeeWithFov(mapFor(state), carrier, e, getWeaponFovForRole(carrier), getWeaponRangeForRole(carrier))
    );
    if (!enemyInSight) {
      state.plantProgressMs += deltaMs;
    if (state.plantProgressMs >= PLANT_TIME_MS) {
      state.bombPlanted = true;
      state.bombPlantSite = trPlantSite;
      state.bombPlantWorldPos = { x: carrier.x, y: carrier.y };
      state.postPlantTimeLeftMs = POST_PLANT_EXPLODE_MS;
      carrier.hasBomb = false;
      state.plantProgressMs = 0;
      state.bombDroppedAt = null;
      state.defuseProgressMs = 0;
      state.defuserId = null;
      for (const b of state.bots) {
        if (b.team === trTeam) {
          b.money = clamp(b.money + PLANT_BONUS, 0, MAX_MONEY);
        }
      }
      pushLog(
        state,
        `[${timeLabel(state.timeLeftMs)}] ${carrier.name} plantou a C4 no site ${trPlantSite === "site-a" ? "A" : "B"}`
      );
      const ctTeam = getCtTeamFromState(state);
      state.bluStrategy = chooseBluStrategyForRound(
        state,
        state.bots.filter((b) => b.team === ctTeam)
      );
    }
    } else {
      state.plantProgressMs = 0;
    }
  } else {
    state.plantProgressMs = 0;
  }
};

export const matchReducer = (prev: MatchState, event: MatchEvent): MatchState => {
  if (event.type === "RESET") return createMatchState(prev, { fullReset: true });
  if (event.type === "START") {
    if (prev.matchWinner != null || prev.matchDraw) return prev;
    /** Durante intermissao: aplica proximo round ja e retoma simulacao */
    if (prev.roundEndBanner != null && prev.roundEndBannerMs > 0 && prev.pendingRoundAdvance != null) {
      const state: MatchState = {
        ...prev,
        roundEndBanner: null,
        roundEndBannerMs: 0,
        logs: [...prev.logs],
        score: { ...prev.score },
        pendingResumeAfterRound: true
      };
      applyPendingRoundAdvance(state);
      return state;
    }
    return { ...prev, isRunning: true };
  }
  if (event.type === "PAUSE") {
    return { ...prev, isRunning: false, pendingResumeAfterRound: false };
  }

  if (event.type === "FINISH_ROUND") {
    if (prev.matchWinner != null || prev.matchDraw || prev.pendingRoundAdvance != null) return prev;
    const state: MatchState = {
      ...prev,
      score: { ...prev.score },
      lossStreak: { ...prev.lossStreak },
      morale: prev.morale ? { ...prev.morale } : { RED: 100, BLU: 100 },
      logs: [...prev.logs]
    };
    const winner =
      prev.bombPlanted && prev.bombPlantSite
        ? getTrTeamFromState(prev)
        : getCtTeamFromState(prev);
    const cause =
      prev.bombPlanted && prev.bombPlantSite ? "C4 plantada (manual)" : "finalizado manualmente";
    resolveRound(state, winner, cause);
    return state;
  }

  if (event.type === "TICK") {
    if ((prev.matchWinner != null || prev.matchDraw) && prev.postMatchPauseMs > 0) {
      return {
        ...prev,
        postMatchPauseMs: Math.max(0, prev.postMatchPauseMs - event.deltaMs)
      };
    }
    /** Pausa de intermissao: simulacao parada, banner conta 5s */
    if (!prev.isRunning && prev.roundEndBanner != null && prev.roundEndBannerMs > 0) {
      const nextMs = Math.max(0, prev.roundEndBannerMs - event.deltaMs);
      const ended = nextMs <= 0;
      if (ended && prev.pendingRoundAdvance != null) {
        const state: MatchState = {
          ...prev,
          roundEndBannerMs: 0,
          roundEndBanner: null,
          logs: [...prev.logs],
          score: { ...prev.score },
          morale: prev.morale ? { ...prev.morale } : { RED: 100, BLU: 100 }
        };
        applyPendingRoundAdvance(state);
        return state;
      }
      return {
        ...prev,
        roundEndBannerMs: nextMs,
        roundEndBanner: prev.roundEndBanner
      };
    }
    if (!prev.isRunning) return prev;
  } else {
    return prev;
  }

  const state: MatchState = {
    ...prev,
    tickId: (prev.tickId ?? 0) + 1,
    bots: prev.bots.map((b) => ({
      ...b,
      navPath: (b.navPath ?? []).map((p) => ({ ...p }))
    })),
    score: { ...prev.score },
    lossStreak: { ...prev.lossStreak },
    morale: prev.morale ? { ...prev.morale } : { RED: 100, BLU: 100 },
    logs: [...prev.logs],
    bombDroppedAt: prev.bombDroppedAt ?? null,
    defuseKitDrops: [...(prev.defuseKitDrops ?? [])],
    weaponDrops: [...(prev.weaponDrops ?? [])],
    tsExecuteSite: prev.tsExecuteSite,
    bombPlanted: prev.bombPlanted,
    bombPlantSite: prev.bombPlantSite,
    bombPlantWorldPos: prev.bombPlantWorldPos,
    postPlantTimeLeftMs: prev.postPlantTimeLeftMs,
    plantProgressMs: prev.plantProgressMs,
    defuseProgressMs: prev.defuseProgressMs,
    defuserId: prev.defuserId,
    matchWinner: prev.matchWinner,
    matchDraw: prev.matchDraw,
    postMatchPauseMs: prev.postMatchPauseMs,
    matchEndReason: prev.matchEndReason,
    roundEndBanner: prev.roundEndBanner,
    roundEndBannerMs: prev.roundEndBannerMs,
    lastRoundResult: prev.lastRoundResult,
    pendingResumeAfterRound: prev.pendingResumeAfterRound,
    pendingRoundAdvance: prev.pendingRoundAdvance
  };

  const roundBefore = state.round;

  const inEndOfRoundSandbox =
    state.pendingRoundAdvance != null && state.roundEndBannerMs > 0;
  if (!inEndOfRoundSandbox) {
    state.timeLeftMs = Math.max(0, state.timeLeftMs - event.deltaMs);
  }

  const decisionOrder = applyDecisions(state);
  pickupBomb(state);
  pickupDefuseKit(state);
  pickupWeaponDrops(state);
  processBombPhase(state, event.deltaMs);
  if (state.round !== roundBefore) {
    tickRoundEndBanner(state, event.deltaMs);
    return state;
  }

  runCombat(state, decisionOrder);
  if (state.round !== roundBefore) {
    tickRoundEndBanner(state, event.deltaMs);
    return state;
  }

  const redsAlive = state.bots.filter((b) => b.team === "RED" && b.hp > 0).length;
  const blusAlive = state.bots.filter((b) => b.team === "BLU" && b.hp > 0).length;
  const redAlive = redsAlive > 0;
  const bluAlive = blusAlive > 0;
  const ctTeam = getCtTeamFromState(state);
  const trTeam = getTrTeamFromState(state);
  const ctsAlive = state.bots.filter((b) => b.team === ctTeam && b.hp > 0).length;

  if (!inEndOfRoundSandbox) {
    if (!state.bombPlanted) {
      if (!redAlive) {
        const cause = trTeam === "RED" ? "eliminacao TR" : "eliminacao CT";
        resolveRound(state, "BLU", cause);
      } else if (!bluAlive) {
        const cause = trTeam === "BLU" ? "eliminacao TR" : "eliminacao CT";
        resolveRound(state, "RED", cause);
      }
      else if (state.timeLeftMs <= 0) resolveRound(state, ctTeam, "tempo (CT)");
    } else {
      /** C4 plantada: se todos os CTs morrerem, TRs ganham (nao ha quem defuse) */
      if (ctsAlive === 0) resolveRound(state, trTeam, "eliminacao dos CTs");
    }
  }

  tickRoundEndBanner(state, event.deltaMs);

  return state;
};
