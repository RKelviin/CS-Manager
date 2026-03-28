/** Objetivo principal: plantar e defusar C4 (tempos estilo CS, simplificados). */
export const PLANT_TIME_MS = 3200;
/** Apos plantar, tempo ate explosao */
export const POST_PLANT_EXPLODE_MS = 40000;
export const DEFUSE_NO_KIT_MS = 10000;
export const DEFUSE_KIT_MS = 5000;
/** Raio em px do centro da C4 — CT deve ficar encima da bomba para defusar */
export const DEFUSE_RADIUS = 28;
/** Kit largado no chao: CT sem kit recolhe ao passar (mesma ordem de grandeza que pickup da C4) */
export const DEFUSE_KIT_DROP_PICKUP_RADIUS = 48;
/** Arma largada no chao: qualquer jogador vivo pode trocar se for upgrade de tier */
export const WEAPON_DROP_PICKUP_RADIUS = 48;
