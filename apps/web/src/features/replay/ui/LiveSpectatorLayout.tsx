import type { MatchState } from "../types";
import { GameCanvas } from "./GameCanvas";
import { MatchHUD } from "./MatchHUD";
import { RoundEndBanner } from "./RoundEndBanner";
import { TeamPanel } from "./TeamPanel";

/** Vista só leitura: placar, painéis dos times e mapa (sem controles nem log). */
export function LiveSpectatorLayout({ state }: { state: MatchState }) {
  return (
    <>
      <MatchHUD state={state} />
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "minmax(200px, 1fr) minmax(0, 3.2fr) minmax(200px, 1fr)",
          alignItems: "start"
        }}
      >
        <TeamPanel state={state} side="RED" />
        <div style={{ position: "relative", minWidth: 0, alignSelf: "start" }}>
          <GameCanvas state={state} />
          <RoundEndBanner state={state} />
        </div>
        <TeamPanel state={state} side="BLU" />
      </div>
    </>
  );
}
