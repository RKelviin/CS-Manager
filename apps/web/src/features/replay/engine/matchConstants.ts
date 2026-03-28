/**
 * Formato regulamento: primeiro a 7 rounds; ate 12 rounds (6 TR + 6 CT por time).
 * OT amigável: 6-6 no round 12 inicia prorrogacao (6 rounds). Primeiro a 13 vence; 9-9 = empate.
 * OT competitivo (tournament): 4 rounds por período (2 de cada lado), primeiro a 3 no período vence; 2-2 = novo período.
 */
/** Primeiro time a atingir esta pontuacao vence na regulamentar */
export const ROUNDS_TO_WIN_MATCH = 7;

/** Na OT amigável: primeiro a 13 vence */
export const ROUNDS_TO_WIN_OT = 13;

/** Rounds por lado (metade) — TR ou CT */
export const ROUNDS_PER_HALF = 6;

/** Fim do regulamento (round 12); OT = rounds 13+ */
export const REGULATION_MAX_ROUNDS = ROUNDS_PER_HALF * 2;

/** OT competitivo: rounds por período (4 = 2 de cada lado) */
export const OT_ROUNDS_PER_PERIOD = 4;

/** OT competitivo: pontos para vencer um período */
export const OT_POINTS_TO_WIN_PERIOD = 3;

/** Ultimo round da OT amigável (6 rounds de prorrogacao) */
export const OT_MAX_ROUND = 18;

/** Primeiro round do 2.º half (pistol + troca de lados) */
export const FIRST_ROUND_SECOND_HALF = ROUNDS_PER_HALF + 1;

/** Time que joga como TR (atacante, porta C4) no round atual. */
export const getTrTeam = (round: number, teamAStartsAs: "CT" | "TR" = "TR"): "RED" | "BLU" => {
  if (round >= REGULATION_MAX_ROUNDS) {
    const posInBlock = (round - REGULATION_MAX_ROUNDS) % OT_ROUNDS_PER_PERIOD;
    if (teamAStartsAs === "TR") return posInBlock < 2 ? "RED" : "BLU";
    return posInBlock < 2 ? "BLU" : "RED";
  }
  const firstHalf = round < FIRST_ROUND_SECOND_HALF;
  if (teamAStartsAs === "TR") return firstHalf ? "RED" : "BLU";
  return firstHalf ? "BLU" : "RED";
};

/** Time que joga como CT (defensor) no round atual. */
export const getCtTeam = (round: number, teamAStartsAs: "CT" | "TR" = "TR"): "RED" | "BLU" => {
  if (round >= REGULATION_MAX_ROUNDS) {
    const posInBlock = (round - REGULATION_MAX_ROUNDS) % OT_ROUNDS_PER_PERIOD;
    if (teamAStartsAs === "TR") return posInBlock < 2 ? "BLU" : "RED";
    return posInBlock < 2 ? "RED" : "BLU";
  }
  const firstHalf = round < FIRST_ROUND_SECOND_HALF;
  if (teamAStartsAs === "TR") return firstHalf ? "BLU" : "RED";
  return firstHalf ? "RED" : "BLU";
};

/** Helpers que leem do state (round + teamAStartsAs). */
export const getTrTeamFromState = (state: { round: number; teamAStartsAs: "CT" | "TR" }): "RED" | "BLU" =>
  getTrTeam(state.round, state.teamAStartsAs);
export const getCtTeamFromState = (state: { round: number; teamAStartsAs: "CT" | "TR" }): "RED" | "BLU" =>
  getCtTeam(state.round, state.teamAStartsAs);

/** Cores visuais TR (laranja) e CT (azul) — usadas na HUD e nas bolinhas. */
export const TR_DISPLAY_COLORS = {
  primary: "#fb923c",
  dot: "#ff8c00",
  light: "#fdba74",
  border: "#c45c1a",
  bg: "rgba(196, 92, 26, 0.08)",
  mapIcon: "#d4a574",
  flash: "rgba(255, 140, 0, ",
  aim: "rgba(255, 69, 0, "
} as const;
export const CT_DISPLAY_COLORS = {
  primary: "#60a5fa",
  dot: "#1e90ff",
  light: "#93c5fd",
  border: "#2563eb",
  bg: "rgba(37, 99, 235, 0.08)",
  mapIcon: "#8eb4f0",
  flash: "rgba(30, 144, 255, ",
  aim: "rgba(0, 191, 255, "
} as const;

/** Cor de exibicao do time conforme o lado que joga (TR ou CT) no round atual. */
export const getTeamDisplayColor = (
  team: "RED" | "BLU",
  round: number,
  kind: keyof typeof TR_DISPLAY_COLORS,
  teamAStartsAs: "CT" | "TR" = "TR"
): string => {
  const tr = getTrTeam(round, teamAStartsAs);
  return team === tr ? TR_DISPLAY_COLORS[kind] : CT_DISPLAY_COLORS[kind];
};
