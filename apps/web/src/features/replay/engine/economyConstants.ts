/**
 * Economia inspirada em CS: saldo inicial, compras, bonus por round/kill e streak de derrotas.
 *
 * Tabela de economia (cenários típicos):
 * | Cenário        | Round win | Round loss (streak) | Kill  | Plant | Defuse |
 * |----------------|-----------|---------------------|-------|-------|--------|
 * | Pistol         | 800       | 800                 | 300   | 300   | 300    |
 * | Full buy win   | 3250      | —                   | 300   | 300   | 300    |
 * | Eco loss (1)   | —         | 1900                | 300   | —     | —      |
 * | Eco loss (2+)  | —         | 2400–3400           | 300   | —     | —      |
 * | Full buy após  | 3250+300×kills | 1900–3400     | 300   | 300   | 300    |
 *
 * Eco: TEAM_ECO_AVG < 2300; full buy: AK+colete ≈ 3700, M4+colete ≈ 4100.
 * Save: bot com pouco $ + time em eco = recua ao spawn (CT_SAVE_BOT_MONEY_CAP).
 */
/** Pistol round — todos comecam com o mesmo patamar */
export const START_MONEY = 800;

/** Vitória de round (time vencedor) — levemente reduzido para equilibrar snowball */
export const ROUND_WIN_BONUS = 3050;

/** Bônus por derrota consecutiva — aumentado para time perdedor recuperar mais rápido */
export const LOSS_BONUS_TIERS = [2100, 2650, 3200, 3750] as const;

/** Por eliminacao na rodada (aplicado imediatamente ao matar) */
export const KILL_REWARD = 300;

/** Bonus para todo o time TR quando a C4 e plantada (aplicado imediatamente) */
export const PLANT_BONUS = 300;

/** Bonus para todo o time CT quando a C4 e defusada (aplicado imediatamente) */
export const DEFUSE_BONUS = 300;

/** Bonus se a C4 for plantada nos ~5s de "jogo livre" apos o round ja decidido (antes do proximo round) */
export const END_OF_ROUND_SANDBOX_PLANT_BONUS = 300;

export const MAX_MONEY = 16000;

/** CT: media do time abaixo disso = tendencia a save (eco) */
export const CT_ECO_TEAM_AVG_THRESHOLD = 2100;
/** CT: jogador com saldo baixo + time em eco = prioriza guardar equip no spawn */
export const CT_SAVE_BOT_MONEY_CAP = 1850;

/** RED: mesma logica de save */
export const RED_ECO_TEAM_AVG_THRESHOLD = 2200;
export const RED_SAVE_BOT_MONEY_CAP = 1950;

/** Media do time abaixo disso = considerado "eco" para compras em grupo */
export const TEAM_ECO_AVG_THRESHOLD = 2300;

/** Bomba: tempo restante (ms) abaixo do qual forcar retake/defuse — CTs vaem antes que falte 10s (defuse ~10s) */
export const POST_PLANT_FORCE_RETAKE_MS = 25000;
/** CTs em vantagem numerica: avancar ainda mais cedo (ms restantes para considerar "urgente") */
export const POST_PLANT_ADVANTAGE_RETAKE_MS = 30000;

// --- Precos (CS aproximado) ---
export const PRICE_AK = 2700;
export const PRICE_GALIL = 1800;
export const PRICE_MAC10 = 1050;
/** SMG CT (eco do AWPer) */
export const PRICE_MP9 = 1250;
export const PRICE_M4A4 = 3100;
export const PRICE_FAMAS = 2050;
export const PRICE_AWP = 4750;
/** Colete + capacete */
export const PRICE_VEST_HELMET = 1000;
/** So colete */
export const PRICE_VEST = 650;
export const PRICE_DEFUSE_KIT = 400;

/** @deprecated use LOSS_BONUS_TIERS */
export const ROUND_LOSS_BONUS = LOSS_BONUS_TIERS[0];
