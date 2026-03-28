import { describe, it, expect } from "vitest";
import {
  chooseBluStrategyForRound,
  getCtSiteForBot,
  isCtDefendStrategy
} from "./ctStrategy";
import type { Bot, MatchState } from "../types";

const mkBot = (overrides: Partial<Bot> = {}): Bot =>
  ({
    id: "BLU-0",
    name: "CT",
    team: "BLU",
    role: "Rifler",
    x: 400,
    y: 100,
    hp: 100,
    money: 4000,
    primaryWeapon: "M4A4",
    armor: "vest_helmet",
    hasBomb: false,
    hasDefuseKit: true,
    targetX: 400,
    targetY: 150,
    ...overrides
  }) as Bot;

const mkState = (overrides: Partial<MatchState> = {}): MatchState =>
  ({
    round: 2,
    score: { RED: 0, BLU: 0 },
    tsExecuteSite: "site-a",
    teamAStartsAs: "TR",
    ...overrides
  }) as MatchState;

describe("getCtSiteForBot", () => {
  it("stack-a: todos em site-a", () => {
    for (let slot = 0; slot < 5; slot++) {
      expect(getCtSiteForBot(slot, "stack-a", "site-a")).toBe("site-a");
      expect(getCtSiteForBot(slot, "stack-a", "site-b")).toBe("site-a");
    }
  });

  it("stack-b: todos em site-b", () => {
    for (let slot = 0; slot < 5; slot++) {
      expect(getCtSiteForBot(slot, "stack-b", "site-a")).toBe("site-b");
      expect(getCtSiteForBot(slot, "stack-b", "site-b")).toBe("site-b");
    }
  });

  it("default: 3 no site exec, 2 no outro (slots 0,1,2 exec; 3,4 outro)", () => {
    expect(getCtSiteForBot(0, "default", "site-a")).toBe("site-a");
    expect(getCtSiteForBot(1, "default", "site-a")).toBe("site-a");
    expect(getCtSiteForBot(2, "default", "site-a")).toBe("site-a");
    expect(getCtSiteForBot(3, "default", "site-a")).toBe("site-b");
    expect(getCtSiteForBot(4, "default", "site-a")).toBe("site-b");

    expect(getCtSiteForBot(0, "default", "site-b")).toBe("site-b");
    expect(getCtSiteForBot(3, "default", "site-b")).toBe("site-a");
  });

  it("rotate: slots 0–1 no site plantado, demais no outro", () => {
    expect(getCtSiteForBot(0, "rotate", "site-a", "site-b")).toBe("site-b");
    expect(getCtSiteForBot(1, "rotate", "site-a", "site-b")).toBe("site-b");
    expect(getCtSiteForBot(2, "rotate", "site-a", "site-b")).toBe("site-a");
    expect(getCtSiteForBot(3, "rotate", "site-a", "site-b")).toBe("site-a");
    expect(getCtSiteForBot(4, "rotate", "site-a", "site-b")).toBe("site-a");
  });
});

describe("isCtDefendStrategy", () => {
  it("retorna true para default, stack-a, stack-b, hold", () => {
    expect(isCtDefendStrategy("default")).toBe(true);
    expect(isCtDefendStrategy("stack-a")).toBe(true);
    expect(isCtDefendStrategy("stack-b")).toBe(true);
    expect(isCtDefendStrategy("hold")).toBe(true);
  });

  it("retorna false para aggressive e retake", () => {
    expect(isCtDefendStrategy("aggressive")).toBe(false);
    expect(isCtDefendStrategy("retake")).toBe(false);
  });

  it("rotate é estratégia de defesa (posicionamento por site)", () => {
    expect(isCtDefendStrategy("rotate")).toBe(true);
  });
});

describe("chooseBluStrategyForRound", () => {
  it("round 1 sempre default", () => {
    const state = mkState({ round: 1 });
    const cts = [mkBot(), mkBot(), mkBot(), mkBot(), mkBot()];
    expect(chooseBluStrategyForRound(state, cts)).toBe("default");
  });

  it("eco sem rifles: stack no site de execucao", () => {
    const state = mkState({ round: 3, tsExecuteSite: "site-a" });
    const cts = [
      mkBot({ money: 500, primaryWeapon: "USP-S" }),
      mkBot({ money: 600, primaryWeapon: "USP-S" }),
      mkBot({ money: 400, primaryWeapon: "Glock-18" }),
      mkBot({ money: 550, primaryWeapon: "USP-S" }),
      mkBot({ money: 450, primaryWeapon: "Glock-18" })
    ];
    expect(chooseBluStrategyForRound(state, cts)).toBe("stack-a");
  });

  it("deficit >= 2 e roundsToWin <= 4: stack no site de execucao", () => {
    const state = mkState({
      round: 9,
      score: { RED: 4, BLU: 6 },
      teamAStartsAs: "TR",
      tsExecuteSite: "site-b"
    });
    const cts = [mkBot({ money: 4000 }), mkBot(), mkBot(), mkBot(), mkBot()];
    expect(chooseBluStrategyForRound(state, cts)).toBe("stack-b");
  });

  it("lead >= 2 com rifles: aggressive", () => {
    const state = mkState({
      round: 4,
      score: { RED: 0, BLU: 2 },
      teamAStartsAs: "TR"
    });
    const cts = [
      mkBot({ team: "BLU", primaryWeapon: "M4A4", money: 5000 }),
      mkBot({ team: "BLU", primaryWeapon: "M4A4", money: 4500 }),
      mkBot({ team: "BLU", primaryWeapon: "M4A4", money: 4000 }),
      mkBot({ team: "BLU", primaryWeapon: "M4A4", money: 3500 }),
      mkBot({ team: "BLU", primaryWeapon: "M4A4", money: 3000 })
    ];
    expect(chooseBluStrategyForRound(state, cts)).toBe("aggressive");
  });
});
