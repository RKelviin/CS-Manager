/**
 * Persistência do time em localStorage.
 * No futuro pode ser trocado por API/banco.
 */
import type { UserTeam } from "./types";

const STORAGE_KEY = "csm_team";

export const loadTeam = (fallback: UserTeam): UserTeam => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as UserTeam;
    if (!parsed?.name || !Array.isArray(parsed.starters) || !Array.isArray(parsed.bench)) {
      return fallback;
    }
    return {
      name: String(parsed.name),
      record: {
        wins: Math.max(0, Number(parsed.record?.wins) || 0),
        losses: Math.max(0, Number(parsed.record?.losses) || 0)
      },
      starters: Array.isArray(parsed.starters) ? parsed.starters : fallback.starters,
      bench: Array.isArray(parsed.bench) ? parsed.bench : fallback.bench
    };
  } catch {
    return fallback;
  }
};

export const saveTeam = (team: UserTeam): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
  } catch {
    // storage full ou privado
  }
};
