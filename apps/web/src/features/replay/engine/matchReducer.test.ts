import { describe, it, expect } from "vitest";
import { matchReducer, getDecisionOrder } from "./matchReducer";
import { createMatchState } from "./createMatchState";
import { getMapSync } from "../map/mapRegistry";

describe("getDecisionOrder", () => {
  const setup = {
    teamAName: "Time A",
    teamBName: "Time B",
    teamAPlayers: ["A1", "A2", "A3", "A4", "A5"],
    teamBPlayers: ["B1", "B2", "B3", "B4", "B5"],
    teamAStartsAs: "RED" as const,
    mapData: getMapSync("dust2")!
  };

  it("round 1: ordem RED0, BLU0, RED1, BLU1, ... (papel RED roster RED, papel BLU roster BLU)", () => {
    const state = createMatchState(setup);
    state.round = 1;
    const order = getDecisionOrder(state);
    expect(order.length).toBe(10);
    expect(order[0].team).toBe("RED");
    expect(order[0].id).toMatch(/red-0|RED-0/i);
    expect(order[1].team).toBe("BLU");
    expect(order[1].id).toMatch(/blu-0|BLU-0/i);
    expect(order[2].team).toBe("RED");
    expect(order[2].id).toMatch(/red-1|RED-1/i);
    expect(order[3].team).toBe("BLU");
  });

  it("round 2: rotacao — BLU roster primeiro", () => {
    const state = createMatchState(setup);
    state.round = 2;
    const order = getDecisionOrder(state);
    expect(order[0].team).toBe("BLU");
    expect(order[1].team).toBe("RED");
  });
});

describe("matchReducer", () => {
  const setup = {
    teamAName: "Time A",
    teamBName: "Time B",
    teamAPlayers: ["A1", "A2", "A3", "A4", "A5"],
    teamBPlayers: ["B1", "B2", "B3", "B4", "B5"],
    teamAStartsAs: "RED" as const,
    mapData: getMapSync("dust2")!
  };

  it("RESET preserva setup e zera estatisticas", () => {
    const initial = createMatchState(setup);
    const withScore = {
      ...initial,
      score: { RED: 3, BLU: 2 },
      round: 6,
      bots: initial.bots.map((b) => ({
        ...b,
        kills: 2,
        deaths: 1,
        assists: 1
      }))
    };
    const reset = matchReducer(withScore, { type: "RESET" });
    expect(reset.score).toEqual({ RED: 0, BLU: 0 });
    expect(reset.round).toBe(1);
    expect(reset.teamAName).toBe("Time A");
    expect(reset.teamBName).toBe("Time B");
    reset.bots.forEach((b) => {
      expect(b.kills).toBe(0);
      expect(b.deaths).toBe(0);
      expect(b.assists).toBe(0);
    });
  });

  it("START apos PAUSE retorna isRunning true", () => {
    const initial = createMatchState(setup);
    const paused = matchReducer(initial, { type: "START" });
    const ran = matchReducer(paused, { type: "PAUSE" });
    const resumed = matchReducer(ran, { type: "START" });
    expect(resumed.isRunning).toBe(true);
  });

  it("fim de partida em 7 pontos", () => {
    const initial = createMatchState(setup);
    const withSix = {
      ...initial,
      round: 8,
      score: { RED: 6, BLU: 0 },
      isRunning: true,
      bots: initial.bots.map((b) =>
        b.team === "BLU" ? { ...b, hp: 0 } : b
      )
    };
    let state = withSix;
    for (let t = 0; t < 300; t++) {
      state = matchReducer(state, { type: "TICK", deltaMs: 100 });
      if (state.matchWinner) break;
    }
    expect(state.matchWinner).toBe("RED");
    expect(state.score.RED).toBe(7);
  });
});
