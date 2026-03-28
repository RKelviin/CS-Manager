import type { Bot, PlayerRole } from "../types";
import { weaponKind } from "../ui/weaponIcons";
import {
  DAMAGE_MULTIPLIER_BY_KIND,
  FIRE_COOLDOWN_BY_KIND,
  HEADSHOT_CHANCE_BY_KIND,
  HIT_CHANCE_BONUS_BY_KIND,
  RANGE_PENALTY_MULT_BY_KIND,
  ROTATE_STEP,
  WEAPON_FOV,
  WEAPON_RANGE
} from "./combatConstants";

/** Papéis fixos por slot (0–4) — RED e BLU */
export const RED_ROLES: PlayerRole[] = ["IGL", "Rifler", "AWP", "Rifler", "Rifler"];
export const BLU_ROLES: PlayerRole[] = ["IGL", "AWP", "Rifler", "Rifler", "Rifler"];

export const roleLabel = (r: PlayerRole) =>
  r === "IGL" ? "IGL" : r === "AWP" ? "AWP" : "Rifler";

/** Alcance efetivo (px) por tipo de arma primaria equipada */
const RANGE_BY_KIND: Record<ReturnType<typeof weaponKind>, number> = {
  sniper: 420,
  rifle: WEAPON_RANGE,
  budget_rifle: WEAPON_RANGE,
  smg: 265,
  pistol: 215
};

/** FOV (rad) por tipo de arma primaria equipada */
const FOV_BY_KIND_RAD: Record<ReturnType<typeof weaponKind>, number> = {
  sniper: (34 * Math.PI) / 180,
  rifle: WEAPON_FOV,
  budget_rifle: WEAPON_FOV,
  smg: (72 * Math.PI) / 180,
  pistol: (68 * Math.PI) / 180
};

/** Alcance de visão / tiro: depende da arma primaria, nao do papel */
export const getWeaponRangeForRole = (bot: Bot) => RANGE_BY_KIND[weaponKind(bot.primaryWeapon)];

/** FOV de visão / mira: depende da arma primaria, nao do papel */
export const getWeaponFovForRole = (bot: Bot) => FOV_BY_KIND_RAD[weaponKind(bot.primaryWeapon)];

/** Rotacao da mira: AWP mais pesada; IGL um pouco mais rapido; reflex aumenta velocidade (100 = 1.15x, 50 = 1x) */
export const getRotateStepForRole = (bot: Bot) => {
  let base = ROTATE_STEP;
  if (bot.role === "AWP") base *= 0.9;
  else if (bot.role === "IGL") base *= 1.08;
  else base *= 1.04;
  const r = bot.reflex ?? 75;
  return base * (0.85 + (r / 100) * 0.3);
};

/** Bonus flat na chance de acerto por arma (AWP muito precisa, pistol menos) */
export const getHitChanceBonusForRole = (bot: Bot) =>
  HIT_CHANCE_BONUS_BY_KIND[weaponKind(bot.primaryWeapon)] ?? 0;

/** Multiplicador da penalidade por distancia (AWP quase nao sofre a longa distancia) */
export const getRangePenaltyMultiplier = (bot: Bot) =>
  RANGE_PENALTY_MULT_BY_KIND[weaponKind(bot.primaryWeapon)] ?? 1;

/** Ticks entre tiros por arma (AWP lenta, SMG rapida) */
export const getFireCooldownTicksForRole = (bot: Bot) =>
  FIRE_COOLDOWN_BY_KIND[weaponKind(bot.primaryWeapon)] ?? 2;

/** Multiplicador de dano por arma (AWP alto, pistol baixo) */
export const getDamageMultiplierForRole = (bot: Bot) =>
  DAMAGE_MULTIPLIER_BY_KIND[weaponKind(bot.primaryWeapon)] ?? 1;

/** Chance de headshot por arma (AWP alta, pistol baixa); headshot aplica dano x4 */
export const getHeadshotChanceForRole = (bot: Bot) =>
  HEADSHOT_CHANCE_BY_KIND[weaponKind(bot.primaryWeapon)] ?? 0.1;

/** IGL: prioriza ameaca perto do portador da C4 */
export const threatToCarrierScore = (
  enemy: Bot,
  carrier: Bot | undefined,
  site: { x: number; y: number }
) => {
  if (!carrier) return dist2(enemy, site);
  return Math.min(dist2(enemy, carrier), dist2(enemy, site) * 0.85);
};

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
