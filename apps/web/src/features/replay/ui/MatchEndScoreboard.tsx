import type { MatchState, TeamSide } from "../types";
import type { Bot } from "../types";
import { formatKdr } from "../engine/matchEndStats";
import { getTeamDisplayColor } from "../engine/matchConstants";
import { roleLabel } from "../engine/roleCombat";

const teamColor = (side: TeamSide, state: MatchState) =>
  getTeamDisplayColor(side, state.round, "primary", state.teamAStartsAs);

const COL_LAYOUT = "minmax(72px, 1fr) 48px 68px 52px 44px";
const cellStyle = (hasBorder?: boolean) => ({
  width: "50%",
  verticalAlign: "middle",
  padding: "14px 20px",
  borderBottom: "1px solid rgba(51, 65, 85, 0.45)",
  ...(hasBorder && { borderRight: "1px solid rgba(51, 65, 85, 0.5)" })
});

const PlayerCell = ({ bot, color, hasBorder }: { bot: Bot; color: string; hasBorder?: boolean }) => {
  const kdr = formatKdr(bot.kills, bot.deaths);
  return (
    <td style={cellStyle(hasBorder)}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COL_LAYOUT,
          gap: "0 16px",
          alignItems: "center"
        }}
      >
        <span style={{ fontWeight: 700, color, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>
          {bot.name}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#94a3b8",
            textAlign: "center"
          }}
          title="Função"
        >
          {bot.displayRole ?? roleLabel(bot.role)}
        </span>
        <span
          style={{
            color: "#64748b",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            textAlign: "center"
          }}
        >
          {bot.kills} / {bot.deaths} / {bot.assists}
        </span>
        <span
          style={{
            color: "#94a3b8",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
            textAlign: "center"
          }}
        >
          {Math.round(bot.damageDealt ?? 0)}
        </span>
        <span
          style={{
            color: "#64748b",
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            textAlign: "center"
          }}
        >
          {kdr}
        </span>
      </div>
    </td>
  );
};

export const MatchEndScoreboard = ({ state }: { state: MatchState }) => {
  const slot = (id: string) => parseInt(id.split("-")[1] ?? "0", 10);
  const redBots = state.bots.filter((b) => b.team === "RED").sort((a, b) => slot(a.id) - slot(b.id));
  const bluBots = state.bots.filter((b) => b.team === "BLU").sort((a, b) => slot(a.id) - slot(b.id));

  return (
    <div
      style={{
        marginTop: 24,
        padding: "20px 24px 24px",
        maxHeight: "min(52vh, 460px)",
        overflow: "auto",
        borderRadius: 12,
        border: "1px solid #334155",
        background: "rgba(15, 23, 42, 0.5)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          color: "#e2e8f0",
          tableLayout: "fixed"
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #334155",
              background: "rgba(30, 41, 59, 0.4)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.8
            }}
          >
            <th
              style={{
                textAlign: "center",
                padding: "12px 20px",
                fontWeight: 700,
                width: "50%",
                color: teamColor("RED", state),
                borderRight: "1px solid rgba(51, 65, 85, 0.5)"
              }}
            >
              {state.teamAName}
            </th>
            <th
              style={{
                textAlign: "center",
                padding: "12px 20px",
                fontWeight: 700,
                width: "50%",
                color: teamColor("BLU", state)
              }}
            >
              {state.teamBName}
            </th>
          </tr>
          <tr
            style={{
              borderBottom: "2px solid #334155",
              background: "rgba(30, 41, 59, 0.25)",
              fontSize: 10,
              color: "#64748b",
              letterSpacing: 0.5
            }}
          >
            <th
              style={{
                padding: "8px 20px",
                fontWeight: 600,
                width: "50%",
                borderRight: "1px solid rgba(51, 65, 85, 0.5)"
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: COL_LAYOUT,
                  gap: "0 16px",
                  alignItems: "center"
                }}
              >
                <span>Nome</span>
                <span style={{ textAlign: "center" }}>Função</span>
                <span style={{ textAlign: "center" }}>KDA</span>
                <span style={{ textAlign: "center" }}>DMG</span>
                <span style={{ textAlign: "center" }}>KDR</span>
              </div>
            </th>
            <th
              style={{
                padding: "8px 20px",
                fontWeight: 600,
                width: "50%"
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: COL_LAYOUT,
                  gap: "0 16px",
                  alignItems: "center"
                }}
              >
                <span>Nome</span>
                <span style={{ textAlign: "center" }}>Função</span>
                <span style={{ textAlign: "center" }}>KDA</span>
                <span style={{ textAlign: "center" }}>DMG</span>
                <span style={{ textAlign: "center" }}>KDR</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4].map((i) => {
            const red = redBots[i];
            const blu = bluBots[i];
            if (!red || !blu) return null;
            return (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? "rgba(30, 41, 59, 0.2)" : "transparent"
                }}
              >
                <PlayerCell bot={red} color={teamColor("RED", state)} hasBorder />
                <PlayerCell bot={blu} color={teamColor("BLU", state)} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
