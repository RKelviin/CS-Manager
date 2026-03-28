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
    "eliminacao TR": "Todos os TRs eliminados",
    "eliminacao CT": "Todos os CTs eliminados",
    "eliminacao dos CTs": "Todos os CTs eliminados",
    "tempo (CT)": "Tempo do round esgotado (vitória CT)",
    "empate-regulamento": "Empate 6x6 apos 12 rounds (regulamento)",
    "empate-OT": "Empate apos OT (6 rounds de prorrogacao)"
  };
  return map[cause] ?? cause;
};
