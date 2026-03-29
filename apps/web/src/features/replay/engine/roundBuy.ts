/**
 * Compra no inicio do round e deteccao de "save" (eco) para IA.
 */
import { weaponKind } from "../ui/weaponIcons";
import type { ArmorLoadout, Bot, MatchState, PlayerRole, StartsAsSide, TeamSide } from "../types";
import {
  HELMET_HEADSHOT_REDUCTION,
  SNIPER_HELMET_HEADSHOT_REDUCTION
} from "./combatConstants";
import {
  BLU_SIDE_ECO_TEAM_AVG_THRESHOLD,
  BLU_SIDE_SAVE_BOT_MONEY_CAP,
  PRICE_AWP,
  PRICE_DEFUSE_KIT,
  PRICE_FAMAS,
  PRICE_GALIL,
  PRICE_MAC10,
  PRICE_MP9,
  PRICE_M4A4,
  PRICE_AK,
  PRICE_VEST,
  PRICE_VEST_HELMET,
  RED_ECO_TEAM_AVG_THRESHOLD,
  RED_SAVE_BOT_MONEY_CAP,
  TEAM_ECO_AVG_THRESHOLD
} from "./economyConstants";
import {
  FIRST_ROUND_SECOND_HALF,
  getBluSideTeam,
  getBluSideTeamFromState,
  getRedSideTeam,
  getRedSideTeamFromState,
  REGULATION_MAX_ROUNDS,
  ROUNDS_TO_WIN_MATCH
} from "./matchConstants";

/** Round 1 e primeiro round do 2.º half = pistol (compra so pistolas). */
export const isPistolRound = (roundNumber: number) =>
  roundNumber <= 1 || roundNumber === FIRST_ROUND_SECOND_HALF;

const pistolPrimary = (side: TeamSide, roundNumber: number, teamAStartsAs: StartsAsSide = "RED") =>
  side === getRedSideTeam(roundNumber, teamAStartsAs) ? "Glock-18" : "USP-S";

export const avgTeamMoneyAlive = (bots: Bot[], side: TeamSide) => {
  const list = bots.filter((b) => b.team === side && b.hp > 0);
  if (list.length === 0) return 0;
  return list.reduce((s, b) => s + b.money, 0) / list.length;
};

/** Fatores de proteção do colete (corpo) e capacete (headshot). Vest não protege cabeça. */
const BODY_ARMOR_VEST = 0.58;
const BODY_ARMOR_VEST_HELMET = 0.48;

/**
 * HP final após absorção do colete/capacete.
 * Colete protege corpo; capacete (vest_helmet) protege headshot — AWP penetra mais.
 */
export const damageAfterArmor = (
  rawDamage: number,
  armor: ArmorLoadout,
  isHeadshot: boolean,
  kind: "rifle" | "budget_rifle" | "sniper" | "smg" | "pistol"
): number => {
  if (armor === "none") return rawDamage;
  if (!isHeadshot) {
    if (armor === "vest") return Math.floor(rawDamage * BODY_ARMOR_VEST);
    return Math.floor(rawDamage * BODY_ARMOR_VEST_HELMET);
  }
  /** Headshot: vest não protege cabeça; capacete reduz. AWP penetra capacete mais. */
  if (armor === "vest") return rawDamage;
  const reduction =
    kind === "sniper" ? SNIPER_HELMET_HEADSHOT_REDUCTION : HELMET_HEADSHOT_REDUCTION;
  return Math.floor(rawDamage * (1 - reduction));
};

/**
 * Eco + saldo baixo: nao brigar pelo mapa — recuar ao spawn (IA).
 * So aplica em eco real (primaria pistola): quem comprou rifle/AWP/SMG tem saldo baixo
 * depois da compra e nao deve ficar preso no spawn.
 * Nao aplica com bomba plantada (outras regras cobrem).
 */
export const shouldSaveEquipment = (bot: Bot, state: MatchState): boolean => {
  if (state.bombPlanted) return false;
  if (bot.team === getRedSideTeamFromState(state) && bot.hasBomb) return false;
  if (bot.hp <= 0) return false;
  /** Pistol round: seguir estrategia / waypoints normais */
  if (isPistolRound(state.round)) return false;
  /** Comprou arma longa ou SMG — ir jogar o round */
  if (weaponKind(bot.primaryWeapon) !== "pistol") return false;

  if (bot.team === getBluSideTeamFromState(state)) {
    const avg = avgTeamMoneyAlive(state.bots, bot.team);
    return avg < BLU_SIDE_ECO_TEAM_AVG_THRESHOLD && bot.money <= BLU_SIDE_SAVE_BOT_MONEY_CAP;
  }
  const avg = avgTeamMoneyAlive(state.bots, bot.team);
  return avg < RED_ECO_TEAM_AVG_THRESHOLD && bot.money <= RED_SAVE_BOT_MONEY_CAP;
};

export type RoundPurchase = {
  primaryWeapon: string;
  secondaryWeapon: string;
  armor: ArmorLoadout;
  hasDefuseKit: boolean;
  money: number;
};

/** Contexto da partida para o AWPer decidir save vs SMG vs force AWP */
export type EconomyPurchaseContext = {
  score: { RED: number; BLU: number };
  roundsToWin: number;
  regulationMaxRounds: number;
};

/** Opcoes passadas pelo reducer (ex.: limite global de kits em eco) */
export type RoundPurchaseOptions = {
  /** Se definido e <= 0, ninguem compra kit neste call; em eco o reducer passa 1 e decrementa */
  bluDefuseKitSlotsRemaining?: number;
  economyContext?: EconomyPurchaseContext;
  /** Qual roster (time A) comeca no papel BLU no 1.º half — pistola (RED=Glock, BLU=USP) */
  teamAStartsAs?: StartsAsSide;
  /** Round 2: papel RED plantou no r1 mas BLU defusou — forcar compra do que der (so round 1–2) */
  redSideForceBuyRound2?: boolean;
};

/** Round “importante”: match point, fim de half/regulamento ou jogo apertado perto do fim. */
export const isHighLeverageRound = (
  roundNumber: number,
  score: { RED: number; BLU: number },
  roundsToWin: number,
  regulationMaxRounds: number
): boolean => {
  const maxScr = Math.max(score.RED, score.BLU);
  if (maxScr >= roundsToWin - 1) return true;
  if (roundNumber === 6 || roundNumber === regulationMaxRounds) return true;
  const gap = Math.abs(score.RED - score.BLU);
  if (maxScr >= roundsToWin - 2 && gap <= 2) return true;
  return false;
};

const AWP_FULL_BUY = PRICE_AWP + PRICE_VEST_HELMET;
const AWP_WITH_VEST = PRICE_AWP + PRICE_VEST;

/**
 * AWPer: full buy, force AWP em round chave, SMG+colete em eco jogavel, ou guarda $ para AWP no proximo buy.
 */
const computeAwpEconomyPurchase = (
  roundNumber: number,
  moneyAfterIncome: number,
  side: TeamSide,
  sec: string,
  teamAvg: number,
  options: RoundPurchaseOptions | undefined,
  ctx: EconomyPurchaseContext
): RoundPurchase => {
  let m = moneyAfterIncome;
  let armor: ArmorLoadout = "none";
  let primary = sec;
  let hasDefuseKit = false;
  const teamAStartsAs = options?.teamAStartsAs ?? "RED";

  /** Round 2: papel RED plantou no r1 mas BLU defusou — forcar compra (armas do lado RED) */
  const redSideForceBuyRound2 =
    roundNumber === 2 &&
    options?.redSideForceBuyRound2 === true &&
    side === getRedSideTeam(roundNumber, teamAStartsAs);
  if (redSideForceBuyRound2) {
    if (m >= PRICE_AK) {
      primary = "AK-47";
      m -= PRICE_AK;
    } else if (m >= PRICE_GALIL) {
      primary = "Galil AR";
      m -= PRICE_GALIL;
    } else if (m >= PRICE_MAC10) {
      primary = "MAC-10";
      m -= PRICE_MAC10;
    }
    if (m >= PRICE_VEST_HELMET) {
      armor = "vest_helmet";
      m -= PRICE_VEST_HELMET;
    } else if (m >= PRICE_VEST) {
      armor = "vest";
      m -= PRICE_VEST;
    }
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  const important = isHighLeverageRound(
    roundNumber,
    ctx.score,
    ctx.roundsToWin,
    ctx.regulationMaxRounds
  );

  const tryArmor = () => {
    if (m >= PRICE_VEST_HELMET) {
      armor = "vest_helmet";
      m -= PRICE_VEST_HELMET;
    } else if (m >= PRICE_VEST) {
      armor = "vest";
      m -= PRICE_VEST;
    }
  };

  const tryKit = () => {
    if (side !== getBluSideTeam(roundNumber, teamAStartsAs) || hasDefuseKit || m < PRICE_DEFUSE_KIT) return;
    const slots = options?.bluDefuseKitSlotsRemaining;
    if (slots !== undefined && slots <= 0) return;
    hasDefuseKit = true;
    m -= PRICE_DEFUSE_KIT;
  };

  const spendWeapon = (name: string, price: number) => {
    primary = name;
    m -= price;
  };

  const smgName = side === "RED" ? "MAC-10" : "MP9";
  const smgPrice = side === "RED" ? PRICE_MAC10 : PRICE_MP9;

  /** Guardar para AWP: proprio saldo perto do full buy mas time em eco — nao gasta em rifle/SMG “caro”. */
  const shortToAwp = AWP_FULL_BUY - m;
  const awpRoundAfterPistol = roundNumber === 2 || roundNumber === FIRST_ROUND_SECOND_HALF + 1;
  /** Apos pistol: nunca guardar — comprar SMG se tiver dinheiro para segurar anti-eco */
  const shouldBankForAwp =
    !important &&
    !awpRoundAfterPistol &&
    teamAvg < TEAM_ECO_AVG_THRESHOLD &&
    m >= 3200 &&
    m < AWP_FULL_BUY &&
    shortToAwp >= 900 &&
    shortToAwp <= 3200;

  if (m >= AWP_FULL_BUY) {
    spendWeapon("AWP", PRICE_AWP);
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  if (important) {
    if (m >= AWP_WITH_VEST) {
      spendWeapon("AWP", PRICE_AWP);
      tryArmor();
      tryKit();
      return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
    }
    if (m >= PRICE_AWP) {
      spendWeapon("AWP", PRICE_AWP);
      tryArmor();
      tryKit();
      return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
    }
  }

  if (shouldBankForAwp) {
    tryArmor();
    tryKit();
    return {
      primaryWeapon: sec,
      secondaryWeapon: sec,
      armor,
      hasDefuseKit,
      money: m
    };
  }

  /** Full buy apos vencer pistol: melhor arma possivel (rifle > SMG) + colete/capacete com o que sobrar */
  const wonPistolRound = awpRoundAfterPistol && teamAvg >= 3000;
  if (wonPistolRound) {
    if (side === "RED") {
      if (m >= PRICE_AK) spendWeapon("AK-47", PRICE_AK);
      else if (m >= PRICE_GALIL) spendWeapon("Galil AR", PRICE_GALIL);
      else if (m >= PRICE_MAC10) spendWeapon(smgName, smgPrice);
    } else {
      if (m >= PRICE_M4A4) spendWeapon("M4A4", PRICE_M4A4);
      else if (m >= PRICE_FAMAS) spendWeapon("FAMAS", PRICE_FAMAS);
      else if (m >= PRICE_MP9) spendWeapon(smgName, smgPrice);
    }
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  /** Apos pistol (perdeu): SMG+armor em vez de guardar, mesmo com dinheiro para AWP */
  if (awpRoundAfterPistol && m >= smgPrice + PRICE_VEST_HELMET) {
    spendWeapon(smgName, smgPrice);
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  /** Tem dinheiro para AWP: preferir AWP em vez de SMG (exceto nos casos acima) */
  if (m >= PRICE_AWP) {
    spendWeapon("AWP", PRICE_AWP);
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  if (m >= smgPrice + PRICE_VEST_HELMET) {
    spendWeapon(smgName, smgPrice);
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }
  if (m >= smgPrice + PRICE_VEST) {
    spendWeapon(smgName, smgPrice);
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }
  if (m >= smgPrice) {
    spendWeapon(smgName, smgPrice);
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  tryArmor();
  tryKit();
  return {
    primaryWeapon: sec,
    secondaryWeapon: sec,
    armor,
    hasDefuseKit,
    money: m
  };
};

/** Minimo que o doador deve ter apos o drop (colete+capacete) para ainda se equipar */
const MIN_MONEY_AFTER_DROP = PRICE_VEST_HELMET + 300;

/** Custo de rifle por lado para drop */
const DROP_RIFLE_RED = PRICE_AK;
const DROP_RIFLE_BLU = PRICE_FAMAS;

/**
 * Se um jogador com muito dinheiro pode comprar arma para companheiro que morreu e ficou em eco.
 * Prioridade: AWP para o sniper do time (movimento importante). Caso contrario, rifle.
 * Só faz drop se o doador, após pagar, ainda conseguir se equipar (colete no mínimo).
 */
export const applyDropForTeammate = (
  team: TeamSide,
  purchaseBots: Bot[],
  purchases: Map<string, RoundPurchase>,
  oldBots: Bot[],
  roundNumber: number
): {
  updates: Map<string, Partial<RoundPurchase>>;
  donorSpent: Map<string, number>;
  /** Mensagem para log quando houver drop (ex.: "BOT-1 comprou AWP para BOT-2") */
  logMessage?: string;
} => {
  const updates = new Map<string, Partial<RoundPurchase>>();
  const donorSpent = new Map<string, number>();
  if (isPistolRound(roundNumber)) return { updates, donorSpent };

  const teamBots = purchaseBots.filter((b) => b.team === team);
  const deadWithPistol = teamBots.filter((b) => {
    const ob = oldBots.find((o) => o.id === b.id);
    if (!ob || ob.hp > 0) return false;
    const buy = purchases.get(b.id);
    if (!buy) return false;
    return weaponKind(buy.primaryWeapon) === "pistol";
  });

  const deadSniper = deadWithPistol.find((b) => b.role === "AWP");
  const deadOthers = deadWithPistol.filter((b) => b.role !== "AWP").sort((a, b) => a.money - b.money);

  /** Tenta drop de AWP para sniper (prioridade alta) */
  const awpThreshold = PRICE_AWP + MIN_MONEY_AFTER_DROP;
  const rifleCost = team === "RED" ? DROP_RIFLE_RED : DROP_RIFLE_BLU;
  const rifleWeapon = team === "RED" ? "AK-47" : "FAMAS";
  const rifleThreshold = rifleCost + MIN_MONEY_AFTER_DROP;

  const aliveRichAwp = teamBots.filter((b) => {
    const ob = oldBots.find((o) => o.id === b.id);
    return ob && ob.hp > 0 && b.money >= awpThreshold;
  }).sort((a, b) => b.money - a.money);

  const aliveRichRifle = teamBots.filter((b) => {
    const ob = oldBots.find((o) => o.id === b.id);
    return ob && ob.hp > 0 && b.money >= rifleThreshold;
  }).sort((a, b) => b.money - a.money);

  if (deadSniper && aliveRichAwp.length > 0) {
    const donor = aliveRichAwp[0];
    updates.set(deadSniper.id, { primaryWeapon: "AWP" });
    donorSpent.set(donor.id, PRICE_AWP);
    return { updates, donorSpent, logMessage: `${donor.name} comprou AWP para ${deadSniper.name}` };
  }

  if (deadOthers.length > 0 && aliveRichRifle.length > 0) {
    const donor = aliveRichRifle[0];
    const recipient = deadOthers[0];
    updates.set(recipient.id, { primaryWeapon: rifleWeapon });
    donorSpent.set(donor.id, rifleCost);
    return { updates, donorSpent, logMessage: `${donor.name} comprou ${rifleWeapon} para ${recipient.name}` };
  }

  return { updates, donorSpent };
};

/** Ordem de prioridade para quem pode comprar o unico kit em economia fraca (IGL > Rifle > AWP) */
export const compareBluKitPriority = (a: Bot, b: Bot) => {
  const rank = (r: PlayerRole) => (r === "IGL" ? 0 : r === "Rifler" ? 1 : 2);
  const d = rank(a.role) - rank(b.role);
  if (d !== 0) return d;
  return a.id.localeCompare(b.id);
};

/**
 * Decide equipamento apos receber bonus do round (moneyAfterIncome ja inclui win/loss + kills).
 */
export const computeRoundPurchase = (
  bot: Bot,
  roundNumber: number,
  moneyAfterIncome: number,
  avgRedTeamMoney: number,
  avgBluTeamMoney: number,
  options?: RoundPurchaseOptions
): RoundPurchase => {
  const side = bot.team;
  const teamAStartsAs = options?.teamAStartsAs ?? "RED";
  const sec = pistolPrimary(side, roundNumber, teamAStartsAs);
  let m = moneyAfterIncome;
  let armor: ArmorLoadout = "none";
  let primary = sec;
  let hasDefuseKit = false;

  const teamAvg = side === "RED" ? avgRedTeamMoney : avgBluTeamMoney;

  if (isPistolRound(roundNumber)) {
    return {
      primaryWeapon: sec,
      secondaryWeapon: sec,
      armor: "none",
      hasDefuseKit: false,
      money: m
    };
  }

  /** Round apos pistol (2 ou 9): forcar compra — time vencedor (avg alto) ou quem tem pra SMG nunca ecoa */
  const isRoundAfterPistol = roundNumber === 2 || roundNumber === FIRST_ROUND_SECOND_HALF + 1;
  const canAffordSmgOrBetter =
    (side === "RED" && m >= PRICE_MAC10) || (side === "BLU" && m >= PRICE_MP9);
  const wonPistolOrCanBuy = isRoundAfterPistol && (teamAvg >= 3000 || canAffordSmgOrBetter);
  /** Full buy round 2: melhor arma primaria possivel + colete/capacete com o que sobrar */
  const wonPistolRound = isRoundAfterPistol && teamAvg >= 3000;
  /** Round 2: papel RED plantou no r1 mas BLU defusou — forcar compra do que der (so round 1–2) */
  const redSideForceBuyRound2 =
    roundNumber === 2 &&
    options?.redSideForceBuyRound2 === true &&
    side === getRedSideTeam(roundNumber, teamAStartsAs);

  if (bot.role === "AWP") {
    const ecoCtx: EconomyPurchaseContext = options?.economyContext ?? {
      score: { RED: 0, BLU: 0 },
      roundsToWin: ROUNDS_TO_WIN_MATCH,
      regulationMaxRounds: REGULATION_MAX_ROUNDS
    };
    return computeAwpEconomyPurchase(
      roundNumber,
      moneyAfterIncome,
      side,
      sec,
      teamAvg,
      options,
      ecoCtx
    );
  }

  /** Eco: so quando o TIME esta em eco (media baixa). Se time ja esta armado, bot com dinheiro sempre compra. */
  const teamInEco = teamAvg < TEAM_ECO_AVG_THRESHOLD;
  const botCanAffordRifle =
    (side === "RED" && m >= PRICE_GALIL + PRICE_VEST) || (side === "BLU" && m >= PRICE_FAMAS + PRICE_VEST);
  const ecoSave =
    teamInEco &&
    m < 3800 &&
    !isPistolRound(roundNumber) &&
    !wonPistolOrCanBuy &&
    !redSideForceBuyRound2 &&
    !(teamAvg >= TEAM_ECO_AVG_THRESHOLD && botCanAffordRifle);

  const tryArmor = () => {
    if (m >= PRICE_VEST_HELMET) {
      armor = "vest_helmet";
      m -= PRICE_VEST_HELMET;
    } else if (m >= PRICE_VEST) {
      armor = "vest";
      m -= PRICE_VEST;
    }
  };

  /** Kit de desarme (400$): roster no papel BLU com saldo apos compras — defuse ~5s. Limite global em eco via options. */
  const tryKit = () => {
    if (side !== getBluSideTeam(roundNumber, teamAStartsAs) || hasDefuseKit || m < PRICE_DEFUSE_KIT) return;
    const slots = options?.bluDefuseKitSlotsRemaining;
    if (slots !== undefined && slots <= 0) return;
    hasDefuseKit = true;
    m -= PRICE_DEFUSE_KIT;
  };

  if (ecoSave) {
    tryArmor();
    tryKit();
    return {
      primaryWeapon: sec,
      secondaryWeapon: sec,
      armor,
      hasDefuseKit,
      money: m
    };
  }

  const spendWeapon = (name: string, price: number) => {
    primary = name;
    m -= price;
  };

  /** Full buy apos vencer pistol: melhor arma primaria possivel, depois colete+capacete com o que sobrar */
  if (wonPistolRound) {
    if (side === "RED") {
      if (m >= PRICE_AK) {
        spendWeapon("AK-47", PRICE_AK);
      } else if (m >= PRICE_GALIL) {
        spendWeapon("Galil AR", PRICE_GALIL);
      } else if (m >= PRICE_MAC10) {
        spendWeapon("MAC-10", PRICE_MAC10);
      }
    } else {
      if (m >= PRICE_M4A4) {
        spendWeapon("M4A4", PRICE_M4A4);
      } else if (m >= PRICE_FAMAS) {
        spendWeapon("FAMAS", PRICE_FAMAS);
      } else if (m >= PRICE_MP9) {
        spendWeapon("MP9", PRICE_MP9);
      }
    }
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  /** Round 2: forcar compra (melhor arma + colete/capacete) quando redSideForceBuyRound2 */
  if (redSideForceBuyRound2) {
    if (m >= PRICE_AK) {
      spendWeapon("AK-47", PRICE_AK);
    } else if (m >= PRICE_GALIL) {
      spendWeapon("Galil AR", PRICE_GALIL);
    } else if (m >= PRICE_MAC10) {
      spendWeapon("MAC-10", PRICE_MAC10);
    }
    tryArmor();
    tryKit();
    return { primaryWeapon: primary, secondaryWeapon: sec, armor, hasDefuseKit, money: m };
  }

  if (side === "RED") {
    if (m >= PRICE_AK + PRICE_VEST_HELMET) {
      spendWeapon("AK-47", PRICE_AK);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_GALIL + PRICE_VEST_HELMET) {
      spendWeapon("Galil AR", PRICE_GALIL);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_MAC10 + PRICE_VEST_HELMET) {
      spendWeapon("MAC-10", PRICE_MAC10);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_GALIL + PRICE_VEST) {
      spendWeapon("Galil AR", PRICE_GALIL);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_MAC10 + PRICE_VEST) {
      spendWeapon("MAC-10", PRICE_MAC10);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_GALIL) {
      spendWeapon("Galil AR", PRICE_GALIL);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_MAC10) {
      spendWeapon("MAC-10", PRICE_MAC10);
      tryArmor();
      tryKit();
    } else {
      tryArmor();
      tryKit();
    }
  } else {
    if (m >= PRICE_M4A4 + PRICE_VEST_HELMET) {
      spendWeapon("M4A4", PRICE_M4A4);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_FAMAS + PRICE_VEST_HELMET) {
      spendWeapon("FAMAS", PRICE_FAMAS);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_MP9 + PRICE_VEST_HELMET) {
      spendWeapon("MP9", PRICE_MP9);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_FAMAS + PRICE_VEST) {
      spendWeapon("FAMAS", PRICE_FAMAS);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_MP9 + PRICE_VEST) {
      spendWeapon("MP9", PRICE_MP9);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_FAMAS) {
      spendWeapon("FAMAS", PRICE_FAMAS);
      tryArmor();
      tryKit();
    } else if (m >= PRICE_MP9) {
      spendWeapon("MP9", PRICE_MP9);
      tryArmor();
      tryKit();
    } else {
      tryArmor();
      tryKit();
    }
  }

  if (primary === sec && armor === "none" && m >= PRICE_VEST_HELMET) {
    tryArmor();
    tryKit();
  }

  return {
    primaryWeapon: primary,
    secondaryWeapon: sec,
    armor,
    hasDefuseKit,
    money: m
  };
};
