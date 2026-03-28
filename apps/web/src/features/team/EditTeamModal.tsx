import { useState, useEffect, useMemo } from "react";
import type { BotPlayer, UserTeam } from "./types";
import { PlayerCard } from "./PlayerCard";
import { EditPlayerModal } from "./EditPlayerModal";
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
  onClose: () => void;
};

export const EditTeamModal = ({
  team,
  onSwap,
  onUpdateTeamName,
  onUpdateTeamRecord,
  onUpdatePlayer,
  onSell,
  onClose
}: Props) => {
  const [swapMode, setSwapMode] = useState<{ player: BotPlayer; variant: "starter" | "bench" } | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<BotPlayer | null>(null);
  const [teamName, setTeamName] = useState(team.name);
  const [benchSort, setBenchSort] = useState<BenchSort>("pontuacao-desc");

  const sortedBench = useMemo(() => sortBench(team.bench, benchSort), [team.bench, benchSort]);
  const [wins, setWins] = useState(String(team.record.wins));
  const [losses, setLosses] = useState(String(team.record.losses));

  useEffect(() => {
    setTeamName(team.name);
    setWins(String(team.record.wins));
    setLosses(String(team.record.losses));
  }, [team]);

  const handleSwapClick = (player: BotPlayer, variant: "starter" | "bench") => {
    if (!swapMode) {
      setSwapMode({ player, variant });
      return;
    }
    if (swapMode.variant === "starter" && variant === "bench") {
      onSwap(swapMode.player, player);
      setSwapMode(null);
    } else if (swapMode.variant === "bench" && variant === "starter") {
      onSwap(player, swapMode.player);
      setSwapMode(null);
    } else {
      setSwapMode({ player, variant });
    }
  };

  const handleSave = () => {
    onUpdateTeamName(teamName.trim() || team.name);
    onUpdateTeamRecord({
      wins: Math.max(0, parseInt(wins, 10) || 0),
      losses: Math.max(0, parseInt(losses, 10) || 0)
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "clamp(12px, 3vw, 24px)"
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal
      aria-labelledby="edit-team-title"
    >
      <div
        style={{
          background: "linear-gradient(165deg, #111722 0%, #0c1018 100%)",
          border: "1px solid #2a3142",
          borderRadius: 16,
          padding: 24,
          width: "min(720px, calc(100vw - 32px))",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h3 id="edit-team-title" style={{ margin: 0, fontSize: 20, color: "#e2e8f0" }}>
            Editar time
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              background: "rgba(148, 163, 184, 0.1)",
              border: "1px solid #475569",
              borderRadius: 8,
              color: "#94a3b8",
              cursor: "pointer"
            }}
          >
            Fechar
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Nome do time</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#0c1018",
              border: "1px solid #2a3142",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 16
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Vitórias</label>
            <input
              type="number"
              min={0}
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#0c1018",
                border: "1px solid #2a3142",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>Derrotas</label>
            <input
              type="number"
              min={0}
              value={losses}
              onChange={(e) => setLosses(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "#0c1018",
                border: "1px solid #2a3142",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 14
              }}
            />
          </div>
        </div>

        {swapMode && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(59, 130, 246, 0.15)",
              borderRadius: 8,
              border: "1px solid rgba(59, 130, 246, 0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8
            }}
          >
            <span style={{ fontSize: 13, color: "#93c5fd" }}>
              Clique em um jogador {swapMode.variant === "starter" ? "da reserva" : "titular"} para trocar com {swapMode.player.name}.
            </span>
            <button
              type="button"
              onClick={() => setSwapMode(null)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #ef4444",
                borderRadius: 6,
                color: "#f87171",
                cursor: "pointer"
              }}
            >
              Cancelar troca
            </button>
          </div>
        )}

        <section style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Titulares (5)
          </h4>
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
                <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", maxWidth: 108, minWidth: 0 }}>
                  <div
                    style={{ cursor: isTarget ? "pointer" : undefined, width: "100%" }}
                    onClick={isTarget ? () => handleSwapClick(p, "starter") : undefined}
                    role={isTarget ? "button" : undefined}
                  >
                    <PlayerCard
                      player={p}
                      variant="starter"
                      onSwapInitiate={!isTarget ? () => handleSwapClick(p, "starter") : undefined}
                      onSwapTargetClick={undefined}
                      isSwapTarget={isTarget}
                      isSelected={isSelected}
                      onSell={onSell ? () => onSell(p) : undefined}
                    />
                  </div>
                <button
                  type="button"
                  onClick={() => setEditingPlayer(p)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "transparent",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    color: "#94a3b8",
                    cursor: "pointer"
                  }}
                >
                  editar
                </button>
              </div>
            );
          })}
          </div>
        </section>

        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>
              Reservas ({team.bench.length})
            </h4>
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
                <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", maxWidth: 108, minWidth: 0 }}>
                  <div
                    style={{ cursor: isTarget ? "pointer" : undefined, width: "100%" }}
                    onClick={isTarget ? () => handleSwapClick(p, "bench") : undefined}
                    role={isTarget ? "button" : undefined}
                  >
                    <PlayerCard
                      player={p}
                      variant="bench"
                      onSwapInitiate={!isTarget ? () => handleSwapClick(p, "bench") : undefined}
                      onSwapTargetClick={undefined}
                      isSwapTarget={isTarget}
                      isSelected={isSelected}
                      onSell={onSell ? () => onSell(p) : undefined}
                    />
                  </div>
                <button
                  type="button"
                  onClick={() => setEditingPlayer(p)}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "transparent",
                    border: "1px solid #475569",
                    borderRadius: 6,
                    color: "#94a3b8",
                    cursor: "pointer"
                  }}
                >
                  editar
                </button>
              </div>
            );
          })}
          </div>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              background: "rgba(148, 163, 184, 0.1)",
              border: "1px solid #475569",
              borderRadius: 8,
              color: "#94a3b8",
              cursor: "pointer"
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              background: `rgba(212, 175, 55, 0.25)`,
              border: `1px solid ${GOLD_DIM}`,
              borderRadius: 8,
              color: "#d4af37",
              cursor: "pointer"
            }}
          >
            Salvar alterações
          </button>
        </div>
      </div>

      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          onSave={(updates) => {
            onUpdatePlayer(editingPlayer.id, updates);
            setEditingPlayer(null);
          }}
          onClose={() => setEditingPlayer(null)}
        />
      )}
    </div>
  );
};
