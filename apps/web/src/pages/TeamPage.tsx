import { TeamPanel, useUserTeam } from "../features/team";
import { useAuth } from "../features/auth";
import { useMarket } from "../features/market";
import { api } from "../shared/apiClient";
import { getSellPrice } from "../features/market/marketUtils";
import { getPlayerTotal } from "../shared/mvpMock";

export const TeamPage = () => {
  const { team, swapPlayers, updateTeamName, updateTeamRecord, updatePlayer, removePlayer, teamId, isFromApi, refreshTeam } = useUserTeam();
  const { addWallet } = useMarket();
  const { fetchMe } = useAuth();

  const handleSell = async (player: import("../features/team/types").BotPlayer) => {
    if (isFromApi && teamId) {
      try {
        await api.post(`/team/${teamId}/players/${player.id}/sell`, {});
        await Promise.all([fetchMe(), refreshTeam()]);
        return;
      } catch {
        // fallback to local
      }
    }
    const price = getSellPrice(player.id, getPlayerTotal(player));
    removePlayer(player.id);
    addWallet(price);
  };

  return (
    <section style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>Meu time</h2>
      <p style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
        Titulares, reservas e trocas.
      </p>
      <TeamPanel
        team={team}
        onSwap={swapPlayers}
        onUpdateTeamName={updateTeamName}
        onUpdateTeamRecord={updateTeamRecord}
        onUpdatePlayer={updatePlayer}
        onSell={handleSell}
      />
    </section>
  );
};
