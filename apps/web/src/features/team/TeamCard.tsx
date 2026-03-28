import { getPlayerTotal } from "../../shared/mvpMock";
import type { BotPlayer } from "./types";

/** Mesmo esquema de raridade do PlayerCard — média dos jogadores define a raridade do time */
const RARITY_TIERS = [
  { min: 90, primary: "#e8b923", dim: "rgba(232, 185, 35, 0.9)", glow: "rgba(232, 185, 35, 0.4)", tint: "rgba(232, 185, 35, 0.12)", name: "Lendário" },
  { min: 80, primary: "#a855f7", dim: "rgba(168, 85, 247, 0.9)", glow: "rgba(168, 85, 247, 0.35)", tint: "rgba(168, 85, 247, 0.1)", name: "Épico" },
  { min: 70, primary: "#3b82f6", dim: "rgba(59, 130, 246, 0.9)", glow: "rgba(59, 130, 246, 0.3)", tint: "rgba(59, 130, 246, 0.08)", name: "Raro" },
  { min: 60, primary: "#22c55e", dim: "rgba(34, 197, 94, 0.9)", glow: "rgba(34, 197, 94, 0.25)", tint: "rgba(34, 197, 94, 0.06)", name: "Incomum" },
  { min: 50, primary: "#94a3b8", dim: "rgba(148, 163, 184, 0.85)", glow: "rgba(148, 163, 184, 0.2)", tint: "rgba(148, 163, 184, 0.05)", name: "Comum" },
  { min: 0, primary: "#64748b", dim: "rgba(100, 116, 139, 0.8)", glow: "rgba(100, 116, 139, 0.15)", tint: "rgba(100, 116, 139, 0.04)", name: "Básico" }
] as const;

const getRarity = (total: number) => {
  for (const tier of RARITY_TIERS) {
    if (total >= tier.min) return tier;
  }
  return RARITY_TIERS[RARITY_TIERS.length - 1];
};

const getTeamAverage = (starters: BotPlayer[]) => {
  if (starters.length === 0) return 0;
  const sum = starters.reduce((s, p) => s + getPlayerTotal(p), 0);
  return Math.round(sum / starters.length);
};

/** Logo minimalista */
const GameLogo = ({ size = 20, accent = "#94a3b8" }: { size?: number; accent?: string }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="14" stroke={accent} strokeWidth="1.5" fill="rgba(15,20,25,0.9)" opacity={0.9} />
    <circle cx="16" cy="16" r="4" fill={accent} />
    <line x1="16" y1="4" x2="16" y2="10" stroke={accent} strokeWidth="1.2" opacity={0.9} />
    <line x1="16" y1="22" x2="16" y2="28" stroke={accent} strokeWidth="1.2" opacity={0.9} />
    <line x1="4" y1="16" x2="10" y2="16" stroke={accent} strokeWidth="1.2" opacity={0.9} />
    <line x1="22" y1="16" x2="28" y2="16" stroke={accent} strokeWidth="1.2" opacity={0.9} />
  </svg>
);

type Props = {
  teamName: string;
  starters: BotPlayer[];
  wins: number;
  losses: number;
  /** Pontos no campeonato (ranking) */
  points?: number;
  /** Posição no ranking (ex: 1 = #1) */
  position?: number;
  /** Nome do manager */
  managerName?: string;
  /** Saldo da carteira */
  balance?: number;
};

export const TeamCard = ({
  teamName,
  starters,
  wins,
  losses,
  points = 0,
  position,
  managerName,
  balance
}: Props) => {
  const avgScore = getTeamAverage(starters);
  const rarity = getRarity(avgScore);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 200,
        minHeight: 200,
        background: `linear-gradient(180deg, ${rarity.tint} 0%, #0f1419 6%, #0a0d10 100%)`,
        borderRadius: 8,
        border: `2px solid ${rarity.primary}`,
        borderTopWidth: 3,
        display: "flex",
        flexDirection: "column",
        padding: "12px 14px 14px",
        minWidth: 0,
        boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 12px ${rarity.glow}, 0 0 0 1px ${rarity.dim}`
      }}
      title={`${rarity.name} · média ${avgScore}`}
    >
      {/* Topo: pontuação média (define raridade) e badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: rarity.primary,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.1
            }}
          >
            {avgScore}
          </span>
          <div style={{ fontSize: 10, color: "rgba(148, 163, 184, 0.9)", marginTop: 2 }}>
            média
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: rarity.primary,
            background: "rgba(0,0,0,0.3)",
            padding: "4px 8px",
            borderRadius: 6
          }}
        >
          {rarity.name}
        </div>
      </div>

      {/* Nome do time */}
      <div
        style={{
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid rgba(148, 163, 184, 0.2)"
        }}
      >
        <strong
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#ffffff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            display: "block"
          }}
        >
          {teamName}
        </strong>
      </div>

      {/* Pontos e recorde */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>Pontos</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>
            {points} pts
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>Recorde</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: "#22c55e" }}>{wins}V</span>
            <span style={{ color: "#64748b", margin: "0 4px" }}>–</span>
            <span style={{ color: "#f87171" }}>{losses}D</span>
          </span>
        </div>
        {position != null && position >= 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Posição</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>#{position + 1}</span>
          </div>
        )}
        {managerName && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Manager</span>
            <span style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 100 }}>
              {managerName}
            </span>
          </div>
        )}
        {balance != null && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Saldo</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>
              ${balance.toLocaleString("pt-BR")}
            </span>
          </div>
        )}
      </div>

      {/* Logo */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: "auto", paddingTop: 8 }}>
        <GameLogo size={16} accent="rgba(100, 116, 139, 0.7)" />
      </div>
    </div>
  );
};
