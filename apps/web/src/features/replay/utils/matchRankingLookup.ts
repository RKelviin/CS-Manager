import type { ApiGlobalRankingItem } from "../../../shared/apiClient";
import type { MatchState } from "../types";

const norm = (s: string) => s.trim().toLowerCase();

export function lookupGlobalRankingTeam(
  ranking: ApiGlobalRankingItem[],
  teamName: string
): ApiGlobalRankingItem | null {
  const n = norm(teamName);
  if (!n) return null;
  const exact = ranking.find((r) => norm(r.teamName) === n);
  if (exact) return exact;
  return (
    ranking.find((r) => {
      const rn = norm(r.teamName);
      return rn.includes(n) || n.includes(rn);
    }) ?? null
  );
}

/** Quando o time não está no ranking global, gera um rating estável para ordenação. */
export function fallbackTeamRating(teamName: string): number {
  let h = 0;
  for (let i = 0; i < teamName.length; i++) h = ((h << 5) - h + teamName.charCodeAt(i)) | 0;
  return 1350 + (Math.abs(h) % 500);
}

export function teamRatingOrFallback(ranking: ApiGlobalRankingItem[], teamName: string): number {
  const row = lookupGlobalRankingTeam(ranking, teamName);
  return row?.rating ?? fallbackTeamRating(teamName);
}

/** Média dos ratings (ou fallback) dos dois times — usada para ordenar e escolher destaque. */
export function avgTeamsRankingScore(state: MatchState, ranking: ApiGlobalRankingItem[]): number {
  const a = teamRatingOrFallback(ranking, state.teamAName);
  const b = teamRatingOrFallback(ranking, state.teamBName);
  return (a + b) / 2;
}
