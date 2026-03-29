/**
 * Primárias usadas pelo motor (economia / combate). Lista estável para UI da Sandbox.
 */
export const SANDBOX_SELECTABLE_PRIMARIES = [
  "Glock-18",
  "USP-S",
  "MAC-10",
  "MP9",
  "Galil AR",
  "FAMAS",
  "AK-47",
  "M4A4",
  "AWP"
] as const;

export type SandboxSelectablePrimary = (typeof SANDBOX_SELECTABLE_PRIMARIES)[number];
