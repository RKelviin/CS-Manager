import { describe, it, expect } from "vitest";
import {
  FIRST_OT_ROUND,
  FIRST_ROUND_SECOND_HALF,
  getBluSideTeam,
  getRedSideTeam,
  OT_ROUNDS_PER_PERIOD,
  REGULATION_MAX_ROUNDS
} from "./matchConstants";

describe("getRedSideTeam / getBluSideTeam", () => {
  it("regulamento MR12: 6 rounds metade 1, 6 metade 2 (time A começa papel RED)", () => {
    const starts = "RED" as const;
    for (let r = 1; r <= 6; r++) {
      expect(getRedSideTeam(r, starts)).toBe("RED");
      expect(getBluSideTeam(r, starts)).toBe("BLU");
    }
    for (let r = FIRST_ROUND_SECOND_HALF; r <= REGULATION_MAX_ROUNDS; r++) {
      expect(getRedSideTeam(r, starts)).toBe("BLU");
      expect(getBluSideTeam(r, starts)).toBe("RED");
    }
  });

  it("round 12 continua na regulamentação — não usa bloco de OT (bug histórico: round 12 era tratado como OT)", () => {
    const starts = "RED" as const;
    expect(REGULATION_MAX_ROUNDS).toBe(12);
    expect(FIRST_OT_ROUND).toBe(13);
    expect(getRedSideTeam(12, starts)).toBe("BLU");
    expect(getRedSideTeam(13, starts)).toBe("RED");
  });

  it("OT competitivo: blocos de 4 rounds, 2+2 papel RED (time A default papel RED na 1.ª metade)", () => {
    const starts = "RED" as const;
    const redSides: string[] = [];
    for (let r = FIRST_OT_ROUND; r < FIRST_OT_ROUND + OT_ROUNDS_PER_PERIOD * 2; r++) {
      redSides.push(getRedSideTeam(r, starts));
    }
    expect(redSides.slice(0, 4)).toEqual(["RED", "RED", "BLU", "BLU"]);
    expect(redSides.slice(4, 8)).toEqual(["RED", "RED", "BLU", "BLU"]);
  });

  it("cada round papel RED e BLU são rosters opostos", () => {
    const starts = "BLU" as const;
    for (let r = 1; r <= 20; r++) {
      const red = getRedSideTeam(r, starts);
      const blu = getBluSideTeam(r, starts);
      expect(red === "RED" ? "BLU" : "RED").toBe(blu);
    }
  });
});
