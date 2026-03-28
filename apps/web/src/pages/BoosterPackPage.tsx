import { useState } from "react";
import { useMarket } from "../features/market";
import { PlayerCard } from "../features/team/PlayerCard";
import type { BotPlayer } from "../features/team/types";

export const BoosterPackPage = () => {
  const { walletBalance, purchaseBoosterPack, BOOSTER_PACK_PRICE } = useMarket();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openedHistory, setOpenedHistory] = useState<BotPlayer[]>([]);

  const canAfford = walletBalance >= BOOSTER_PACK_PRICE;

  const handleOpenPack = async () => {
    if (!canAfford || loading) return;
    setLoading(true);
    setFeedback(null);
    try {
      const result = await purchaseBoosterPack();
      const newPlayers = result.success ? result.players : undefined;
      if (newPlayers?.length) {
        setOpenedHistory((prev) => [...prev, ...newPlayers]);
        setFeedback(`Você recebeu 5 jogadores!`);
      } else {
        setFeedback(
          result.reason === "insufficient_balance"
            ? "Saldo insuficiente"
            : result.reason === "not_logged_in"
              ? "Faça login para comprar"
              : "Não foi possível abrir o pacote"
        );
      }
    } catch {
      setFeedback("Erro ao abrir o pacote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 24
        }}
      >
        <div>
          <h2 style={{ margin: 0, marginBottom: 4 }}>Booster Packs</h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
            Pague {BOOSTER_PACK_PRICE} e receba 5 jogadores aleatórios para o seu time.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>
            ${walletBalance.toLocaleString("pt-BR")}
          </span>
          {feedback && (
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                background: feedback.includes("recebeu")
                  ? "rgba(34,197,94,0.2)"
                  : "rgba(239,68,68,0.2)",
                color: feedback.includes("recebeu") ? "#4ade80" : "#f87171"
              }}
            >
              {feedback}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28
        }}
      >
        <div
          style={{
            padding: "36px 48px",
            borderRadius: 16,
            border: "2px solid #334155",
            background: "linear-gradient(165deg, #1e293b 0%, #0f172a 100%)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            textAlign: "center"
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 1.2
            }}
          >
            5 jogadores aleatórios
          </p>
          <p style={{ margin: "8px 0 16px", fontSize: 14, color: "#94a3b8" }}>
            Oportunidade de conseguir jogadores raros e épicos!
          </p>
          <button
            type="button"
            onClick={handleOpenPack}
            disabled={!canAfford || loading}
            style={{
              padding: "16px 40px",
              fontSize: 16,
              fontWeight: 700,
              borderRadius: 10,
              border: "1px solid #475569",
              background: canAfford
                ? "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)"
                : "#334155",
              color: "#fff",
              cursor: canAfford && !loading ? "pointer" : "not-allowed",
              opacity: canAfford && !loading ? 1 : 0.6
            }}
          >
            {loading ? "Abrindo..." : `Comprar por $${BOOSTER_PACK_PRICE}`}
          </button>
        </div>

        {openedHistory.length > 0 && (
          <div
            style={{
              width: "100%",
              background: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",
              border: "1px solid #2a3142",
              borderRadius: 16,
              padding: "clamp(16px, 4vw, 24px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              overflow: "hidden"
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                fontWeight: 600,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: 0.6
              }}
            >
              Jogadores recebidos ({openedHistory.length})
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gridAutoRows: "min-content",
                gap: 12,
                justifyItems: "center",
                alignItems: "start"
              }}
            >
              {openedHistory.map((player, index) => (
                <div
                  key={`${index}-${player.id}`}
                  style={{
                    width: "100%",
                    maxWidth: 108,
                    minWidth: 0
                  }}
                >
                  <PlayerCard player={player} variant="bench" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
