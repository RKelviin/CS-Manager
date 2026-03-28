import type { Bot, MatchScore } from "../types";

export const totalRoundsPlayed = (score: MatchScore): number => score.RED + score.BLU;

/**
 * Rating ~1.0 = medio; baseado em impacto (K/A/D) e ADR por round (simplificado).
 */
export function computeMatchRating(
  bot: Pick<Bot, "kills" | "deaths" | "assists" | "damageDealt">,
  rounds: number
): number {
  const dmg = bot.damageDealt ?? 0;
  const R = Math.max(1, rounds);
  const impact = (bot.kills + 0.5 * bot.assists - 0.5 * bot.deaths) / (2 * R);
  const dmgNorm = dmg / (500 * R);
  return Math.round(Math.min(2.5, Math.max(0.5, 1 + impact + dmgNorm)) * 100) / 100;
}

export function formatKdr(kills: number, deaths: number): string {
  if (deaths === 0) return kills > 0 ? "∞" : "0.00";
  return (kills / deaths).toFixed(2);
}
