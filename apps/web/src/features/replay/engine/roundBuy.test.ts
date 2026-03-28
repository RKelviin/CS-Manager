import { describe, it, expect } from "vitest";
import { computeRoundPurchase, isPistolRound } from "./roundBuy";
import type { Bot } from "../types";

const mkBot = (overrides: Partial<Bot> = {}): Bot =>
  ({
    id: "RED-0",
    name: "T",
    team: "RED",
    role: "Rifler",
    displayRole: "Entry",
    x: 400,
    y: 500,
    hp: 100,
    money: 4000,
    primaryWeapon: "AK-47",
    armor: "vest_helmet",
    hasBomb: false,
    hasDefuseKit: false,
    targetX: 400,
    targetY: 450,
    ...overrides
  }) as Bot;

describe("isPistolRound", () => {
  it("round 1 e 7 sao pistol", () => {
    expect(isPistolRound(1)).toBe(true);
    expect(isPistolRound(7)).toBe(true);
  });

  it("round 2 e 8 nao sao pistol", () => {
    expect(isPistolRound(2)).toBe(false);
    expect(isPistolRound(8)).toBe(false);
  });
});

describe("computeRoundPurchase", () => {
  it("pistol round: mantem pistola", () => {
    const bot = mkBot({ money: 800, primaryWeapon: "Glock-18" });
    const buy = computeRoundPurchase(bot, 1, 800, 800, 800);
    expect(buy.primaryWeapon).toBe("Glock-18");
    expect(buy.armor).toBe("none");
  });

  it("RED com dinheiro para AK+colete: compra AK", () => {
    const bot = mkBot({ money: 5000 });
    const buy = computeRoundPurchase(bot, 3, 5000, 4000, 4000);
    expect(buy.primaryWeapon).toBe("AK-47");
    expect(buy.armor).toBe("vest_helmet");
  });

  it("BLU com dinheiro para M4+colete: compra M4", () => {
    const bot = mkBot({ team: "BLU", money: 5000, primaryWeapon: "M4A4" });
    const buy = computeRoundPurchase(bot, 3, 5000, 4000, 4000);
    expect(buy.primaryWeapon).toBe("M4A4");
    expect(buy.armor).toBe("vest_helmet");
  });

  it("eco: time pobre, bot pobre = pistola", () => {
    const bot = mkBot({ money: 1500, primaryWeapon: "Glock-18" });
    const buy = computeRoundPurchase(bot, 4, 1500, 1800, 1800);
    expect(buy.primaryWeapon).toBe("Glock-18");
  });

  it("time armado + bot com dinheiro: compra mesmo em media baixa do bot", () => {
    const bot = mkBot({ money: 3500, primaryWeapon: "Glock-18" });
    const buy = computeRoundPurchase(bot, 5, 3500, 4500, 4500);
    expect(buy.primaryWeapon).not.toBe("Glock-18");
    expect(["AK-47", "Galil AR", "MAC-10"]).toContain(buy.primaryWeapon);
  });
});
