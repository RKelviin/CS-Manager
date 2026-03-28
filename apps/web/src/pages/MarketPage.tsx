import { useState } from "react";
import { useMarket } from "../features/market";
import { MarketPlayerCard } from "../features/market/MarketPlayerCard";
import type { MarketFilters, MarketSort } from "../features/market/types";

const ROLE_OPTIONS: { value: MarketFilters["role"]; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "Entry", label: "Entry" },
  { value: "IGL", label: "IGL" },
  { value: "Lurker", label: "Lurker" },
  { value: "Sniper", label: "Sniper" },
  { value: "Support", label: "Support" }
];

const SORT_OPTIONS: { value: MarketSort; label: string }[] = [
  { value: "price-asc", label: "Preço (menor)" },
  { value: "price-desc", label: "Preço (maior)" },
  { value: "rating-desc", label: "Pontuação (maior)" },
  { value: "rating-asc", label: "Pontuação (menor)" },
  { value: "name", label: "Nome" }
];

export const MarketPage = () => {
  const { listings, walletBalance, filters, sort, setFilters, setSort, purchase } = useMarket();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleBuy = async (listing: import("../features/market/types").MarketListing) => {
    const result = await Promise.resolve(purchase(listing));
    if (result.success) {
      setFeedback(`${listing.name} adicionado ao seu time!`);
      setTimeout(() => setFeedback(null), 2500);
    } else {
      const msg =
        result.reason === "insufficient_balance"
          ? "Saldo insuficiente"
          : result.reason === "team_full"
            ? "Banco cheio"
            : "Jogador já está no seu time";
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: 4 }}>Mercado</h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: 14 }}>
            Compre jogadores para seu time.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>${walletBalance.toLocaleString("pt-BR")}</span>
          {feedback && (
            <span
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 13,
                background: feedback.includes("adicionado") ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                color: feedback.includes("adicionado") ? "#4ade80" : "#f87171"
              }}
            >
              {feedback}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select
          value={filters.role ?? ""}
          onChange={(e) => setFilters({ ...filters, role: (e.target.value || undefined) as MarketFilters["role"] })}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            background: "#0c1018",
            border: "1px solid #2a3142",
            borderRadius: 8,
            color: "#e2e8f0",
            cursor: "pointer"
          }}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.label} value={o.value ?? ""}>{o.label}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as MarketSort)}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            background: "#0c1018",
            border: "1px solid #2a3142",
            borderRadius: 8,
            color: "#e2e8f0",
            cursor: "pointer"
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
        {listings.length} jogador{listings.length !== 1 ? "es" : ""} disponíve{listings.length !== 1 ? "is" : "l"}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 12,
          justifyItems: "center",
          alignItems: "start"
        }}
      >
        {listings.map((listing) => (
          <MarketPlayerCard
            key={listing.id}
            listing={listing}
            onBuy={() => handleBuy(listing)}
            canAfford={walletBalance >= (listing.price ?? 0)}
          />
        ))}
      </div>

      {listings.length === 0 && (
        <p style={{ color: "#64748b", marginTop: 24 }}>
          Nenhum jogador disponível no momento. Sua equipe pode estar completa ou você já possui todos os jogadores listados.
        </p>
      )}
    </section>
  );
};
