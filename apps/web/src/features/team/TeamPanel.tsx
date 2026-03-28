import { useState, useMemo } from "react";
import type { BotPlayer, UserTeam } from "./types";
import { PlayerCard } from "./PlayerCard";
import { EditTeamModal } from "./EditTeamModal";
import { getPlayerTotal } from "../../shared/mvpMock";

const GOLD_DIM = "rgba(212, 175, 55, 0.85)";

const ROLE_ORDER: Record<BotPlayer["role"], number> = {
  Entry: 0,
  IGL: 1,
  Lurker: 2,
  Sniper: 3,
  Support: 4
};

type BenchSort = "pontuacao-desc" | "pontuacao-asc" | "role" | "nome" | "nacionalidade";

const sortBench = (bench: BotPlayer[], sort: BenchSort): BotPlayer[] => {
  const sorted = [...bench];
  switch (sort) {
    case "pontuacao-desc":
      return sorted.sort((a, b) => getPlayerTotal(b) - getPlayerTotal(a));
    case "pontuacao-asc":
      return sorted.sort((a, b) => getPlayerTotal(a) - getPlayerTotal(b));
    case "role":
      return sorted.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
    case "nome":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "nacionalidade":
      return sorted.sort((a, b) => (a.nationality ?? "").localeCompare(b.nationality ?? ""));
    default:
      return sorted;
  }
};

type Props = {
  team: UserTeam;
  onSwap: (starter: BotPlayer, benchPlayer: BotPlayer) => void;
  onUpdateTeamName: (name: string) => void;
  onUpdateTeamRecord: (record: { wins: number; losses: number }) => void;
  onUpdatePlayer: (playerId: string, updates: Partial<BotPlayer>) => void;
  onSell?: (player: BotPlayer) => void;
};

export const TeamPanel = ({ team, onSwap, onUpdateTeamName, onUpdateTeamRecord, onUpdatePlayer, onSell }: Props) => {
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [swapMode, setSwapMode] = useState<{ player: BotPlayer; variant: "starter" | "bench" } | null>(null);
  const [benchSort, setBenchSort] = useState<BenchSort>("pontuacao-desc");

  const sortedBench = useMemo(() => sortBench(team.bench, benchSort), [team.bench, benchSort]);

  const handleSwapComplete = (targetPlayer: BotPlayer) => {
    if (!swapMode) return;
    if (swapMode.variant === "starter") {
      onSwap(swapMode.player, targetPlayer);
    } else {
      onSwap(targetPlayer, swapMode.player);
    }
    setSwapMode(null);
  };

  return (
    <div
      style={{
        background: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",
        border: "1px solid #2a3142",
        borderRadius: 16,
        padding: "clamp(16px, 4vw, 24px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        overflow: "hidden"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#e2e8f0", letterSpacing: 0.3 }}>
            {team.name}
          </h2>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 14 }}>
            {team.record.wins} vitórias · {team.record.losses} derrotas
          </p>
        </div>
        {swapMode && (
          <button
            type="button"
            onClick={() => setSwapMode(null)}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid #ef4444",
              borderRadius: 8,
              color: "#f87171",
              cursor: "pointer"
            }}
          >
            Cancelar troca
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditTeamOpen(true)}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            background: `rgba(212, 175, 55, 0.2)`,
            border: `1px solid ${GOLD_DIM}`,
            borderRadius: 8,
            color: "#d4af37",
            cursor: "pointer"
          }}
        >
          Editar time
        </button>
      </div>

      <section style={{ marginBottom: 24 }}>
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
          Titulares (5)
        </h3>
        {swapMode && swapMode.variant === "starter" && (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#93c5fd" }}>
            Clique em um reservista para trocar com {swapMode.player.name}.
          </p>
        )}
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
          {team.starters.map((p) => {
            const isTarget = swapMode?.variant === "bench";
            const isSelected = swapMode?.variant === "starter" && swapMode?.player.id === p.id;
            return (
              <div
                key={p.id}
                style={{
                  width: "100%",
                  maxWidth: 108,
                  minWidth: 0,
                  cursor: isTarget ? "pointer" : undefined
                }}
                onClick={isTarget ? () => handleSwapComplete(p) : undefined}
                role={isTarget ? "button" : undefined}
              >
                <PlayerCard
                  player={p}
                  variant="starter"
                  onSwapInitiate={!isTarget ? () => setSwapMode({ player: p, variant: "starter" }) : undefined}
                  onSwapTargetClick={undefined}
                  isSwapTarget={isTarget}
                  isSelected={isSelected}
                  onSell={onSell ? () => onSell(p) : undefined}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: 0.6
            }}
          >
            Reservas ({team.bench.length})
          </h3>
          <select
            value={benchSort}
            onChange={(e) => setBenchSort(e.target.value as BenchSort)}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              background: "#0c1018",
              border: "1px solid #2a3142",
              borderRadius: 6,
              color: "#94a3b8",
              cursor: "pointer"
            }}
            title="Ordenar reservas"
          >
            <option value="pontuacao-desc">Pontuação (maior)</option>
            <option value="pontuacao-asc">Pontuação (menor)</option>
            <option value="role">Role</option>
            <option value="nome">Nome</option>
            <option value="nacionalidade">Nacionalidade</option>
          </select>
        </div>
        {swapMode && swapMode.variant === "bench" && (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#93c5fd" }}>
            Clique em um titular para trocar com {swapMode.player.name}.
          </p>
        )}
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
          {sortedBench.map((p) => {
            const isTarget = swapMode?.variant === "starter";
            const isSelected = swapMode?.variant === "bench" && swapMode?.player.id === p.id;
            return (
              <div
                key={p.id}
                style={{
                  width: "100%",
                  maxWidth: 108,
                  minWidth: 0,
                  cursor: isTarget ? "pointer" : undefined
                }}
                onClick={isTarget ? () => handleSwapComplete(p) : undefined}
                role={isTarget ? "button" : undefined}
              >
                <PlayerCard
                  player={p}
                  variant="bench"
                  onSwapInitiate={!isTarget ? () => setSwapMode({ player: p, variant: "bench" }) : undefined}
                  onSwapTargetClick={undefined}
                  isSwapTarget={isTarget}
                  isSelected={isSelected}
                  onSell={onSell ? () => onSell(p) : undefined}
                />
              </div>
            );
          })}
        </div>
      </section>

      {editTeamOpen && (
        <EditTeamModal
          team={team}
          onSwap={onSwap}
          onUpdateTeamName={onUpdateTeamName}
          onUpdateTeamRecord={onUpdateTeamRecord}
          onUpdatePlayer={onUpdatePlayer}
          onSell={onSell}
          onClose={() => setEditTeamOpen(false)}
        />
      )}
    </div>
  );
};
