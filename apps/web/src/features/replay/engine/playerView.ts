/**
 * Visão localizada do bot: só o que ele pode ver (FOV+LOS) e ouvir (tiros).
 */
import { canSeeWithFov, hasLineOfSight, heardGunfireEnemies } from "./situationalBrain";
import { getWeaponFovForRole, getWeaponRangeForRole } from "./roleCombat";
import { getTrTeamFromState } from "./matchConstants";
import type { Bot, MatchState } from "../types";

export type PlayerView = {
  botId: string;
  /** Inimigos no FOV da arma com LOS */
  enemiesInFov: { bot: Bot; dist: number; angleFromCenter: number }[];
  /** Inimigos com LOS mas fora do FOV estreito (pre-mira) */
  enemiesWithLos: Bot[];
  alliesInFov: { bot: Bot }[];
  /** Inimigos ouvidos (tiros) sem LOS */
  heardEnemies: { bot: Bot; approxAngle: number }[];
  roundTimeLeft: number;
  bombState: "none" | "planted" | "planting" | "defusing";
  alliesAlive: number;
  enemiesAlive: number;
};

const normalizeAngle = (a: number) => {
  let x = a;
  while (x < -Math.PI) x += Math.PI * 2;
  while (x > Math.PI) x -= Math.PI * 2;
  return x;
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Constrói a visão localizada do bot (FOV + áudio). */
export function buildPlayerView(bot: Bot, state: MatchState): PlayerView {
  const fov = getWeaponFovForRole(bot);
  const rng = getWeaponRangeForRole(bot);

  const enemies = state.bots.filter((b) => b.team !== bot.team && b.hp > 0);
  const allies = state.bots.filter((b) => b.team === bot.team && b.id !== bot.id && b.hp > 0);

  const enemiesInFov = enemies
    .filter((e) => canSeeWithFov(state.mapData, bot, e, fov, rng))
    .map((e) => {
      const d = dist(bot, e);
      const angleTo = Math.atan2(e.y - bot.y, e.x - bot.x);
      const angleFromCenter = normalizeAngle(angleTo - bot.angle);
      return { bot: e, dist: d, angleFromCenter };
    });

  const inFovIds = new Set(enemiesInFov.map((x) => x.bot.id));
  const enemiesWithLos = enemies.filter(
    (e) => !inFovIds.has(e.id) && hasLineOfSight(state.mapData, bot, e, rng)
  );

  const alliesInFov = allies.filter((e) => canSeeWithFov(state.mapData, bot, e, fov, rng)).map((e) => ({ bot: e }));

  const heard = heardGunfireEnemies(bot, state, state.tickId ?? 0);
  const heardEnemies = heard.map((e) => {
    const angleTo = Math.atan2(e.y - bot.y, e.x - bot.x);
    return { bot: e, approxAngle: angleTo };
  });

  let bombState: PlayerView["bombState"] = "none";
  if (state.bombPlanted && state.bombPlantSite) {
    bombState = state.defuserId && state.defuseProgressMs > 0 ? "defusing" : "planted";
  } else if (
    bot.team === getTrTeamFromState(state) &&
    bot.hasBomb &&
    state.plantProgressMs > 0
  ) {
    bombState = "planting";
  }

  const alliesAlive = state.bots.filter((b) => b.team === bot.team && b.hp > 0).length;
  const enemiesAlive = state.bots.filter((b) => b.team !== bot.team && b.hp > 0).length;

  return {
    botId: bot.id,
    enemiesInFov,
    enemiesWithLos,
    alliesInFov,
    heardEnemies,
    roundTimeLeft: state.timeLeftMs,
    bombState,
    alliesAlive,
    enemiesAlive
  };
}
