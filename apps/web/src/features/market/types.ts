import type { BotPlayer } from "../team/types";

/** Jogador listado no mercado — BotPlayer com preço obrigatório */
export type MarketListing = BotPlayer & {
  price: number;
};

/** Filtros e ordenação do mercado */
export type MarketFilters = {
  role?: BotPlayer["role"];
  nationality?: string;
  minRating?: number;
  maxPrice?: number;
};

export type MarketSort = "price-asc" | "price-desc" | "rating-desc" | "rating-asc" | "name";

/** Resultado de uma tentativa de compra (pode ser sync ou async) */
export type PurchaseResult =
  | { success: true; player?: BotPlayer }
  | { success: false; reason: "insufficient_balance" | "team_full" | "already_owned" };
