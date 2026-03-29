/**
 * Regulamento: primeiro a 7 (MR12); rounds 1–6 um lado, 7–12 o outro (6 no papel RED + 6 no papel BLU por roster).
 * OT competitivo: a partir do round 13, blocos de 4 rounds (2 no papel RED + 2 no papel BLU no bloco).
 *
 * **Papéis no mapa (não confundir com roster RED/BLU):**
 * - **Lado RED** = atacante, C4, spawn “de ataque” no mapa (ex.: vermelho na HUD).
 * - **Lado BLU** = defensor, kit, spawn “de defesa” (ex.: azul na HUD).
 * Qual roster (time A=RED ou B=BLU) ocupa cada papel muda por round (meio-tempo / OT).
 */
/** Primeiro time a atingir esta pontuacao vence na regulamentar */
export const ROUNDS_TO_WIN_MATCH = 7;

/** Na OT amigável: primeiro a 13 vence */
export const ROUNDS_TO_WIN_OT = 13;

/** Rounds por metade — cada time joga 6 rounds no papel RED e 6 no BLU na regulamentação */
export const ROUNDS_PER_HALF = 6;

/** Último round da regulamentação (12). Overtime começa no round seguinte. */
export const REGULATION_MAX_ROUNDS = ROUNDS_PER_HALF * 2;

/** Primeiro round de overtime (13). */
export const FIRST_OT_ROUND = REGULATION_MAX_ROUNDS + 1;

/** OT competitivo: rounds por período (4 = 2 RED + 2 BLU no bloco) */
export const OT_ROUNDS_PER_PERIOD = 4;

/** OT competitivo: pontos para vencer um período */
export const OT_POINTS_TO_WIN_PERIOD = 3;

/** Ultimo round da OT amigável (6 rounds de prorrogacao) */
export const OT_MAX_ROUND = 18;

/** Primeiro round do 2.º half (pistol + troca de lados) */
export const FIRST_ROUND_SECOND_HALF = ROUNDS_PER_HALF + 1;

/** Qual roster (RED ou BLU) joga no papel de ataque (lado RED / C4) neste round. */
export const getRedSideTeam = (round: number, teamAStartsAs: "RED" | "BLU" = "RED"): "RED" | "BLU" => {
  if (round >= FIRST_OT_ROUND) {
    const posInBlock = (round - FIRST_OT_ROUND) % OT_ROUNDS_PER_PERIOD;
    if (teamAStartsAs === "RED") return posInBlock < 2 ? "RED" : "BLU";
    return posInBlock < 2 ? "BLU" : "RED";
  }
  const firstHalf = round < FIRST_ROUND_SECOND_HALF;
  if (teamAStartsAs === "RED") return firstHalf ? "RED" : "BLU";
  return firstHalf ? "BLU" : "RED";
};

/** Qual roster joga no papel de defesa (lado BLU / kit) neste round. */
export const getBluSideTeam = (round: number, teamAStartsAs: "RED" | "BLU" = "RED"): "RED" | "BLU" => {
  if (round >= FIRST_OT_ROUND) {
    const posInBlock = (round - FIRST_OT_ROUND) % OT_ROUNDS_PER_PERIOD;
    if (teamAStartsAs === "RED") return posInBlock < 2 ? "BLU" : "RED";
    return posInBlock < 2 ? "RED" : "BLU";
  }
  const firstHalf = round < FIRST_ROUND_SECOND_HALF;
  if (teamAStartsAs === "RED") return firstHalf ? "BLU" : "RED";
  return firstHalf ? "RED" : "BLU";
};

/** Helpers que leem do state (round + teamAStartsAs). */
export const getRedSideTeamFromState = (state: { round: number; teamAStartsAs: "RED" | "BLU" }): "RED" | "BLU" =>
  getRedSideTeam(state.round, state.teamAStartsAs);
export const getBluSideTeamFromState = (state: { round: number; teamAStartsAs: "RED" | "BLU" }): "RED" | "BLU" =>
  getBluSideTeam(state.round, state.teamAStartsAs);

/** Cores HUD para quem está no papel RED (ataque) vs papel BLU (defesa) */
export const RED_SIDE_DISPLAY_COLORS = {
  primary: "#f87171",
  dot: "#ef4444",
  light: "#fca5a5",
  border: "#dc2626",
  bg: "rgba(220, 38, 38, 0.12)",
  mapIcon: "#f87171",
  flash: "rgba(239, 68, 68, ",
  aim: "rgba(248, 113, 113, "
} as const;
export const BLU_SIDE_DISPLAY_COLORS = {
  primary: "#60a5fa",
  dot: "#1e90ff",
  light: "#93c5fd",
  border: "#2563eb",
  bg: "rgba(37, 99, 235, 0.08)",
  mapIcon: "#8eb4f0",
  flash: "rgba(30, 144, 255, ",
  aim: "rgba(0, 191, 255, "
} as const;

/** Cor de exibição do roster conforme o papel (RED ataque / BLU defesa) neste round. */
export const getTeamDisplayColor = (
  team: "RED" | "BLU",
  round: number,
  kind: keyof typeof RED_SIDE_DISPLAY_COLORS,
  teamAStartsAs: "RED" | "BLU" = "RED"
): string => {
  const redSideRoster = getRedSideTeam(round, teamAStartsAs);
  return team === redSideRoster ? RED_SIDE_DISPLAY_COLORS[kind] : BLU_SIDE_DISPLAY_COLORS[kind];
};
