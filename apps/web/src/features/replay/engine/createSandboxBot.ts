import { BOT_RADIUS, checkWallCollision } from "../map/dust2Map";
import type { MapData } from "../map/mapTypes";
import { snapToNearestNavNode } from "../map/navMesh";
import type { ArmorLoadout, Bot, StartsAsSide, TeamSide } from "../types";
import { START_MONEY } from "./economyConstants";
import { secondaryPistolForBotTeam } from "./roundBuy";

export type CreateSandboxBotResult =
  | { ok: true; bot: Bot; x: number; y: number }
  | { ok: false; error: string };

let sandboxIdSeq = 0;

/**
 * Bot extra para laboratório: valida parede, opcionalmente encaixa no nav mais próximo.
 */
export function createSandboxBot(opts: {
  map: MapData;
  team: TeamSide;
  x: number;
  y: number;
  id?: string;
  name?: string;
  snapNav?: boolean;
  /** Primária (secundária = pistola do lado no round) */
  primaryWeapon?: string;
  round?: number;
  teamAStartsAs?: StartsAsSide;
}): CreateSandboxBotResult {
  let x = opts.x;
  let y = opts.y;
  if (opts.snapNav) {
    const snapped = snapToNearestNavNode(opts.map, { x, y });
    x = snapped.x;
    y = snapped.y;
  }
  if (checkWallCollision(opts.map, x, y, BOT_RADIUS)) {
    return { ok: false, error: "Posição inválida (parede ou fora do caminhável)." };
  }
  const id = opts.id ?? `sandbox-${++sandboxIdSeq}`;
  const round = opts.round ?? 1;
  const teamAStartsAs = opts.teamAStartsAs ?? "RED";
  const pistol = secondaryPistolForBotTeam(opts.team, round, teamAStartsAs);
  const primary = opts.primaryWeapon ?? pistol;
  const secondary = pistol;
  const targetY = opts.team === "RED" ? y - 100 : y + 100;
  const bot: Bot = {
    id,
    name: opts.name ?? (opts.team === "RED" ? "Extra RED" : "Extra BLU"),
    team: opts.team,
    role: "Rifler",
    hp: 100,
    x,
    y,
    angle: opts.team === "RED" ? -Math.PI / 2 : Math.PI / 2,
    aim: 76,
    targetX: x,
    targetY,
    lastFireTick: -1,
    kills: 0,
    deaths: 0,
    assists: 0,
    killsAtRoundStart: 0,
    killsThisRound: 0,
    damageDealt: 0,
    damageContributors: [],
    money: START_MONEY,
    primaryWeapon: primary,
    secondaryWeapon: secondary,
    hasBomb: false,
    hasDefuseKit: false,
    armor: "none" as ArmorLoadout,
    lastDamageTick: -1,
    lastDamageFromX: 0,
    lastDamageFromY: 0,
    lastMoveTick: -1,
    navPath: [],
    navGoalX: x,
    navGoalY: targetY,
    navStuckTicks: 0,
    reflex: 75,
    decision: 75,
    composure: 75
  };
  return { ok: true, bot, x, y };
}
