import { getPlayerTotal } from "../../shared/mvpMock";
import type { BotPlayer } from "./types";

/** Esquema de raridade por pontuação */
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

const STATS: { key: keyof Pick<BotPlayer, "aim" | "reflex" | "decision" | "composure">; abbrev: string }[] = [
  { key: "aim", abbrev: "PRE" },
  { key: "reflex", abbrev: "REF" },
  { key: "decision", abbrev: "INT" },
  { key: "composure", abbrev: "COM" }
];

const ROLE_DISPLAY: Record<BotPlayer["role"], string> = {
  Sniper: "Sniper",
  Entry: "Entry",
  Support: "Support",
  Lurker: "Lurker",
  IGL: "IGL"
};

/** Cor única por role (padronizada, independente da raridade) */
const ROLE_COLORS: Record<BotPlayer["role"], string> = {
  Sniper: "#06b6d4",
  Entry: "#f97316",
  Support: "#10b981",
  Lurker: "#6366f1",
  IGL: "#eab308"
};

const TEXT_MUTED = "#64748b";
const TEXT_ATTR = "#94a3b8";

/** Fonte do nickname: maior possível para caber em 1 linha (~90px úteis no card compacto) */
const getNicknameFontSize = (name: string) => {
  const len = name.length;
  if (len <= 5) return 14;
  if (len <= 7) return 13;
  if (len <= 9) return 12;
  if (len <= 11) return 11;
  if (len <= 14) return 10;
  return 9;
};

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil", US: "EUA", GB: "Reino Unido", DK: "Dinamarca", SE: "Suécia", PL: "Polônia", UA: "Ucrânia",
  RU: "Rússia", FR: "França", DE: "Alemanha", KR: "Coreia do Sul", PT: "Portugal",
  AU: "Austrália", CA: "Canadá", ES: "Espanha", FI: "Finlândia", NO: "Noruega",
  TR: "Turquia", CZ: "Tchéquia", IL: "Israel"
};

const AVATARS = ["/avatars/avatar-1.png", "/avatars/avatar-2.png", "/avatars/avatar-3.png", "/avatars/avatar-4.png", "/avatars/avatar-5.png"];

const getAvatarForPlayer = (player: BotPlayer) => {
  if (player.avatarUrl) return player.avatarUrl;
  const idx = player.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0) % AVATARS.length;
  return AVATARS[idx];
};

const getFlagUrl = (code: string) => {
  if (!code || code.length !== 2) return null;
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};

/** Logo minimalista CS Manager: miras + badge */
const GameLogo = ({ size = 28, accent = "#94a3b8" }: { size?: number; accent?: string }) => (
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
  player: BotPlayer;
  variant: "starter" | "bench" | "market";
  onSwapInitiate?: () => void;
  onSwapTargetClick?: () => void;
  isSwapTarget?: boolean;
  isSelected?: boolean;
  /** Modo mercado: preço e botão Comprar */
  price?: number;
  onBuy?: () => void;
  canAfford?: boolean;
  /** Vender jogador de volta ao mercado (botão canto inferior esquerdo) */
  onSell?: () => void;
};

export const PlayerCard = ({ player, variant, onSwapInitiate, onSwapTargetClick, isSwapTarget, isSelected, price, onBuy, canAfford, onSell }: Props) => {
  const total = getPlayerTotal(player);
  const rarity = getRarity(total);
  const k = player.kills ?? 0;
  const d = player.deaths ?? 0;
  const a = player.assists ?? 0;

  const borderColor = isSwapTarget ? "#3b82f6" : isSelected ? "#60a5fa" : rarity.primary;
  const shadowColor = isSwapTarget ? "#3b82f6" : isSelected ? "#60a5fa" : rarity.glow;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 108,
        minHeight: 168,
        background: `linear-gradient(180deg, ${rarity.tint} 0%, #0f1419 6%, #0a0d10 100%)`,
        borderRadius: 8,
        border: `2px solid ${borderColor}`,
        borderTopWidth: 3,
        display: "flex",
        flexDirection: "column",
        padding: "6px 8px 8px",
        minWidth: 0,
        cursor: onSwapTargetClick ? "pointer" : undefined,
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: variant === "starter"
          ? `0 4px 16px rgba(0,0,0,0.4), 0 0 12px ${shadowColor}, 0 0 0 1px ${rarity.dim}`
          : variant === "market"
            ? `0 0 8px ${shadowColor}, 0 0 0 1px ${rarity.dim}`
            : `0 0 8px ${shadowColor}`
      }}
      onClick={onSwapTargetClick}
      role={onSwapTargetClick ? "button" : undefined}
      title={`${rarity.name} · ${total}${onSwapTargetClick ? " · Clique para trocar" : ""}`}
    >
      {/* Esquerda: pontuação, role, nacionalidade | Direita: imagem do jogador */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: rarity.primary,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "Georgia, 'Times New Roman', serif",
              lineHeight: 1.1
            }}
          >
            {total}
          </span>
          <span style={{ fontSize: 10, color: ROLE_COLORS[player.role], fontWeight: 600 }}>{ROLE_DISPLAY[player.role]}</span>
          {player.nationality && getFlagUrl(player.nationality) ? (
            <img
              src={getFlagUrl(player.nationality)!}
              alt=""
              style={{ width: 15, height: 10, objectFit: "cover", borderRadius: 2 }}
              title={COUNTRY_NAMES[player.nationality] || player.nationality}
              loading="lazy"
            />
          ) : null}
        </div>
        <div style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}>
          <img
            src={getAvatarForPlayer(player)}
            alt=""
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
              border: `2px solid ${rarity.dim}`,
              background: "rgba(30, 41, 59, 0.8)"
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.visibility = "hidden";
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div
            aria-hidden="true"
            style={{
              display: "none",
              position: "absolute",
              inset: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${rarity.glow} 0%, ${rarity.dim} 100%)`,
              border: `2px solid ${rarity.dim}`,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: rarity.primary
            }}
          >
            {player.name.charAt(0)}
          </div>
        </div>
      </div>

      {/* Nickname — destaque, ocupa boa parte do card, reduz fonte se longo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
          minHeight: 20,
          width: "100%",
          padding: "0 4px"
        }}
      >
        <strong
          style={{
            fontSize: getNicknameFontSize(player.name),
            fontWeight: 800,
            color: "#ffffff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            letterSpacing: 0.2,
            maxWidth: "100%"
          }}
        >
          {player.name}
        </strong>
      </div>

      {/* Atributos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        gap: "3px 10px",
        marginBottom: 6,
          flex: 1
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {STATS.slice(0, 2).map(({ key, abbrev }) => (
            <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_ATTR, fontVariantNumeric: "tabular-nums" }}>
                {player[key]}
              </span>
              <span style={{ fontSize: 9, color: TEXT_MUTED }}>{abbrev.toLowerCase()}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {STATS.slice(2, 4).map(({ key, abbrev }) => (
            <div key={key} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_ATTR, fontVariantNumeric: "tabular-nums" }}>
                {player[key]}
              </span>
              <span style={{ fontSize: 9, color: TEXT_MUTED }}>{abbrev.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logo do game */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
        <GameLogo size={14} accent={TEXT_MUTED} />
      </div>

      {(k > 0 || d > 0 || a > 0) && variant !== "market" && (
        <div style={{ marginBottom: 2, fontSize: 9, color: TEXT_MUTED, fontVariantNumeric: "tabular-nums" }}>
          K/D/A {k}/{d}/{a}
        </div>
      )}

      {variant === "market" && price != null && onBuy != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", textAlign: "center" }}>
            {price} $
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
            disabled={canAfford === false}
            style={{
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 600,
              background: canAfford ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" : "#334155",
              border: "none",
              borderRadius: 8,
              color: canAfford ? "#fff" : "#94a3b8",
              cursor: canAfford ? "pointer" : "not-allowed"
            }}
          >
            {canAfford === false ? "Saldo insuficiente" : "Comprar"}
          </button>
        </div>
      )}

      {onSell && variant !== "market" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSell();
          }}
          style={{
            position: "absolute",
            bottom: 4,
            left: 4,
            padding: "3px 6px",
            fontSize: 8,
            fontWeight: 600,
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: 4,
            color: "#94a3b8",
            cursor: "pointer",
            whiteSpace: "nowrap"
          }}
          title="Vender e enviar ao mercado"
        >
          vender
        </button>
      )}

      {onSwapInitiate && variant !== "market" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwapInitiate();
          }}
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            padding: "3px 6px",
            fontSize: 8,
            fontWeight: 600,
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: 4,
            color: "#94a3b8",
            cursor: "pointer",
            whiteSpace: "nowrap"
          }}
          title="Trocar com reserva/titular"
        >
          trocar
        </button>
      )}
    </div>
  );
};
