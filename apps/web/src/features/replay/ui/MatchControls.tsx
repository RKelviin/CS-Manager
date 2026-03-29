import type { CSSProperties } from "react";

const btnStyle: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid #2a3142",
  background: "#1d2433",
  color: "#eef2ff",
  fontWeight: 600,
  cursor: "pointer"
};

export const MatchControls = ({
  isRunning,
  matchEnded,
  canFinishRound,
  onStart,
  onPause,
  onReset,
  onFinishRound,
  labels
}: {
  isRunning: boolean;
  /** Partida ja tem vencedor — use Reiniciar */
  matchEnded?: boolean;
  /** Round em andamento (nao na intermissao) — permite finalizar manualmente */
  canFinishRound?: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onFinishRound?: () => void;
  /** Rótulos opcionais (ex.: Sandbox com textos curtos) */
  labels?: {
    start?: string;
    pause?: string;
    finishRound?: string;
    matchEnded?: string;
  };
}) => {
  const startDisabled = matchEnded === true;
  const finishDisabled = !canFinishRound || matchEnded;
  const labelStart = labels?.start ?? "Iniciar partida";
  const labelPause = labels?.pause ?? "Pausar";
  const labelFinish = labels?.finishRound ?? "Finalizar round";
  const labelEnded = labels?.matchEnded ?? "Partida encerrada";
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
      <button
        type="button"
        onClick={isRunning ? onPause : onStart}
        disabled={startDisabled}
        style={{
          ...btnStyle,
          opacity: startDisabled ? 0.45 : 1,
          cursor: startDisabled ? "not-allowed" : "pointer"
        }}
      >
        {matchEnded ? labelEnded : isRunning ? labelPause : labelStart}
      </button>
      {onFinishRound && (
        <button
          type="button"
          onClick={onFinishRound}
          disabled={finishDisabled}
          title={
            finishDisabled
              ? "Round em intermissao ou partida encerrada"
              : "C4 plantada: papel RED vence · C4 nao plantada: papel BLU vence"
          }
          style={{
            ...btnStyle,
            opacity: finishDisabled ? 0.45 : 1,
            cursor: finishDisabled ? "not-allowed" : "pointer",
            background: "#1e3a2f",
            borderColor: "#2d5a47"
          }}
        >
          {labelFinish}
        </button>
      )}
      <button type="button" onClick={onReset} style={{ ...btnStyle, background: "#2a1f1f", borderColor: "#5c3030" }}>
        Reiniciar
      </button>
    </div>
  );
};
