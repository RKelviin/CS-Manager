import { getPlayerTotal } from "../../shared/mvpMock";
import { marketPlayers } from "../../shared/mvpMock";
import type { BotPlayer } from "../team/types";
import type { MarketFilters, MarketListing, MarketSort } from "./types";

/** Preço do jogador no mercado (undefined se não estiver no catálogo) */
export const getMarketPriceById = (playerId: string): number | undefined =>
  marketPlayers.find((p) => p.id === playerId)?.price;

/** Valor de venda: preço do mercado ou estimativa por pontuação (para jogadores do time inicial) */
export const getSellPrice = (playerId: string, totalRating: number): number =>
  getMarketPriceById(playerId) ?? Math.max(50, Math.round(totalRating * 2.5));

/** Converte MarketListing em BotPlayer (remove price, adiciona kills/deaths/assists) */
export const listingToPlayer = (listing: MarketListing): BotPlayer => {
  const { price: _price, ...rest } = listing;
  return {
    ...rest,
    kills: 0,
    deaths: 0,
    assists: 0,
    isStarter: false
  };
};

/** Filtra listagens conforme MarketFilters */
export const filterListings = (listings: MarketListing[], filters: MarketFilters): MarketListing[] => {
  return listings.filter((p) => {
    if (filters.role && p.role !== filters.role) return false;
    if (filters.nationality && (p.nationality ?? "") !== filters.nationality) return false;
    const total = getPlayerTotal(p);
    if (filters.minRating != null && total < filters.minRating) return false;
    if (filters.maxPrice != null && (p.price ?? 0) > filters.maxPrice) return false;
    return true;
  });
};

/** Ordena listagens conforme MarketSort */
export const sortListings = (listings: MarketListing[], sort: MarketSort): MarketListing[] => {
  const sorted = [...listings];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    case "price-desc":
      return sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    case "rating-desc":
      return sorted.sort((a, b) => getPlayerTotal(b) - getPlayerTotal(a));
    case "rating-asc":
      return sorted.sort((a, b) => getPlayerTotal(a) - getPlayerTotal(b));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return sorted;
  }
};
