/**
 * API client base. Uses VITE_API_URL for base URL (default /api for dev with proxy).
 */
const getBaseUrl = () => import.meta.env.VITE_API_URL ?? "/api";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("csm_token");
};

export type ApiError = {
  error: string;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as ApiError)?.error ?? res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl().replace(/\/$/, "");
  const url = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  return handleResponse<T>(res);
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" })
};

export type ApiMatchPlayerStat = {
  playerId: string;
  kills: number;
  deaths: number;
  assists: number;
};

export type ApiMatch = {
  id: string;
  seasonId: string;
  round: number;
  teamAId: string;
  teamBId: string;
  winnerId: string | null;
  scoreA: number;
  scoreB: number;
  status: string;
  teamA: { id: string; name: string; userId?: string; players: ApiPlayer[] };
  teamB: { id: string; name: string; userId?: string; players: ApiPlayer[] };
  winner: { id: string; name: string } | null;
  playerStats?: ApiMatchPlayerStat[];
};

export type ApiPlayer = {
  id: string;
  name: string;
  role: string;
  aim: number;
  reflex: number;
  decision: number;
  composure: number;
  nationality: string | null;
};

export type ApiRankingItem = {
  teamId: string;
  teamName: string;
  points: number;
  wins: number;
  losses: number;
};

export type ApiGlobalRankingItem = {
  position: number;
  teamId: string;
  teamName: string;
  rating: number;
  tier: string;
  matchesPlayed: number;
};

export type ApiGlobalRankingResponse = {
  items: ApiGlobalRankingItem[];
  total: number;
  nextCursor: string | null;
};

export type ApiTeamRatingHistoryItem = {
  matchId: string;
  opponentName: string;
  result: "win" | "draw" | "loss";
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  createdAt: string;
};

export type ApiTeamRatingHistoryResponse = {
  teamId: string;
  teamName: string;
  currentRating: number;
  history: ApiTeamRatingHistoryItem[];
};

export type ApiPlayerRankingItem = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
};

export type PersistMatchResultResponse = {
  match: ApiMatch;
  ratingResult: {
    teamA: { teamId: string; teamName: string; delta: number; newRating: number };
    teamB: { teamId: string; teamName: string; delta: number; newRating: number };
  } | null;
  rankingPreview?: Array<{ position: number; teamId: string; teamName: string; rating: number }>;
  teamPositions?: {
    teamA: { position: number; positionChange: number };
    teamB: { position: number; positionChange: number };
  } | null;
};

export const simulationApi = {
  getSeason: () => api.get<{ id: string; name: string; status: string }>("simulation/season"),
  getMatches: (status?: "scheduled" | "finished") =>
    api.get<ApiMatch[]>(status ? `simulation/matches?status=${status}` : "simulation/matches"),
  getMatch: (id: string) => api.get<ApiMatch>(`simulation/matches/${id}`),
  persistMatchResult: (
    matchId: string,
    body: { winnerId: string; scoreA: number; scoreB: number; playerStats?: Array<{ playerId: string; kills: number; deaths: number; assists: number }> }
  ) => api.post<PersistMatchResultResponse>(`simulation/matches/${matchId}/run`, body),
  getRanking: () => api.get<ApiRankingItem[]>("simulation/ranking"),
  getPlayerRanking: () => api.get<ApiPlayerRankingItem[]>("simulation/ranking/players")
};

export type RankingGlobalQuery = {
  limit?: number;
  /** @deprecated Prefer `cursor`. */
  offset?: number;
  cursor?: string | null;
};

export const rankingApi = {
  getGlobal: (opts: RankingGlobalQuery = {}) => {
    const params = new URLSearchParams();
    const limit = opts.limit ?? 100;
    params.set("limit", String(limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    if (opts.cursor) params.set("cursor", opts.cursor);
    const q = params.toString();
    return api.get<ApiGlobalRankingResponse>(`ranking/global?${q}`);
  },
  /** Fetches global ranking pages until `nextCursor` is exhausted or `maxItems` is reached. */
  getGlobalAll: async (maxItems = 500) => {
    const items: ApiGlobalRankingItem[] = [];
    let cursor: string | undefined;
    while (items.length < maxItems) {
      const page = await rankingApi.getGlobal({
        limit: 100,
        ...(cursor ? { cursor } : {})
      });
      items.push(...page.items);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return items;
  },
  getTeamHistory: (teamId: string) =>
    api.get<ApiTeamRatingHistoryResponse>(`ranking/teams/${teamId}/history`)
};

export type ChampionshipTemplate = {
  format: 2 | 4 | 8;
  name: string;
  description: string;
  prizes: number[];
  matchCount: number;
};

export type ChampionshipRun = {
  id: string;
  name: string;
  format: number;
  status: string;
  matchCount: number;
  matches: ApiMatch[];
  prizes: number[];
};

export const championshipApi = {
  getTemplates: () => api.get<ChampionshipTemplate[]>("championships/templates"),
  getRuns: () => api.get<ChampionshipRun[]>("championships/runs"),
  getRun: (id: string) => api.get<ChampionshipRun & { template?: ChampionshipTemplate }>(`championships/runs/${id}`),
  start: (format: 2 | 4 | 8) => api.post<{ id: string; name: string; matches: ApiMatch[] }>("championships/start", { format })
};

export type ApiBet = {
  id: string;
  userId: string;
  matchId: string;
  teamId: string;
  amount: number;
  status: string;
  payout: number | null;
  createdAt: string;
  match?: ApiMatch;
};

export type ApiMatchOdds = {
  teamA: { teamId: string; teamName: string; impliedProbability: number; odds: number };
  teamB: { teamId: string; teamName: string; impliedProbability: number; odds: number };
};

export const bettingApi = {
  placeBet: (matchId: string, teamId: string, amount: number) =>
    api.post<ApiBet>("betting/bets", { matchId, teamId, amount }),
  getUserBets: () => api.get<ApiBet[]>("betting/bets"),
  getMatchOdds: (matchId: string) => api.get<ApiMatchOdds>(`betting/matches/${matchId}/odds`)
};
