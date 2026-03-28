/** Rifle/Galil/FAMAS: alcance efetivo no mapa 2D (px) */
export const WEAPON_RANGE = 310;
/** FOV ~66° — levemente mais largo que o legado (~60°) para engajar melhor */
export const WEAPON_FOV = (66 * Math.PI) / 180;
/** Passo de rotacao da mira por tick (~100ms) — base; AWP/IGL ajustam em roleCombat */
export const ROTATE_STEP = 0.26;
/** Ticks entre tiros base (rifle) */
export const FIRE_COOLDOWN_TICKS = 2;
export const BASE_DAMAGE_MIN = 15;
export const BASE_DAMAGE_MAX = 27;

/** Ticks entre tiros por tipo de arma. SMG rápida compensa dano; budget_rifle igual a rifle. */
export const FIRE_COOLDOWN_BY_KIND: Record<string, number> = {
  sniper: 8,
  rifle: 2,
  budget_rifle: 2,
  smg: 1,
  pistol: 2
};

/** Multiplicador de dano por tipo. Equilibrado: armas baratas viáveis, menos snowball. */
export const DAMAGE_MULTIPLIER_BY_KIND: Record<string, number> = {
  sniper: 4.0,
  rifle: 0.94,
  budget_rifle: 0.88,
  smg: 0.9,
  pistol: 0.7
};

/**
 * Bônus de precisão por tipo. SMG compensa dano com cadência; budget_rifle intermediário.
 */
export const HIT_CHANCE_BONUS_BY_KIND: Record<string, number> = {
  sniper: 0.14,
  rifle: 0.02,
  budget_rifle: 0.01,
  smg: 0.01,
  pistol: -0.02
};

/**
 * Multiplicador da penalidade por distância. SMG/pistol mais competitivos em médio alcance.
 */
export const RANGE_PENALTY_MULT_BY_KIND: Record<string, number> = {
  sniper: 0.22,
  rifle: 1,
  budget_rifle: 1.05,
  smg: 1.05,
  pistol: 1.0
};

/** Chance de headshot por tipo. Armas baratas ganham chance para compensar dano menor. */
export const HEADSHOT_CHANCE_BY_KIND: Record<string, number> = {
  sniper: 0.38,
  rifle: 0.11,
  budget_rifle: 0.1,
  smg: 0.09,
  pistol: 0.07
};

/** AWP: dano fixo alto (previsivel) — ~105 com mult; demais armas usam base aleatoria */
export const SNIPER_FIXED_DAMAGE = 23;

/** Multiplicador de dano em headshot (antes de armor). CS: ~4x. */
export const HEADSHOT_DAMAGE_MULTIPLIER = 4;

/** Redução do capacete em headshot (0=aplica 100% do dano, 0.5=reduz 50%). Rifles/SMG: capacete protege. */
export const HELMET_HEADSHOT_REDUCTION = 0.52;
/** AWP penetra capacete — redução menor. */
export const SNIPER_HELMET_HEADSHOT_REDUCTION = 0.18;
