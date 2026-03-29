/**
 * Texto amigavel para o motivo da vitoria no ultimo round (chaves do matchReducer).
 */
export const matchEndReasonLabel = (cause: string | null | undefined): string => {
  if (cause == null || cause === "") return "Partida finalizada";
  const map: Record<string, string> = {
    "defuse da C4": "C4 desarmada (defuse)",
    "explosao da C4": "C4 explodiu",
    "C4 plantada (manual)": "C4 plantada (finalizado manualmente)",
    "finalizado manualmente": "Round finalizado manualmente",
    eliminacao: "Todos eliminados",
    "eliminacao RED": "Todo o papel RED (ataque) eliminado",
    "eliminacao BLU": "Todo o papel BLU (defesa) eliminado",
    "eliminacao papel BLU": "Todo o papel BLU eliminado",
    "tempo (BLU)": "Tempo do round esgotado (vitória do papel BLU)",
    "empate-regulamento": "Empate 6x6 apos 12 rounds (regulamento)",
    "empate-OT": "Empate apos OT (6 rounds de prorrogacao)"
  };
  return map[cause] ?? cause;
};
