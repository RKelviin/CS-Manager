import { useCallback, useEffect, useMemo, useState } from "react";
import { BLU_SIDE_DISPLAY_COLORS, RED_SIDE_DISPLAY_COLORS } from "../replay/engine/matchConstants";
import { theme } from "../../theme/tokens";
import { bettingApi, type ApiBet, type ApiMatchOdds } from "../../shared/apiClient";

const { colors, spacing, radii, typography } = theme;

const MIN = 100;
const MAX = 10_000;

function betStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendente";
    case "won":
      return "Ganhou";
    case "lost":
      return "Perdeu";
    case "cancelled":
      return "Cancelada (reembolsada)";
    default:
      return status;
  }
}

type Props = {
  matchId: string;
  teamAId: string;
  teamAName: string;
  teamBId: string;
  teamBName: string;
  disabled?: boolean;
};

export function BettingPanel({
  matchId,
  teamAId,
  teamAName,
  teamBId,
  teamBName,
  disabled = false
}: Props) {
  const [odds, setOdds] = useState<ApiMatchOdds | null>(null);
  const [bets, setBets] = useState<ApiBet[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(teamAId);
  const [amountStr, setAmountStr] = useState("500");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const [o, list] = await Promise.all([bettingApi.getMatchOdds(matchId), bettingApi.getUserBets()]);
      setOdds(o);
      setBets(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erro ao carregar apostas");
    }
  }, [matchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const existingBet = useMemo(
    () => bets?.find((b) => b.matchId === matchId) ?? null,
    [bets, matchId]
  );

  const teamNameForBet = (teamId: string) => (teamId === teamAId ? teamAName : teamBName);

  const validateAmount = (n: number): string | null => {
    if (!Number.isFinite(n) || !Number.isInteger(n)) return "Use um valor inteiro.";
    if (n < MIN || n > MAX) return `Entre $${MIN} e $${MAX.toLocaleString("pt-BR")}.`;
    return null;
  };

  const onAmountChange = (raw: string) => {
    setAmountStr(raw);
    const n = parseInt(raw.replace(/\D/g, ""), 10);
    setAmountError(Number.isNaN(n) ? "Valor inválido." : validateAmount(n));
  };

  const onPlaceBet = async () => {
    setFeedback(null);
    const n = parseInt(amountStr.replace(/\D/g, ""), 10);
    const err = validateAmount(n);
    setAmountError(err);
    if (err || !selectedTeamId) return;
    setSubmitting(true);
    try {
      await bettingApi.placeBet(matchId, selectedTeamId, n);
      setFeedback({ kind: "ok", text: "Aposta registrada." });
      await refresh();
    } catch (e) {
      setFeedback({ kind: "err", text: e instanceof Error ? e.message : "Falha ao apostar" });
    } finally {
      setSubmitting(false);
    }
  };

  const redActive = selectedTeamId === teamAId;
  const bluActive = selectedTeamId === teamBId;

  return (
    <div
      style={{
        marginBottom: spacing.lg,
        padding: spacing.lg,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        background: colors.bgCard,
        maxWidth: 480
      }}
    >
      <h3
        style={{
          margin: `0 0 ${spacing.md}px`,
          fontSize: typography.fontSize.lg,
          fontWeight: typography.fontWeight.semibold,
          color: colors.text
        }}
      >
        Apostas
      </h3>

      {loadError && (
        <p style={{ margin: 0, color: colors.error, fontSize: typography.fontSize.sm }}>{loadError}</p>
      )}

      {odds && !loadError && (
        <p style={{ margin: `0 0 ${spacing.md}px`, color: colors.textMuted, fontSize: typography.fontSize.sm }}>
          {teamAName} — {odds.teamA.odds}x · {teamBName} — {odds.teamB.odds}x
        </p>
      )}

      {existingBet ? (
        <div style={{ color: colors.textSecondary, fontSize: typography.fontSize.md }}>
          <p style={{ margin: `0 0 ${spacing.sm}px` }}>
            Sua aposta: <strong style={{ color: colors.text }}>{teamNameForBet(existingBet.teamId)}</strong> · $
            {existingBet.amount.toLocaleString("pt-BR")}
          </p>
          <p style={{ margin: 0 }}>
            Status: <strong style={{ color: colors.text }}>{betStatusLabel(existingBet.status)}</strong>
            {existingBet.payout != null && existingBet.status !== "pending" && (
              <> · Payout: ${existingBet.payout.toLocaleString("pt-BR")}</>
            )}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.md }}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSelectedTeamId(teamAId)}
              style={{
                flex: 1,
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radii.md,
                border: `2px solid ${redActive ? RED_SIDE_DISPLAY_COLORS.primary : colors.border}`,
                background: redActive ? RED_SIDE_DISPLAY_COLORS.bg : colors.bgInput,
                color: redActive ? RED_SIDE_DISPLAY_COLORS.primary : colors.textMuted,
                fontWeight: typography.fontWeight.semibold,
                fontSize: typography.fontSize.sm,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1
              }}
            >
              RED — {teamAName}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSelectedTeamId(teamBId)}
              style={{
                flex: 1,
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radii.md,
                border: `2px solid ${bluActive ? BLU_SIDE_DISPLAY_COLORS.primary : colors.border}`,
                background: bluActive ? BLU_SIDE_DISPLAY_COLORS.bg : colors.bgInput,
                color: bluActive ? BLU_SIDE_DISPLAY_COLORS.primary : colors.textMuted,
                fontWeight: typography.fontWeight.semibold,
                fontSize: typography.fontSize.sm,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1
              }}
            >
              BLU — {teamBName}
            </button>
          </div>

          <label
            style={{
              display: "block",
              marginBottom: spacing.sm,
              fontSize: typography.fontSize.sm,
              color: colors.textMuted
            }}
          >
            Valor ($)
            <input
              type="text"
              inputMode="numeric"
              disabled={disabled}
              value={amountStr}
              onChange={(e) => onAmountChange(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                marginTop: spacing.xs,
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radii.sm,
                border: `1px solid ${amountError ? colors.error : colors.borderInput}`,
                background: colors.bgInput,
                color: colors.text,
                fontSize: typography.fontSize.md,
                boxSizing: "border-box",
                opacity: disabled ? 0.55 : 1
              }}
            />
          </label>
          {amountError && (
            <p style={{ margin: `0 0 ${spacing.sm}px`, color: colors.error, fontSize: typography.fontSize.xs }}>
              {amountError}
            </p>
          )}

          {disabled && (
            <p style={{ margin: `0 0 ${spacing.sm}px`, color: colors.warning, fontSize: typography.fontSize.xs }}>
              Apostas fechadas enquanto a partida está em andamento ou já houve vencedor.
            </p>
          )}

          <button
            type="button"
            disabled={disabled || submitting || !!amountError}
            onClick={() => void onPlaceBet()}
            style={{
              marginTop: spacing.sm,
              padding: `${spacing.sm}px ${spacing.xl}px`,
              borderRadius: radii.md,
              border: "none",
              background: colors.primary,
              color: "#fff",
              fontWeight: typography.fontWeight.semibold,
              fontSize: typography.fontSize.sm,
              cursor: disabled || submitting || amountError ? "not-allowed" : "pointer",
              opacity: disabled || submitting || amountError ? 0.55 : 1
            }}
          >
            {submitting ? "Enviando…" : "Apostar"}
          </button>
        </>
      )}

      {feedback && (
        <p
          style={{
            margin: `${spacing.md}px 0 0`,
            fontSize: typography.fontSize.sm,
            color: feedback.kind === "ok" ? colors.success : colors.error
          }}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
