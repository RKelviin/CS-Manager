/**
 * Decisao situacional: prioridades de mira, intencao de movimento e escolha de alvo no combate.
 */
import { botInSite, lineIntersectsWall } from "../map/dust2Map";
import { getSiteCenters, type MapData } from "../map/mapTypes";
import { WEAPON_FOV, WEAPON_RANGE } from "./combatConstants";
import { getWeaponFovForRole, getWeaponRangeForRole, threatToCarrierScore } from "./roleCombat";
import {
  CT_ECO_TEAM_AVG_THRESHOLD,
  CT_SAVE_BOT_MONEY_CAP,
  POST_PLANT_ADVANTAGE_RETAKE_MS,
  POST_PLANT_FORCE_RETAKE_MS,
  TEAM_ECO_AVG_THRESHOLD
} from "./economyConstants";
import { POST_PLANT_EXPLODE_MS } from "./bombConstants";
import { FIRST_ROUND_SECOND_HALF, getCtTeamFromState, getTrTeamFromState } from "./matchConstants";
import { shouldSaveEquipment } from "./roundBuy";
import { weaponKind, weaponTierValue } from "../ui/weaponIcons";
import { getMapChokePoints } from "../map/mapWaypoints";
import { getCtHoldPosition, getCtHoldPatrolPositions, TR_FORMATION_OFFSETS } from "./tacticalPositions";
import { getCtSiteForBot, isCtDefendStrategy } from "./ctStrategy";
import type { Bot, MatchState, TeamSide } from "../types";
import type { PlayerView } from "./playerView";

export const DAMAGE_MEMORY_TICKS = 18;
/** Tiros recentes = "barulho" ouvido (ticks) */
export const SOUND_MEMORY_TICKS = 38;
/** Distancia maxima para inferir direcao do barulho (tiros) */
export const HEAR_SHOT_RANGE = 400;
/** Passos recentes — memoria menor que tiros */
export const FOOTSTEP_MEMORY_TICKS = 22;
/** Distancia maxima para ouvir passos (menor que tiros) */
export const HEAR_FOOTSTEP_RANGE = 200;
const MAP_MARGIN = 14;
const TR_ROUND_MS = 115000;

/**
 * Fake: se TR já domina um bombsite (sem CT na zona e força mínima), planta/movimento nesse site
 * em vez de seguir para o outro.
 */
function getTrDominatedBombsite(state: MatchState): "site-a" | "site-b" | null {
  if (state.redStrategy !== "fake" || state.bombPlanted) return null;
  const map = state.mapData;
  const trSide = getTrTeamFromState(state);
  const ctSide = getCtTeamFromState(state);
  const siteCounts = (site: "site-a" | "site-b") => {
    let tr = 0;
    let ct = 0;
    for (const b of state.bots) {
      if (b.hp <= 0 || !botInSite(map, b, site)) continue;
      if (b.team === trSide) tr++;
      else if (b.team === ctSide) ct++;
    }
    return { tr, ct };
  };
  const dominates = (site: "site-a" | "site-b") => {
    const { tr, ct } = siteCounts(site);
    if (ct > 0) return false;
    const carrier = state.bots.find((b) => b.team === trSide && b.hasBomb && b.hp > 0);
    const carrierIn = Boolean(carrier && botInSite(map, carrier, site));
    return tr >= 2 || (tr >= 1 && carrierIn);
  };
  const aOk = dominates("site-a");
  const bOk = dominates("site-b");
  if (!aOk && !bOk) return null;
  const carrier = state.bots.find((b) => b.team === trSide && b.hasBomb && b.hp > 0);
  if (carrier) {
    if (aOk && botInSite(map, carrier, "site-a")) return "site-a";
    if (bOk && botInSite(map, carrier, "site-b")) return "site-b";
  }
  const real = state.tsExecuteSite ?? "site-a";
  const feint = real === "site-a" ? "site-b" : "site-a";
  if (dominates(feint)) return feint;
  if (dominates(real)) return real;
  return aOk ? "site-a" : "site-b";
}

/** Site alvo de movimento TR (fake: finta no começo; se dominar um site, commit para plantar nele). */
export const getTrMovementExecuteSite = (state: MatchState): "site-a" | "site-b" => {
  const real = state.tsExecuteSite ?? "site-a";
  if (state.redStrategy === "fake" && !state.bombPlanted) {
    const dominated = getTrDominatedBombsite(state);
    if (dominated != null) return dominated;
    if (state.timeLeftMs > TR_ROUND_MS * 0.6) return real === "site-a" ? "site-b" : "site-a";
  }
  return real;
};
/** Alcance para validar LOS ate um ponto de mira tatica (maior que arma — so angulo) */
const TACTICAL_LOOK_RANGE = 780;

const RETREAT_HP = 34;
/** Exportado para awareness (danger spots) em playerView */
export const THREAT_RADIUS = 155;
const ALLY_HELP_RADIUS = 220;

/** Posicao da C4 plantada (ou fallback ao centro do site) */
export const getPlantedBombWorldPos = (state: MatchState): { x: number; y: number } | null => {
  if (!state.bombPlanted || !state.bombPlantSite) return null;
  const centers = getSiteCenters(state.mapData);
  return state.bombPlantWorldPos ?? centers[state.bombPlantSite];
};

const normalizeAngle = (a: number) => {
  let x = a;
  while (x < -Math.PI) x += Math.PI * 2;
  while (x > Math.PI) x -= Math.PI * 2;
  return x;
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const clampToMap = (map: { width: number; height: number }, x: number, y: number) => ({
  x: Math.min(map.width - MAP_MARGIN, Math.max(MAP_MARGIN, x)),
  y: Math.min(map.height - MAP_MARGIN, Math.max(MAP_MARGIN, y))
});

/**
 * Inimigos com tiros recentes audiveis (sem LOS) — mesmo criterio para mira e movimento.
 */
export const heardGunfireEnemies = (bot: Bot, state: MatchState, tickId: number): Bot[] => {
  const rng = getWeaponRangeForRole(bot);
  return enemiesOf(state, bot).filter(
    (e) =>
      e.hp > 0 &&
      e.lastFireTick >= 0 &&
      tickId - e.lastFireTick < SOUND_MEMORY_TICKS &&
      dist(bot, e) <= HEAR_SHOT_RANGE &&
      !hasLineOfSight(state.mapData, bot, e, rng)
  );
};

/** Prioriza tiro mais recente, depois inimigo mais proximo */
export const pickPrimaryHeardEnemy = (bot: Bot, heard: Bot[], tickId: number): Bot | null => {
  if (heard.length === 0) return null;
  return [...heard].sort((a, b) => {
    const ra = tickId - a.lastFireTick;
    const rb = tickId - b.lastFireTick;
    if (ra !== rb) return ra - rb;
    return dist(bot, a) - dist(bot, b);
  })[0];
};

/** Inimigos que se moveram recentemente (passos audiveis, sem LOS) */
export const heardFootstepEnemies = (bot: Bot, state: MatchState, tickId: number): Bot[] => {
  const rng = getWeaponRangeForRole(bot);
  return enemiesOf(state, bot).filter(
    (e) =>
      e.hp > 0 &&
      e.lastMoveTick >= 0 &&
      tickId - e.lastMoveTick < FOOTSTEP_MEMORY_TICKS &&
      dist(bot, e) <= HEAR_FOOTSTEP_RANGE &&
      !hasLineOfSight(state.mapData, bot, e, rng)
  );
};

/** Destino ao ouvir passos: aproximar com cautela (menos agressivo que tiros) */
const computeFootstepMovementTarget = (
  bot: Bot,
  state: MatchState,
  tickId: number
): { x: number; y: number } | null => {
  const heard = heardFootstepEnemies(bot, state, tickId);
  if (heard.length === 0) return null;
  const primary = [...heard].sort(
    (a, b) =>
      (tickId - a.lastMoveTick) - (tickId - b.lastMoveTick) || dist(bot, a) - dist(bot, b)
  )[0];
  const towardT = 0.18;
  const gx = bot.x + (primary.x - bot.x) * towardT;
  const gy = bot.y + (primary.y - bot.y) * towardT;
  return clampToMap(state.mapData, gx, gy);
};

/**
 * Destino ao ouvir tiros: aproximar (T / CT agressivo) ou contestar com ancora (hold) / plant (retake).
 * Nao substitui pos-plant, C4, escolta — so e aplicado depois dessas regras em applySituationalMovement.
 */
export const computeGunfireMovementTarget = (
  bot: Bot,
  state: MatchState,
  tickId: number,
  view?: PlayerView
): { x: number; y: number } | null => {
  if (shouldSaveEquipment(bot, state)) return null;
  const primary = view
    ? view.heardEnemies
        .map((x) => x.bot)
        .sort(
          (a, b) =>
            tickId - a.lastFireTick - (tickId - b.lastFireTick) || dist(bot, a) - dist(bot, b)
        )[0]
    : pickPrimaryHeardEnemy(bot, heardGunfireEnemies(bot, state, tickId), tickId);
  if (!primary) return null;

  let towardT = 0.34;
  if (bot.role === "IGL") towardT += 0.1;
  /** AWP: manter distância, buscar ângulos longos para frags em vez de rushar ao barulho */
  if (bot.role === "AWP") towardT -= 0.2;
  if (bot.role === "Rifler") towardT += 0.05;
  /** displayRole: Entry mais agressivo; Lurker/Support介于 */
  if (bot.displayRole === "Entry") towardT += 0.12;
  else if (bot.displayRole === "Support") towardT += 0.04;
  towardT = Math.max(0.08, Math.min(0.58, towardT));

  const applyLurkerFlank = (gx: number, gy: number) => {
    if (bot.displayRole !== "Lurker") return clampToMap(state.mapData, gx, gy);
    const dx = primary.x - bot.x;
    const dy = primary.y - bot.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;
    const flank = 48;
    const side = bot.id.charCodeAt(bot.id.length - 1) % 2 === 0 ? 1 : -1;
    return clampToMap(state.mapData, gx + perpX * flank * side, gy + perpY * flank * side);
  };

  if (bot.team === getTrTeamFromState(state)) {
    towardT += 0.06;
    const site = getSiteCenters(state.mapData)[getTrMovementExecuteSite(state)];
    /** TR: ao ouvir tiros, avancar em direcao ao site (dominar bombsite) mesmo ao rotacionar */
    const execBlend = bot.role === "IGL" ? 0.22 : 0.16;
    const rawX = bot.x + (primary.x - bot.x) * towardT;
    const rawY = bot.y + (primary.y - bot.y) * towardT;
    const gx = rawX * (1 - execBlend) + site.x * execBlend;
    const gy = rawY * (1 - execBlend) + site.y * execBlend;
    return applyLurkerFlank(gx, gy);
  }

  const slot = botSlotIndex(bot);
  const anchorSite = getSiteCenters(state.mapData)[
    getCtSiteForBot(slot, state.bluStrategy, state.tsExecuteSite ?? "site-a", state.bombPlantSite)
  ];

  if ((state.bluStrategy === "retake" || state.bluStrategy === "rotate") && state.bombPlantSite) {
    const plantP = getPlantedBombWorldPos(state)!;
    /** AWP em retake: não rushar — manter distância para pegar frags nos ângulos */
    const t = bot.role === "AWP" ? Math.min(0.28, towardT) : Math.min(0.52, towardT + 0.04);
    const rawX = bot.x + (primary.x - bot.x) * t;
    const rawY = bot.y + (primary.y - bot.y) * t;
    const gx = rawX * 0.55 + plantP.x * 0.45;
    const gy = rawY * 0.55 + plantP.y * 0.45;
    return applyLurkerFlank(gx, gy);
  }

  if (isCtDefendStrategy(state.bluStrategy)) {
    /** AWP em hold: manter mais distância, segurar ângulo */
    const t = bot.role === "AWP" ? Math.max(0.08, towardT - 0.22) : Math.max(0.12, towardT - 0.1);
    const rawX = bot.x + (primary.x - bot.x) * t;
    const rawY = bot.y + (primary.y - bot.y) * t;
    const gx = rawX * 0.72 + anchorSite.x * 0.28;
    const gy = rawY * 0.72 + anchorSite.y * 0.28;
    return applyLurkerFlank(gx, gy);
  }

  if (state.bluStrategy === "aggressive") {
    const t = towardT + 0.08;
    const rawX = bot.x + (primary.x - bot.x) * Math.min(0.58, t);
    const rawY = bot.y + (primary.y - bot.y) * Math.min(0.58, t);
    return applyLurkerFlank(rawX, rawY);
  }

  const blend = 0.22;
  const ax = bot.x + (primary.x - bot.x) * towardT;
  const ay = bot.y + (primary.y - bot.y) * towardT;
  const gx = ax * (1 - blend) + anchorSite.x * blend;
  const gy = ay * (1 - blend) + anchorSite.y * blend;
  return applyLurkerFlank(gx, gy);
};

/** Prioriza alvo mais fragil, depois mais proximo */
const sortByFinishPriority = (attacker: Bot, list: Bot[]) =>
  [...list].sort((a, b) => a.hp - b.hp || dist(attacker, a) - dist(attacker, b));

/** Tem AWP vivo no time (para coordenar alvos: Rifler pega perto, AWP pega longe) */
const hasAwpAlive = (state: MatchState, team: TeamSide) =>
  state.bots.some((b) => b.team === team && b.hp > 0 && b.role === "AWP");

/** LOS sem checar FOV (para pre-mirar e reacao a dano) */
export const hasLineOfSight = (
  map: MapData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  maxRange: number
) => {
  const d = dist(from, to);
  if (d > maxRange) return false;
  return !lineIntersectsWall(map, from, to);
};

export const canSeeWithFov = (
  map: MapData,
  attacker: Bot,
  target: Bot,
  fov: number,
  maxRange: number = WEAPON_RANGE
) => {
  if (target.hp <= 0) return false;
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const d = Math.hypot(dx, dy);
  if (d > maxRange) return false;
  if (lineIntersectsWall(map, { x: attacker.x, y: attacker.y }, { x: target.x, y: target.y })) return false;
  const angleTo = Math.atan2(dy, dx);
  const diff = normalizeAngle(angleTo - attacker.angle);
  return Math.abs(diff) < fov / 2;
};

const aliveOnSide = (state: MatchState, side: TeamSide) =>
  state.bots.filter((b) => b.team === side && b.hp > 0);

const enemiesOf = (state: MatchState, bot: Bot) => state.bots.filter((b) => b.team !== bot.team && b.hp > 0);

/** Inimigo mais proximo dentro do raio */
const closestThreatInRadius = (bot: Bot, state: MatchState, radius: number) => {
  const enemies = enemiesOf(state, bot);
  let best: Bot | null = null;
  let bestD = radius;
  for (const e of enemies) {
    const d = dist(bot, e);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
};

const botSlotIndex = (bot: Bot) => {
  const part = bot.id.split("-")[1];
  const n = part ? parseInt(part, 10) : 0;
  return Number.isFinite(n) ? n % 5 : 0;
};

/** Pontos de interesse default (Dust2-like) */
const defaultChokes = () => ({
  midLong: { x: 400, y: 320 },
  midShort: { x: 400, y: 260 },
  lowerCross: { x: 400, y: 420 },
  ctChoke: { x: 400, y: 140 },
  tApproach: { x: 400, y: 460 }
});

/** Pos-plant CT (nao eco): defuse direto ou rotacao mid/flanco para caçar TRs */
type CtPostPlantMode = "defuse" | "hunt";

const ctPostPlantMode = (
  bot: Bot,
  state: MatchState,
  urgent: boolean,
  ctAlive: number,
  trAlive: number
): CtPostPlantMode => {
  if (urgent) return "defuse";
  /** Todos os TRs mortos: nao ha quem cacar, sempre defuse */
  if (trAlive === 0) return "defuse";

  const slot = botSlotIndex(bot);
  const strat = state.bluStrategy;

  const tLeft = state.postPlantTimeLeftMs;
  const timeRatio = tLeft > 0 ? tLeft / POST_PLANT_EXPLODE_MS : 0.5;

  /** Menos de ~16s: ir defusar (defuse leva 5-10s, chegar pode levar alguns segundos) */
  if (timeRatio <= 0.4) return "defuse";

  if (bot.role === "IGL") return "defuse";

  if (bot.role === "AWP") return "hunt";

  /** displayRole: Support defuse/closer ao site; Lurker hunt/flanco */
  if (bot.displayRole === "Support") return "defuse";
  if (bot.displayRole === "Lurker") return "hunt";

  /** TRs em vantagem: mais CTs vao defuse (menos hunt) */
  const trsAdvantage = trAlive >= ctAlive + 1;

  if (strat === "aggressive") {
    if (slot % 2 === 0) return "hunt";
    return slot <= 1 ? "defuse" : "hunt";
  }
  if (strat === "hold" || strat === "default" || strat === "stack-a" || strat === "stack-b") {
    if (slot === 0 || slot === 1) return "defuse";
    return "hunt";
  }
  if (strat === "retake" || strat === "rotate") {
    if (trsAdvantage) return slot % 3 === 0 ? "hunt" : "defuse";
    return slot % 3 === 0 ? "hunt" : "defuse";
  }

  if (trsAdvantage) return slot % 3 === 0 ? "hunt" : "defuse";
  return slot % 2 === 0 ? "hunt" : "defuse";
};

/** Limite de tempo (ms restantes) para considerar retake urgente — dinamico: CTs em vantagem avancam mais cedo */
const getPostPlantUrgentThresholdMs = (ctAlive: number, trAlive: number, hasFullBuy: boolean): number => {
  if (ctAlive >= trAlive + 2) return POST_PLANT_ADVANTAGE_RETAKE_MS;
  if (ctAlive >= trAlive + 1 || (ctAlive >= trAlive && hasFullBuy)) return 26000;
  return POST_PLANT_FORCE_RETAKE_MS;
};

/**
 * Aproximação por mid + offset lateral ao corredor spawn→bomba.
 * Órbita ampla e patrulha por ciclo de ticks para CTs não ficarem parados.
 */
const ctPostPlantHuntTarget = (bot: Bot, state: MatchState): { x: number; y: number } => {
  const bomb = getPlantedBombWorldPos(state)!;
  const slot = botSlotIndex(bot);
  const spawnBlu = { x: 400, y: 72 };
  const vx = bomb.x - spawnBlu.x;
  const vy = bomb.y - spawnBlu.y;
  const len = Math.hypot(vx, vy) || 1;
  const px = -vy / len;
  const py = vx / len;
  let lateral = (slot - 2) * 44 + (slot % 2) * 20;
  /** AWP: posição mais recuada para segurar ângulo longo e buscar frags a distância */
  const isAwp = bot.role === "AWP";
  let along = isAwp ? 0.65 + slot * 0.02 : 0.38 + (slot % 3) * 0.07;
  /** displayRole: Support mais perto do site; Lurker mais em flanco (offset lateral maior) */
  if (bot.displayRole === "Support") {
    along = Math.min(along, 0.32);
    lateral *= 0.6;
  } else if (bot.displayRole === "Lurker") {
    lateral *= 1.4;
  }
  const midShort = (state.mapData.zones?.some((z) => z.id === "site-a") ? getMapChokePoints(state.mapData).mid : defaultChokes().midShort);
  let bx = bomb.x * (1 - along) + midShort.x * along + px * (isAwp ? lateral * 0.7 : lateral);
  let by = bomb.y * (1 - along) + midShort.y * along + py * (isAwp ? lateral * 0.7 : lateral);
  /** Órbita ampla: CTs patrulham em vez de ficar parados — ciclo ~4s para riflers */
  const tick = state.tickId ?? 0;
  const phase = tick * 0.21 + slot * 0.82;
  const orbit = isAwp ? 18 : 56;
  bx += Math.cos(phase) * orbit;
  by += Math.sin(phase) * (isAwp ? 14 : 44);
  /** Patrulha secundária: alterna offset ao longo do corredor a cada ~3s */
  const patrolPhase = Math.floor(tick / 30) % 3;
  const alongShift = (patrolPhase - 1) * 0.08;
  bx += vx / len * alongShift * 85;
  by += vy / len * alongShift * 85;
  return clampToMap(state.mapData, bx, by);
};

const angleDiff = (a: number, b: number) => Math.abs(normalizeAngle(a - b));

/**
 * Pontos candidatos para onde mirar quando nao ha alvo visivel — prioriza areas importantes (sites, chokes).
 */
const tacticalLookPoints = (bot: Bot, state: MatchState): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = [];
  const add = (p: { x: number; y: number }) => pts.push(p);

  const map = state.mapData;
  if (map.tacticalSpots?.length) {
    for (const s of map.tacticalSpots) {
      if (dist(bot, s) > TACTICAL_LOOK_RANGE) continue;
      if (!hasLineOfSight(state.mapData, bot, { x: s.x, y: s.y }, TACTICAL_LOOK_RANGE)) continue;
      add({ x: s.x, y: s.y });
    }
  }
  const def = defaultChokes();
  const chokes = map.zones?.some((z) => z.id === "site-a") ? getMapChokePoints(map) : null;

  if (chokes) {
    add(chokes.siteA);
    add(chokes.siteB);
    add(chokes.mid);
    add(chokes.chokeA);
    add(chokes.chokeB);
    if (bot.team === "RED") {
      add(chokes.tToA);
      add(chokes.tToB);
    }
  } else {
    add(def.midLong);
    add(def.midShort);
    add(def.lowerCross);
    add(def.ctChoke);
    add(def.tApproach);
  }

  const centers = getSiteCenters(map);
  add(centers["site-a"]);
  add(centers["site-b"]);

  const spawnBlu = chokes ? { x: map.width / 2, y: 72 } : { x: 400, y: 72 };

  if (state.bombPlanted && state.bombPlantSite) {
    const bomb = getPlantedBombWorldPos(state)!;
    add(bomb);
    if (bot.team === "RED") {
      add(CT_RETAKE_HINT);
      add(chokes?.mid ?? def.midLong);
      add(chokes?.chokeA ?? def.midShort);
      add({ x: (bomb.x + CT_RETAKE_HINT.x) / 2, y: (bomb.y + CT_RETAKE_HINT.y) / 2 });
      add({ x: bomb.x + (T_SAFE_ANCHOR.x - bomb.x) * 0.45, y: bomb.y + (T_SAFE_ANCHOR.y - bomb.y) * 0.45 });
    } else {
      add({ x: bomb.x, y: bomb.y + 120 });
      add(spawnBlu);
      add(chokes?.chokeA ?? def.midShort);
      add(chokes?.chokeB ?? def.midLong);
    }
  } else {
    add(centers[state.tsExecuteSite ?? "site-a"]);
    if (bot.team === "RED") {
      add(chokes?.chokeA ?? def.ctChoke);
      add({ x: centers[state.tsExecuteSite ?? "site-a"].x, y: centers[state.tsExecuteSite ?? "site-a"].y + 90 });
    } else {
      add(chokes?.mid ?? def.midShort);
      add(chokes?.chokeB ?? def.lowerCross);
      add(spawnBlu);
    }
  }

  if (state.bombDroppedAt) add(state.bombDroppedAt);
  if (state.defuseKitDrops?.length) for (const d of state.defuseKitDrops) add(d);
  if (state.weaponDrops?.length) for (const d of state.weaponDrops) add(d);
  if (bot.navPath.length > 0) add(bot.navPath[0]);
  add({ x: bot.targetX, y: bot.targetY });

  const seen = new Set<string>();
  return pts.filter((p) => {
    const k = `${Math.round(p.x / 8)}_${Math.round(p.y / 8)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Escolhe angulo de mira "seguro": so direcoes com LOS ate um ponto tatico (nunca mira cega no modelo do inimigo atras de parede).
 * `preferredAngle`: ex. direcao do barulho ou do dano — escolhe o ponto tatico mais alinhado.
 */
const pickNearestTacticalAimAngle = (bot: Bot, state: MatchState, tickId: number, preferredAngle: number | null) => {
  const points = tacticalLookPoints(bot, state);
  const moveAng = Math.atan2(bot.targetY - bot.y, bot.targetX - bot.x);
  let bestA = moveAng;
  let best = Infinity;

  for (const s of state.mapData.tacticalSpots ?? []) {
    if (dist(bot, s) > TACTICAL_LOOK_RANGE) continue;
    const probe = {
      x: bot.x + Math.cos(s.watchAngle) * 95,
      y: bot.y + Math.sin(s.watchAngle) * 95
    };
    if (!hasLineOfSight(state.mapData, bot, probe, TACTICAL_LOOK_RANGE)) continue;
    const ang = s.watchAngle;
    let score: number =
      preferredAngle != null ? angleDiff(ang, preferredAngle) : angleDiff(ang, moveAng) * 0.92;
    score *= 0.78;
    score += (botSlotIndex(bot) * 0.009 + (tickId % 13) * 0.006) % 0.12;
    if (score < best) {
      best = score;
      bestA = ang;
    }
  }

  for (const p of points) {
    if (dist(bot, p) < 12) continue;
    if (!hasLineOfSight(state.mapData, bot, p, TACTICAL_LOOK_RANGE)) continue;
    const ang = Math.atan2(p.y - bot.y, p.x - bot.x);
    let score: number;
    if (preferredAngle != null) {
      score = angleDiff(ang, preferredAngle);
    } else {
      score = angleDiff(ang, moveAng) * 0.92;
    }
    score += (botSlotIndex(bot) * 0.011 + (tickId % 13) * 0.007) % 0.18;
    if (score < best) {
      best = score;
      bestA = ang;
    }
  }

  return bestA;
};

/** Aproximacao de onde os CTs entram no retake (norte do mapa) */
const CT_RETAKE_HINT = { x: 400, y: 120 };
/** Saida / refugio T (sul) — pos-plant: afastar da bomba nessa direcao para usar alcance maximo */
const T_SAFE_ANCHOR = { x: 400, y: 460 };

/**
 * Pos-plant TR: afasta da C4 na direcao segura (sul/mid), distancia ~ proporcional ao alcance da arma.
 * Órbita leve para não ficar parado esperando CTs.
 */
const postPlantTDefenseTarget = (bot: Bot, state: MatchState): { x: number; y: number } => {
  const bomb = getPlantedBombWorldPos(state)!;
  const rng = getWeaponRangeForRole(bot);
  let vx = T_SAFE_ANCHOR.x - bomb.x;
  let vy = T_SAFE_ANCHOR.y - bomb.y;
  const d0 = Math.hypot(vx, vy) || 1;
  vx /= d0;
  vy /= d0;

  const slot = botSlotIndex(bot);
  /** 0.5–0.62 do alcance: quanto mais longa a arma, mais longe da bomba (AWP / rifle) */
  const rangeFactor = 0.5 + Math.min(rng / 520, 1) * 0.12;
  /** AWP: recuo extra para manter distância e segurar ângulo longo */
  const awpBackBonus = bot.role === "AWP" ? 52 : 0;
  const backDist = Math.min(rng * rangeFactor + slot * 5 + awpBackBonus, 280);
  const lateral = ((slot - 2) * 34 + (slot % 2 === 0 ? 10 : -10)) * (bot.role === "AWP" ? 0.95 : 0.85);
  const px = -vy;
  const py = vx;
  let bx = bomb.x + vx * backDist + px * lateral;
  let by = bomb.y + vy * backDist + py * lateral;
  /** Órbita leve: patrulha em vez de ficar parado esperando retake */
  const tick = state.tickId ?? 0;
  const phase = tick * 0.14 + slot * 0.9;
  const orbit = bot.role === "AWP" ? 10 : 32;
  bx += Math.cos(phase) * orbit;
  by += Math.sin(phase) * (bot.role === "AWP" ? 8 : 24);
  return clampToMap(state.mapData, bx, by);
};

const avgTeamMoney = (state: MatchState, side: TeamSide) => {
  const list = state.bots.filter((b) => b.team === side && b.hp > 0);
  if (list.length === 0) return 0;
  return list.reduce((s, b) => s + b.money, 0) / list.length;
};

/**
 * Ajusta destino de movimento conforme situacao (sobrescreve waypoint tatico).
 * Prioridade: pos-plant T defesa > pos-plant CT eco/retake > retirada > C4 > ...
 * Se view for passada, usa dados localizados para barulho de tiros.
 */
export const applySituationalMovement = (bot: Bot, state: MatchState, view?: PlayerView) => {
  const enemies = enemiesOf(state, bot);
  const allies = aliveOnSide(state, bot.team);
  const threat = closestThreatInRadius(bot, state, THREAT_RADIUS);

  const spawnRed = { x: 400, y: 530 };
  const spawnBlu = { x: 400, y: 72 };

  // 0) C4 plantada: Ts — se CT esta defusando, correm pro site (barulho); senao post-plant longe da bomba
  if (state.bombPlanted && state.bombPlantSite && bot.team === getTrTeamFromState(state) && bot.hp > 0) {
    if (state.defuseProgressMs > 0 && state.defuserId) {
      const bomb = getPlantedBombWorldPos(state)!;
      const slot = botSlotIndex(bot);
      const spread = (slot - 2) * 18 + (slot % 2 === 0 ? 4 : -4);
      bot.targetX = bomb.x + spread;
      bot.targetY = bomb.y + (slot % 3) * 5;
      const c = clampToMap(state.mapData, bot.targetX, bot.targetY);
      bot.targetX = c.x;
      bot.targetY = c.y;
      return;
    }
    const p = postPlantTDefenseTarget(bot, state);
    bot.targetX = p.x;
    bot.targetY = p.y;
    return;
  }

  // 0a) CT sem kit: ir ao kit no chao (drop mais proximo). Pos-plant urgente: prioriza bomba; caso contrario ou pre-plant: prioriza kit
  if (bot.team === getCtTeamFromState(state) && bot.hp > 0 && !bot.hasDefuseKit && (state.defuseKitDrops?.length ?? 0) > 0) {
    const urgent =
      Boolean(state.bombPlanted && state.bombPlantSite) &&
      state.postPlantTimeLeftMs > 0 &&
      state.postPlantTimeLeftMs <= POST_PLANT_FORCE_RETAKE_MS;
    if (!urgent || !state.bombPlanted) {
      const drops = state.defuseKitDrops!;
      let nearest = drops[0];
      let bestD = Math.hypot(bot.x - nearest.x, bot.y - nearest.y);
      for (let i = 1; i < drops.length; i++) {
        const p = drops[i];
        const d = Math.hypot(bot.x - p.x, bot.y - p.y);
        if (d < bestD) {
          bestD = d;
          nearest = p;
        }
      }
      bot.targetX = nearest.x;
      bot.targetY = nearest.y;
      return;
    }
  }

  // 1) C4 plantada: CTs — avaliar numeros, economia, tempo; staging em eco; urgencia dinamica; defuse/hunt
  if (state.bombPlanted && state.bombPlantSite && bot.team === getCtTeamFromState(state) && bot.hp > 0) {
    const bomb = getPlantedBombWorldPos(state)!;
    const ctTeam = getCtTeamFromState(state);
    const trTeam = getTrTeamFromState(state);
    const ctAlive = aliveOnSide(state, ctTeam).length;
    const trAlive = aliveOnSide(state, trTeam).length;
    const avg = avgTeamMoney(state, ctTeam);
    const hasRifle = weaponKind(bot.primaryWeapon) !== "pistol";
    const hasFullBuy = avg >= TEAM_ECO_AVG_THRESHOLD && hasRifle;

    const urgentThresholdMs = getPostPlantUrgentThresholdMs(ctAlive, trAlive, hasFullBuy);
    const urgent = state.postPlantTimeLeftMs > 0 && state.postPlantTimeLeftMs <= urgentThresholdMs;

    /** Eco: pistola + time pobre. Usa staging (perto do site) em vez de spawn — chega mais rapido quando urgente. Exceto se todos TRs mortos: vai defusar. */
    const isEco = avg < CT_ECO_TEAM_AVG_THRESHOLD && bot.money <= CT_SAVE_BOT_MONEY_CAP && !hasRifle;

    if (isEco && !urgent && trAlive > 0) {
      const slot = botSlotIndex(bot);
      const staging = (state.mapData.zones?.some((z) => z.id === "site-a") ? getMapChokePoints(state.mapData).chokeA : defaultChokes().ctChoke);
      if (ctAlive >= trAlive + 1) {
        bot.targetX = staging.x + (slot - 2) * 32;
        bot.targetY = staging.y + slot * 4;
      } else {
        bot.targetX = spawnBlu.x + (slot - 2) * 38;
        bot.targetY = spawnBlu.y + 8;
      }
      return;
    }

    /** Alguém já defusando: defuser fica na bomba; outros patrulham/cobrem em vez de ficar parados */
    if (state.defuserId && state.defuseProgressMs > 0) {
      if (bot.id === state.defuserId) {
        bot.targetX = bomb.x;
        bot.targetY = bomb.y;
        return;
      }
      const hunt = ctPostPlantHuntTarget(bot, state);
      if (bot.hp > RETREAT_HP) {
        const soundMove = computeGunfireMovementTarget(bot, state, state.tickId, view);
        if (soundMove) {
          /** TRs vivos: puxar mais em direção ao barulho para engajar, não esperar passivo */
          bot.targetX = soundMove.x * 0.72 + hunt.x * 0.28;
          bot.targetY = soundMove.y * 0.72 + hunt.y * 0.28;
          return;
        }
      }
      bot.targetX = hunt.x;
      bot.targetY = hunt.y;
      return;
    }

    const mode = ctPostPlantMode(bot, state, urgent, ctAlive, trAlive);
    if (mode === "defuse") {
      /** TRs mortos: todos os CTs vão à bomba (ninguém para cobrir); 2+ vivos fazem cover os slots 2–4 */
      if (trAlive === 0) {
        /** Único CT ou todos vão defusar — garantir que ninguém fique parado em "cover" */
        bot.targetX = bomb.x;
        bot.targetY = bomb.y;
      } else if (ctAlive >= 2) {
        const slot = botSlotIndex(bot);
        if (slot <= 1 || bot.role === "IGL") {
          bot.targetX = bomb.x;
          bot.targetY = bomb.y;
        } else {
          /** Cover: posição deslocada — alterna com tick para micro-patrulha */
          const vx = T_SAFE_ANCHOR.x - bomb.x;
          const vy = T_SAFE_ANCHOR.y - bomb.y;
          const d = Math.hypot(vx, vy) || 1;
          const px = -vy / d;
          const py = vx / d;
          const tick = state.tickId ?? 0;
          const phase = Math.floor(tick / 20) % 4;
          const coverOff = 48 + (phase - 1.5) * 12 + (slot % 3) * 8;
          bot.targetX = bomb.x + px * coverOff + (slot % 2 === 0 ? 1 : -1) * 28;
          bot.targetY = bomb.y + py * coverOff;
          const c = clampToMap(state.mapData, bot.targetX, bot.targetY);
          bot.targetX = c.x;
          bot.targetY = c.y;
        }
      } else {
        bot.targetX = bomb.x;
        bot.targetY = bomb.y;
      }
      return;
    }

    const hunt = ctPostPlantHuntTarget(bot, state);
    if (bot.hp > RETREAT_HP) {
      const soundMove = computeGunfireMovementTarget(bot, state, state.tickId, view);
      if (soundMove) {
        /** Puxar mais em direção ao barulho para engajar ativamente */
        bot.targetX = soundMove.x * 0.72 + hunt.x * 0.28;
        bot.targetY = soundMove.y * 0.72 + hunt.y * 0.28;
        return;
      }
    }
    bot.targetX = hunt.x;
    bot.targetY = hunt.y;
    return;
  }

  // 2) Pouca vida + ameaca proxima -> save / recuar (exceto Ts com bomba plantada — ja tratado acima)
  if (bot.hp <= RETREAT_HP && threat && enemies.length >= allies.length) {
    const spawn = bot.team === getCtTeamFromState(state) ? spawnBlu : spawnRed;
    bot.targetX = spawn.x;
    bot.targetY = spawn.y;
    return;
  }

  // 3) TR sem bomba e C4 no chao -> priorizar pickup (objetivo principal)
  if (bot.team === getTrTeamFromState(state) && !bot.hasBomb && state.bombDroppedAt) {
    bot.targetX = state.bombDroppedAt.x;
    bot.targetY = state.bombDroppedAt.y;
    return;
  }

  // 3a) Primaria melhor no chao: aproximar (qualquer time; depois da prioridade da C4 para TR)
  if (
    bot.hp > RETREAT_HP &&
    (!threat || dist(bot, threat) > 95) &&
    (state.weaponDrops?.length ?? 0) > 0
  ) {
    const myTier = weaponTierValue(bot.primaryWeapon);
    let best: { x: number; y: number; tier: number; dist: number } | null = null;
    for (const d of state.weaponDrops!) {
      const t = weaponTierValue(d.primaryWeapon);
      if (t <= myTier) continue;
      const distTo = dist(bot, d);
      if (!best || t > best.tier || (t === best.tier && distTo < best.dist)) {
        best = { x: d.x, y: d.y, tier: t, dist: distTo };
      }
    }
    if (best && best.dist > 8) {
      bot.targetX = best.x;
      bot.targetY = best.y;
      return;
    }
  }

  // 3b) TRs sem C4: escoltar o portador rumo ao site (formacao por displayRole — Entry frente, AWP atrás)
  // Suporte/Entry nao ficam presos na base: se portador ainda no spawn, avancam ao site
  if (bot.team === getTrTeamFromState(state) && !bot.hasBomb && bot.hp > 0 && !state.bombPlanted && !state.bombDroppedAt) {
    const carrier = state.bots.find((b) => b.team === getTrTeamFromState(state) && b.hasBomb && b.hp > 0);
    if (carrier) {
      const site = getSiteCenters(state.mapData)[getTrMovementExecuteSite(state)];
      const isSecondHalf = state.round >= FIRST_ROUND_SECOND_HALF;
      // TR spawn: first half RED (y~530), second half BLU (y~72)
      const carrierInSpawn =
        (isSecondHalf && carrier.y < 180) || (!isSecondHalf && carrier.y > 420);
      const roleKey = bot.displayRole ?? (bot.role === "AWP" ? "Sniper" : bot.role === "IGL" ? "IGL" : "Support");
      if (carrierInSpawn && (roleKey === "Support" || roleKey === "Entry")) {
        bot.targetX = site.x;
        bot.targetY = site.y;
        return;
      }
      const offsets = TR_FORMATION_OFFSETS[roleKey] ?? TR_FORMATION_OFFSETS.Support;
      const toSite = Math.atan2(site.y - carrier.y, site.x - carrier.x);
      const perp = toSite + Math.PI / 2;
      let fx = Math.cos(toSite) * offsets.forward + Math.cos(perp) * offsets.lateral;
      let fy = Math.sin(toSite) * offsets.forward + Math.sin(perp) * offsets.lateral;
      const execSiteId = getTrMovementExecuteSite(state);
      const execC = getSiteCenters(state.mapData)[execSiteId];
      const dangerNearExec =
        view?.dangerSpots?.some((d) => Math.hypot(d.x - execC.x, d.y - execC.y) < 190) ?? false;
      if (dangerNearExec) {
        fx *= 0.9;
        fy *= 0.9;
      }
      bot.targetX = carrier.x + fx;
      bot.targetY = carrier.y + fy;
      const c = clampToMap(state.mapData, bot.targetX, bot.targetY);
      bot.targetX = c.x;
      bot.targetY = c.y;
      return;
    }
    // Sem portador (ex.: morreu, C4 no chao): ir ao site em vez de ficar parado
    const site = getSiteCenters(state.mapData)[getTrMovementExecuteSite(state)];
    bot.targetX = site.x;
    bot.targetY = site.y;
    return;
  }

  // 4) Portador TR -> executar site alvo do round (dominar bombsite e plantar)
  if (bot.team === getTrTeamFromState(state) && bot.hasBomb) {
    const site = getSiteCenters(state.mapData)[getTrMovementExecuteSite(state)];
    bot.targetX = site.x;
    bot.targetY = site.y;
    return;
  }

  // 1b) Save de equipamento (eco): spawn seguro — nao aplica a TR com objetivo C4/site (ja tratado acima)
  if (shouldSaveEquipment(bot, state)) {
    const isSecondHalf = state.round >= FIRST_ROUND_SECOND_HALF;
    const spawn =
      bot.team === "RED" ? (isSecondHalf ? spawnBlu : spawnRed) : (isSecondHalf ? spawnRed : spawnBlu);
    const slot = botSlotIndex(bot);
    bot.targetX = spawn.x + (slot - 2) * 38;
    bot.targetY = spawn.y + (bot.team === "RED" ? (isSecondHalf ? -6 : 6) : (isSecondHalf ? 6 : -6));
    return;
  }

  // 5) BLU em retake com C4 no chao -> contestar bomba
  if (
    bot.team === getCtTeamFromState(state) &&
    (state.bluStrategy === "retake" || state.bluStrategy === "rotate") &&
    state.bombDroppedAt
  ) {
    bot.targetX = state.bombDroppedAt.x;
    bot.targetY = state.bombDroppedAt.y;
    return;
  }

  // 5a) CT em defesa (pre-plant): patrulha — priorizar dangerSpots (ângulos cegos)
  if (
    bot.team === getCtTeamFromState(state) &&
    isCtDefendStrategy(state.bluStrategy) &&
    !state.bombPlanted &&
    bot.hp > RETREAT_HP &&
    !shouldSaveEquipment(bot, state)
  ) {
    if (view?.dangerSpots && view.dangerSpots.length > 0 && !threat) {
      const nearest = view.dangerSpots.reduce((a, b) => (dist(bot, a) < dist(bot, b) ? a : b));
      bot.targetX = nearest.x;
      bot.targetY = nearest.y;
      return;
    }
    const patrol = getCtHoldPatrolPositions(bot, state);
    const tick = state.tickId ?? 0;
    const slot = botSlotIndex(bot);
    const phase = Math.floor((tick + slot * 15) / 40) % patrol.length;
    const pos = patrol[phase];
    bot.targetX = pos.x;
    bot.targetY = pos.y;
    return;
  }

  // 5b) Barulho de tiro inimigo: aproximar/rotacionar conforme time, estrategia CT e role (nao sobrepoe C4/escolta/portador)
  if (bot.hp > RETREAT_HP) {
    const soundMove = computeGunfireMovementTarget(bot, state, state.tickId, view);
    if (soundMove) {
      bot.targetX = soundMove.x;
      bot.targetY = soundMove.y;
      return;
    }
  }

  // 5c) Passos ouvidos (sem tiro): aproximar com cautela para flanquear
  if (bot.hp > RETREAT_HP) {
    const footstepMove = computeFootstepMovementTarget(bot, state, state.tickId);
    if (footstepMove) {
      bot.targetX = footstepMove.x;
      bot.targetY = footstepMove.y;
      return;
    }
  }

  // 6) Tempo baixo: TRs aceleram para o bombsite alvo (dominar e plantar); BLU segura ancora
  /** ~35–5s restantes: TRs convergem ao site para dominar e plantar juntos; ultimos 5s nao forcar */
  if (state.timeLeftMs < 35000 && !state.bombPlanted && state.timeLeftMs > 5000) {
    if (bot.team === getTrTeamFromState(state) && bot.hp > RETREAT_HP) {
      const site = getSiteCenters(state.mapData)[getTrMovementExecuteSite(state)];
      bot.targetX = site.x;
      bot.targetY = site.y;
    }
    if (bot.team === getCtTeamFromState(state) && isCtDefendStrategy(state.bluStrategy)) {
      const slot = botSlotIndex(bot);
      const site = getCtSiteForBot(slot, state.bluStrategy, state.tsExecuteSite ?? "site-a", state.bombPlantSite);
      const anchor = getSiteCenters(state.mapData)[site];
      bot.targetX = anchor.x;
      bot.targetY = anchor.y;
    }
  }
};

/**
 * Angulo desejado para a mira (situacional).
 * Nunca mira diretamente no modelo do inimigo sem LOS — evita "travar" a mira em alguem atras de parede.
 * Se view for passada, usa apenas dados localizados (FOV + áudio).
 */
export const computeDesiredAimAngle = (
  bot: Bot,
  state: MatchState,
  tickId: number,
  view?: PlayerView
): number => {
  const rng = getWeaponRangeForRole(bot);

  const visible = view
    ? view.enemiesInFov.map((x) => x.bot)
    : enemiesOf(state, bot).filter((e) => canSeeWithFov(state.mapData, bot, e, getWeaponFovForRole(bot), rng));
  if (visible.length > 0) {
    if (state.bombPlanted && state.bombPlantSite && bot.team === getTrTeamFromState(state)) {
      const bomb = getPlantedBombWorldPos(state)!;
      const t = [...visible].sort((a, b) => dist(a, bomb) - dist(b, bomb))[0];
      return Math.atan2(t.y - bot.y, t.x - bot.x);
    }
    const t = sortByFinishPriority(bot, visible)[0];
    return Math.atan2(t.y - bot.y, t.x - bot.x);
  }

  /** Reacao a dano: so se houver LOS ate a origem do tiro; senao mira em angulo tatico na direcao da ameaca */
  if (
    bot.lastDamageTick >= 0 &&
    tickId - bot.lastDamageTick < DAMAGE_MEMORY_TICKS &&
    (bot.lastDamageFromX !== 0 || bot.lastDamageFromY !== 0)
  ) {
    const src = { x: bot.lastDamageFromX, y: bot.lastDamageFromY };
    const toward = Math.atan2(src.y - bot.y, src.x - bot.x);
    if (hasLineOfSight(state.mapData, bot, src, rng)) {
      return toward;
    }
    return pickNearestTacticalAimAngle(bot, state, tickId, toward);
  }

  /** Pre-mira: inimigo no arco de arma mas fora do FOV estreito — ainda exige LOS */
  const losEnemies = view
    ? view.enemiesWithLos
    : enemiesOf(state, bot).filter((e) => hasLineOfSight(state.mapData, bot, e, rng));
  if (losEnemies.length > 0) {
    if (state.bombPlanted && state.bombPlantSite && bot.team === getTrTeamFromState(state)) {
      const bomb = getPlantedBombWorldPos(state)!;
      const t = [...losEnemies].sort((a, b) => dist(a, bomb) - dist(b, bomb))[0];
      return Math.atan2(t.y - bot.y, t.x - bot.x);
    }
    const t = losEnemies.reduce((a, b) => (dist(bot, a) < dist(bot, b) ? a : b));
    return Math.atan2(t.y - bot.y, t.x - bot.x);
  }

  /** Barulho de tiros: direcao aproximada sem LOS — ponto tatico alinhado ao som (prioriza tiro mais recente) */
  const heardPrimary = view
    ? (() => {
        const heard = view.heardEnemies
          .map((x) => x.bot)
          .sort(
            (a, b) =>
              tickId - a.lastFireTick - (tickId - b.lastFireTick) || dist(bot, a) - dist(bot, b)
          )[0];
        return heard ?? null;
      })()
    : pickPrimaryHeardEnemy(bot, heardGunfireEnemies(bot, state, tickId), tickId);
  if (heardPrimary) {
    if (shouldSaveEquipment(bot, state)) {
      const isSecondHalf = state.round >= FIRST_ROUND_SECOND_HALF;
      const spawn =
        bot.team === "RED" ? (isSecondHalf ? { x: 400, y: 72 } : { x: 400, y: 530 }) : (isSecondHalf ? { x: 400, y: 530 } : { x: 400, y: 72 });
      const towardSafe = Math.atan2(spawn.y - bot.y, spawn.x - bot.x);
      return pickNearestTacticalAimAngle(bot, state, tickId, towardSafe);
    }
    const towardSound = Math.atan2(heardPrimary.y - bot.y, heardPrimary.x - bot.x);
    return pickNearestTacticalAimAngle(bot, state, tickId, towardSound);
  }

  /** Aliado em perigo: so se o inimigo proximo tiver LOS deste bot (apenas inimigos na view) */
  const allies = state.bots.filter((b) => b.team === bot.team && b.id !== bot.id && b.hp > 0 && b.hp < 58);
  const perceivableEnemies = view
    ? [...view.enemiesInFov.map((x) => x.bot), ...view.enemiesWithLos]
    : enemiesOf(state, bot);
  for (const ally of allies) {
    if (dist(bot, ally) > ALLY_HELP_RADIUS) continue;
    const nearEnemy = perceivableEnemies
      .filter((e) => dist(ally, e) < 200)
      .sort((a, b) => dist(ally, a) - dist(ally, b))[0];
    if (nearEnemy && (view || hasLineOfSight(state.mapData, bot, nearEnemy, rng))) {
      return Math.atan2(nearEnemy.y - bot.y, nearEnemy.x - bot.x);
    }
  }

  /** Pos-plant TR sem alvo: pre-mirar entradas do retake (norte) usando alcance */
  if (state.bombPlanted && state.bombPlantSite && bot.team === getTrTeamFromState(state)) {
    const bomb = getPlantedBombWorldPos(state)!;
    const preferRetake = Math.atan2(
      (CT_RETAKE_HINT.y + bomb.y) / 2 - bot.y,
      (CT_RETAKE_HINT.x + bomb.x) / 2 - bot.x
    );
    return pickNearestTacticalAimAngle(bot, state, tickId, preferRetake);
  }

  /** Idle: pickNearestTacticalAimAngle prioriza watchAngle de tacticalSpots */
  return pickNearestTacticalAimAngle(bot, state, tickId, null);
};

/**
 * Escolhe vitima entre inimigos visiveis (FOV+LOS).
 * IGL (T): prioriza quem ameaca o portador da C4; AWP: prioriza alvos mais distantes (pixel).
 */
export const pickCombatVictim = (attacker: Bot, inSight: Bot[], state: MatchState) => {
  if (inSight.length === 0) return null;
  if (attacker.role === "IGL" && attacker.team === getTrTeamFromState(state) && !state.bombPlanted) {
    const carrier = state.bots.find((b) => b.team === getTrTeamFromState(state) && b.hasBomb && b.hp > 0);
    if (carrier) {
      const site = getSiteCenters(state.mapData)[state.tsExecuteSite];
      return [...inSight].sort(
        (a, b) => threatToCarrierScore(a, carrier, site) - threatToCarrierScore(b, carrier, site)
      )[0];
    }
  }
  if (attacker.role === "IGL" && attacker.team === getCtTeamFromState(state) && state.bombPlanted && state.bombPlantSite) {
    const bomb = getPlantedBombWorldPos(state)!;
    return [...inSight].sort((a, b) => dist(a, bomb) - dist(b, bomb))[0];
  }
  if (attacker.role === "AWP") {
    /** Sniper: prioriza alvos mais distantes para usar alcance da AWP */
    return [...inSight].sort((a, b) => dist(attacker, b) - dist(attacker, a) || a.hp - b.hp)[0];
  }
  /** Rifler com AWP no time: prioriza alvos próximos (deixa longos para o sniper) */
  if (attacker.role === "Rifler" && hasAwpAlive(state, attacker.team)) {
    return [...inSight].sort((a, b) => dist(attacker, a) - dist(attacker, b) || a.hp - b.hp)[0];
  }
  /** displayRole Entry: prioriza primeiro inimigo visível (mais próximo — entry frag) */
  if (attacker.displayRole === "Entry") {
    return [...inSight].sort((a, b) => dist(attacker, a) - dist(attacker, b) || a.hp - b.hp)[0];
  }
  /** displayRole Support: prioriza trade (inimigo que danificou/matou aliado) */
  if (attacker.displayRole === "Support") {
    const tradeTargets = new Set<string>();
    for (const ally of state.bots) {
      if (ally.team !== attacker.team || ally.hp > 0) continue;
      for (const id of ally.damageContributors ?? []) {
        const e = state.bots.find((b) => b.id === id);
        if (e && e.team !== attacker.team && inSight.includes(e)) tradeTargets.add(e.id);
      }
    }
    const traded = inSight.filter((e) => tradeTargets.has(e.id));
    if (traded.length > 0) return sortByFinishPriority(attacker, traded)[0];
  }
  /** Decision alto: prioriza portador da C4 ou IGL (decisão tática) */
  if ((attacker.decision ?? 0) > 70) {
    const priority = inSight.filter((e) => e.hasBomb || e.role === "IGL" || e.displayRole === "IGL");
    if (priority.length > 0) return sortByFinishPriority(attacker, priority)[0];
  }
  return sortByFinishPriority(attacker, inSight)[0];
};

/** Modificador de chance de acerto: panico com pouca vida (escala por composure: alto composure = menos penalidade) */
export const panicPenalty = (bot: Bot, state?: MatchState): number => {
  if (bot.hp >= 40) return 0;
  let comp = bot.composure ?? 75;
  if (state?.morale) {
    const m = state.morale[bot.team];
    if (m < 50) comp -= Math.min(20, (50 - m) * 0.4);
  }
  const basePenalty = 0.2;
  return basePenalty * (1 - comp / 100);
};
