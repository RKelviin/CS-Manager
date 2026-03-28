import type { MatchState, TeamSide } from "../types";
import {
  FIRST_ROUND_SECOND_HALF,
  getTeamDisplayColor,
  getCtTeamFromState,
  getTrTeamFromState
} from "../engine/matchConstants";
import { roleLabel } from "../engine/roleCombat";
import { HpBar } from "./HpBar";
import { ArmorLoadoutIcons, CarryC4Icon, DefuseKitIcon, WeaponIcon } from "./weaponIcons";

const moneyFmt = (n: number) => `$${n.toLocaleString("en-US")}`;

const getFlagUrl = (code: string) =>
  code && code.length === 2 ? `https://flagcdn.com/w40/${code.toLowerCase()}.png` : null;

/** Ícone de caveira por eliminação (ao lado do KDA) — discreto como colete/capacete */
const SkullIcon = ({ count, size = 13 }: { count: number; size?: number }) => {
  if (count <= 0) return null;
  const stroke = "currentColor";
  const common = { stroke, strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const } as const;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        color: "#94a3b8",
        opacity: 0.78,
        flexShrink: 0
      }}
      title={`${count} eliminaç${count === 1 ? "ão" : "ões"}`}
    >
      {Array.from({ length: Math.min(count, 5) }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-hidden="true">
          <path {...common} d="M12 2a9 9 0 00-9 9c0 2.5 1 4.5 2.5 6v3h13v-3c1.5-1.5 2.5-3.5 2.5-6a9 9 0 00-9-9z" />
          <circle cx="9" cy="12" r="1.8" fill={stroke} />
          <circle cx="15" cy="12" r="1.8" fill={stroke} />
          <path {...common} d="M9 18h6" />
        </svg>
      ))}
      {count > 5 && (
        <span style={{ fontSize: 9, color: "#94a3b8", opacity: 0.78, fontWeight: 500 }}>+{count - 5}</span>
      )}
    </span>
  );
};

const BLU_STRAT_LABELS: Record<string, string> = {
  default: "3-2",
  "stack-a": "Stack A",
  "stack-b": "Stack B",
  aggressive: "Aggressive",
  hold: "Hold",
  retake: "Retake",
  rotate: "Rotate"
};

const strategyLabel = (side: TeamSide, state: MatchState) => {
  if (side === "RED") return state.redStrategy;
  return BLU_STRAT_LABELS[state.bluStrategy] ?? state.bluStrategy;
};

/** Estrutura padrao para ambos os paineis: ordem identica; cores invertem no round 7 (2.º half). */
export const TeamPanel = ({ state, side }: { state: MatchState; side: TeamSide }) => {
  const bots = state.bots
    .filter((b) => b.team === side)
    .sort((a, b) => a.id.localeCompare(b.id));

  const border = getTeamDisplayColor(side, state.round, "border", state.teamAStartsAs);
  const bg = getTeamDisplayColor(side, state.round, "bg", state.teamAStartsAs);
  const isCt = side === getCtTeamFromState(state);
  const sideLabel = isCt ? "CT" : "TR";
  const showSideLabel = state.round >= FIRST_ROUND_SECOND_HALF;
  const moraleVal = state.morale?.[side] ?? 100;
  const moraleBarColor = moraleVal >= 70 ? "#22c55e" : moraleVal >= 40 ? "#fbbf24" : "#ef4444";

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 12,
        background: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        minWidth: 0
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 8,
          color: getTeamDisplayColor(side, state.round, "primary", state.teamAStartsAs),
          fontSize: 16,
          letterSpacing: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}
      >
        {side === "RED" ? state.teamAName : state.teamBName}
        {showSideLabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              opacity: 0.9,
              padding: "2px 6px",
              borderRadius: 4,
              background: getTeamDisplayColor(side, state.round, "bg", state.teamAStartsAs)
            }}
          >
            {sideLabel}
          </span>
        )}
      </h3>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: "1px solid #2a3142",
          textTransform: "uppercase",
          letterSpacing: 0.6
        }}
      >
        Estrategia: <span style={{ color: "#e2e8f0" }}>{strategyLabel(side, state)}</span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: "1px solid #2a3142",
          textTransform: "uppercase",
          letterSpacing: 0.6
        }}
      >
        <div style={{ marginBottom: 4 }}>
          Moral: <span style={{ color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{moraleVal}</span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: "#1e293b",
            overflow: "hidden"
          }}
        >
          <div style={{ width: `${moraleVal}%`, height: "100%", background: moraleBarColor, borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {bots.map((bot) => (
          <div
            key={bot.id}
            style={{
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: 8,
              background: bg,
              opacity: bot.hp <= 0 ? 0.45 : 1
            }}
          >
            {/* Linha 1: estrutura padrao — bandeira | nome | role | equip | dinheiro */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "nowrap",
                width: "100%"
              }}
              title={
                bot.role === "IGL"
                  ? "In-game leader: calls e prioriza trade no portador da C4"
                  : bot.role === "AWP"
                    ? "Sniper: longo alcance, dano alto, cadencia menor"
                    : "Rifle: entrada e duelos medio/curto"
              }
            >
              {bot.nationality && getFlagUrl(bot.nationality) ? (
                <img src={getFlagUrl(bot.nationality)!} alt="" style={{ width: 12, height: 8, objectFit: "cover", borderRadius: 1, flexShrink: 0 }} title={bot.nationality} loading="lazy" />
              ) : null}
              <strong style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bot.name}</strong>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, flexShrink: 0 }}>{bot.displayRole ?? roleLabel(bot.role)}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <ArmorLoadoutIcons armor={bot.armor} />
                {side === getTrTeamFromState(state) && bot.hasBomb && bot.hp > 0 && <CarryC4Icon size={14} />}
                {side === getCtTeamFromState(state) && bot.hasDefuseKit && bot.hp > 0 && <DefuseKitIcon size={12} />}
              </span>
              <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{moneyFmt(bot.money)}</span>
            </div>
            {/* Linha 2: Esquerda = Armamento | Eliminações | KDA. Direita = KDA | Eliminações | Armamento */}
            {(() => {
              const weaponBlock = (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                    flex: 1,
                    flexWrap: "nowrap",
                    overflow: "hidden"
                  }}
                >
                  <WeaponIcon weapon={bot.primaryWeapon} size={24} style={{ color: getTeamDisplayColor(side, state.round, "light", state.teamAStartsAs), flexShrink: 0 }} />
                  <span style={{ color: "#e2e8f0", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{bot.primaryWeapon}</span>
                </div>
              );
              const elimBlock = <SkullIcon count={bot.killsThisRound ?? bot.kills} />;
              const kdaBlock = (
                <span
                  style={{
                    color: "#cbd5e1",
                    fontSize: 11,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: 0.2
                  }}
                  title="Kills / Deaths / Assists"
                >
                  {bot.kills}/{bot.deaths}/{bot.assists}
                </span>
              );
              const isLeft = side === "RED";
              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 8,
                    flexWrap: "nowrap",
                    overflow: "hidden"
                  }}
                >
                  {isLeft ? (
                    <>
                      {weaponBlock}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{elimBlock}{kdaBlock}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>{kdaBlock}{elimBlock}</span>
                      {weaponBlock}
                    </>
                  )}
                </div>
              );
            })()}
            <HpBar hp={bot.hp} dead={bot.hp <= 0} />
            <div style={{ color: "#9fb0d9", fontSize: 11, marginTop: 6 }}>
              {side === getTrTeamFromState(state) && bot.hasBomb && bot.hp > 0 && state.plantProgressMs > 0 && (
                <span title="A plantar a C4">Plantando C4</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
