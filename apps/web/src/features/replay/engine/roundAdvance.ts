/**
 * Transição entre rounds: economia, compras, troca de lados (halftime/OT) e reset de bomba/estratégia.
 * Mantido separado do tick principal para facilitar testes e evolução incremental.
 */
import { createMatchState } from "./createMatchState";
import {
  END_OF_ROUND_SANDBOX_PLANT_BONUS,
  MAX_MONEY,
  START_MONEY,
  TEAM_ECO_AVG_THRESHOLD
} from "./economyConstants";
import { chooseBluStrategyForRound } from "./ctStrategy";
import { chooseRedStrategyForRound } from "./trStrategy";
import { applyDropForTeammate, compareBluKitPriority, computeRoundPurchase } from "./roundBuy";
import {
  FIRST_ROUND_SECOND_HALF,
  getCtTeam,
  getCtTeamFromState,
  getTrTeamFromState,
  OT_ROUNDS_PER_PERIOD,
  REGULATION_MAX_ROUNDS,
  ROUNDS_TO_WIN_MATCH
} from "./matchConstants";
import { clamp, pushLog } from "./matchUtils";
import { weaponKind } from "../ui/weaponIcons";
import type { Bot, MatchState, TeamSide } from "../types";

const BLU_KIT_SLOTS_FULL_BUY = 99;

/** Moral: após vencedor e loss streak (resolveRound), antes do avanço de round. */
export function applyMoraleAfterRound(state: MatchState, winner: TeamSide) {
  if (!state.morale) {
    state.morale = { RED: 100, BLU: 100 };
  }
  const before = { RED: state.morale.RED, BLU: state.morale.BLU };
  const loser: TeamSide = winner === "RED" ? "BLU" : "RED";

  if (state.lossStreak[loser] >= 3) {
    state.morale[loser] = Math.max(0, state.morale[loser] - 5 * (state.lossStreak[loser] - 2));
  }
  state.morale[winner] = Math.min(100, state.morale[winner] + 8);

  for (const side of ["RED", "BLU"] as const) {
    if (state.morale[side] < 50 && before[side] >= 50) {
      pushLog(state, `${side} moral baixa (${state.morale[side]}) — composure penalizada`);
    }
  }
}

export const snapshotBotsForAdvance = (bots: Bot[]): Bot[] =>
  bots.map((b) => ({
    ...b,
    navPath: (b.navPath ?? []).map((p) => ({ ...p })),
    damageContributors: [...(b.damageContributors ?? [])]
  }));

/** Aplica novo round, bots e bomba — chamado após intermissão ou skip (Iniciar) */
export const applyPendingRoundAdvance = (state: MatchState) => {
  const pending = state.pendingRoundAdvance;
  if (!pending) return;

  const hadBombPlantedAtResolve = pending.hadBombPlantedAtResolve;
  const sandboxPlant =
    !hadBombPlantedAtResolve && state.bombPlanted ? END_OF_ROUND_SANDBOX_PLANT_BONUS : 0;

  const resume = state.pendingResumeAfterRound;
  const oldBots = pending.oldBotsSnapshot;
  const winner = pending.winner;

  state.pendingRoundAdvance = null;
  state.pendingResumeAfterRound = false;

  state.round += 1;
  state.timeLeftMs = 115000;
  state.tickId = 0;

  const isHalfSwap = state.round === FIRST_ROUND_SECOND_HALF;
  const otOffset = state.round - REGULATION_MAX_ROUNDS;
  const isOvertime = state.round >= REGULATION_MAX_ROUNDS;
  const isOvertimeEconomyReset =
    isOvertime &&
    state.matchType === "tournament" &&
    (state.round === REGULATION_MAX_ROUNDS || otOffset % OT_ROUNDS_PER_PERIOD === 0);

  if (isHalfSwap) {
    state.lossStreak = { RED: 0, BLU: 0 };
    pushLog(
      state,
      "MEIO-TEMPO: lados invertidos — quem era TR (laranja) passa a CT (azul) e vice-versa. Economia reiniciada; pistol round."
    );
  }
  if (isOvertimeEconomyReset && !isHalfSwap) {
    state.lossStreak = { RED: 0, BLU: 0 };
    pushLog(state, "OVERTIME: novo período — economia reiniciada; pistol round.");
  }

  const effectiveEconomyReset = isHalfSwap || isOvertimeEconomyReset;

  const fresh = createMatchState(state);

  if (sandboxPlant > 0) {
    pushLog(
      state,
      `Bonus de plant: +$${sandboxPlant} para cada TR — C4 plantada no fim de round (antes do proximo).`
    );
  }

  type IncomeRow = { nb: Bot; ob: Bot; moneyAfterIncome: number };
  const rows: IncomeRow[] = [];
  /** Sempre o mesmo id: RED/BLU = roster fixo (time A / time B); TR/CT vem só do round em createMatchState. */
  for (const ob of oldBots) {
    const nb = fresh.bots.find((b) => b.id === ob.id);
    if (!nb) continue;
    const plantExtra = ob.team === "RED" ? sandboxPlant : 0;
    const moneyAfterIncome = effectiveEconomyReset
      ? START_MONEY
      : clamp(ob.money + plantExtra, 0, MAX_MONEY);
    rows.push({ nb, ob, moneyAfterIncome });
  }

  const botsWithMoney: Bot[] = rows.map((r) => ({ ...r.ob, money: r.moneyAfterIncome }));
  const purchaseBots = botsWithMoney;

  const avgRed =
    purchaseBots.filter((b) => b.team === "RED").reduce((s, b) => s + b.money, 0) / 5;
  const avgBlu =
    purchaseBots.filter((b) => b.team === "BLU").reduce((s, b) => s + b.money, 0) / 5;

  const lowBluEconomy = avgBlu < TEAM_ECO_AVG_THRESHOLD;
  let bluKitSlots = lowBluEconomy ? 1 : BLU_KIT_SLOTS_FULL_BUY;
  const purchases = new Map<string, ReturnType<typeof computeRoundPurchase>>();
  const economyContext = {
    score: state.score,
    roundsToWin: ROUNDS_TO_WIN_MATCH,
    regulationMaxRounds: REGULATION_MAX_ROUNDS
  };
  const trForceBuyRound2 =
    !isHalfSwap &&
    state.round === 2 &&
    hadBombPlantedAtResolve &&
    winner === getCtTeam(1, state.teamAStartsAs);

  const bluPurchaseSorted = purchaseBots
    .filter((b) => b.team === "BLU")
    .sort((a, b) => compareBluKitPriority(a, b));
  for (const pb of bluPurchaseSorted) {
    const buy = computeRoundPurchase(pb, state.round, pb.money, avgRed, avgBlu, {
      bluDefuseKitSlotsRemaining: bluKitSlots,
      economyContext,
      teamAStartsAs: state.teamAStartsAs,
      trForceBuyRound2
    });
    purchases.set(pb.id, buy);
    if (buy.hasDefuseKit) bluKitSlots -= 1;
  }
  for (const pb of purchaseBots.filter((b) => b.team === "RED")) {
    purchases.set(
      pb.id,
      computeRoundPurchase(pb, state.round, pb.money, avgRed, avgBlu, {
        economyContext,
        teamAStartsAs: state.teamAStartsAs,
        trForceBuyRound2
      })
    );
  }

  const redDrop = applyDropForTeammate("RED", purchaseBots, purchases, oldBots, state.round);
  const bluDrop = applyDropForTeammate("BLU", purchaseBots, purchases, oldBots, state.round);
  for (const [id, patch] of [...redDrop.updates, ...bluDrop.updates]) {
    const cur = purchases.get(id);
    if (cur) purchases.set(id, { ...cur, ...patch });
  }
  const donorSpent = new Map([...redDrop.donorSpent, ...bluDrop.donorSpent]);
  if (redDrop.logMessage) pushLog(state, redDrop.logMessage);
  if (bluDrop.logMessage) pushLog(state, bluDrop.logMessage);

  state.bots = rows.map(({ nb, ob, moneyAfterIncome }) => {
    const buy = purchases.get(ob.id)!;
    const pb = purchaseBots.find((b) => b.id === ob.id)!;
    const wasAlive = ob.hp > 0 && !effectiveEconomyReset;
    const weaponTier = (k: ReturnType<typeof weaponKind>) =>
      k === "sniper" ? 4 : k === "rifle" ? 3 : k === "budget_rifle" ? 2 : k === "smg" ? 1 : 0;
    const wouldDowngrade =
      wasAlive &&
      weaponTier(weaponKind(ob.primaryWeapon)) > weaponTier(weaponKind(buy.primaryWeapon));
    const applyBuy = !wasAlive || !wouldDowngrade;
    const pos = {
      x: nb.x,
      y: nb.y,
      angle: nb.angle,
      targetX: nb.targetX,
      targetY: nb.targetY,
      navGoalX: nb.navGoalX,
      navGoalY: nb.navGoalY
    };
    return {
      ...nb,
      id: ob.id,
      name: pb.name,
      team: pb.team,
      role: pb.role,
      displayRole: pb.displayRole ?? ob.displayRole,
      hp: 100,
      x: pos.x,
      y: pos.y,
      angle: pos.angle,
      aim: ob.aim,
      targetX: pos.targetX,
      targetY: pos.targetY,
      navGoalX: pos.navGoalX,
      navGoalY: pos.navGoalY,
      lastFireTick: -1,
      kills: ob.kills,
      deaths: ob.deaths,
      assists: ob.assists,
      damageDealt: ob.damageDealt,
      killsAtRoundStart: ob.kills,
      killsThisRound: 0,
      damageContributors: [],
      money:
        !wasAlive
          ? buy.money
          : applyBuy
            ? buy.money - (donorSpent.get(ob.id) ?? 0)
            : moneyAfterIncome - (donorSpent.get(ob.id) ?? 0),
      primaryWeapon: applyBuy ? buy.primaryWeapon : ob.primaryWeapon,
      secondaryWeapon: applyBuy ? buy.secondaryWeapon : ob.secondaryWeapon,
      armor: applyBuy ? buy.armor : ob.armor,
      hasBomb: false,
      hasDefuseKit: applyBuy ? buy.hasDefuseKit : ob.hasDefuseKit,
      lastDamageTick: -1,
      lastDamageFromX: 0,
      lastDamageFromY: 0,
      lastMoveTick: -1,
      navPath: [],
      navStuckTicks: 0
    };
  });

  const trs = state.bots.filter((b) => b.team === getTrTeamFromState(state));
  if (trs.length > 0) {
    trs[Math.floor(Math.random() * trs.length)].hasBomb = true;
  }

  const trBots = state.bots.filter((b) => b.team === getTrTeamFromState(state));
  const ctBots = purchaseBots.filter((b) => b.team === getCtTeamFromState(state));
  state.bombDroppedAt = fresh.bombDroppedAt;
  state.defuseKitDrops = [];
  state.weaponDrops = [];
  state.tsExecuteSite = fresh.tsExecuteSite;
  state.bombPlanted = fresh.bombPlanted;
  state.bombPlantSite = fresh.bombPlantSite;
  state.bombPlantWorldPos = fresh.bombPlantWorldPos;
  state.postPlantTimeLeftMs = fresh.postPlantTimeLeftMs;
  state.plantProgressMs = fresh.plantProgressMs;
  state.defuseProgressMs = fresh.defuseProgressMs;
  state.defuserId = fresh.defuserId;
  const trPick = chooseRedStrategyForRound(state, trBots);
  state.redStrategy = trPick.strategy;
  state.activeTrStrategyKey = trPick.trStrategyKey;

  const ctPick = chooseBluStrategyForRound(state, ctBots);
  state.bluStrategy = ctPick.strategy;
  state.activeCtStrategyKey = ctPick.ctStrategyKey;
  pushLog(
    state,
    `Proximo round ${state.round}: ${state.round % 2 === 1 ? "RED-1" : "BLU-1"} inicia · RED ${state.redStrategy} | BLU ${state.bluStrategy} · exec T site ${fresh.tsExecuteSite === "site-a" ? "A" : "B"}`
  );

  state.isRunning = resume;
};
