import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode
} from "react";
import { marketPlayers } from "../../shared/mvpMock";
import { userProfile } from "../../shared/mvpMock";
import { useAuth } from "../auth";
import type { BotPlayer } from "../team/types";
import { useTeamContext } from "../team/TeamContext";
import { api } from "../../shared/apiClient";
import { filterListings, listingToPlayer, sortListings } from "./marketUtils";
import type { MarketFilters, MarketListing, MarketSort, PurchaseResult } from "./types";

type ApiTemplate = {
  id: string;
  name: string;
  role: "Sniper" | "Entry" | "Support" | "Lurker" | "IGL";
  aim: number;
  reflex: number;
  decision: number;
  composure: number;
  nationality: string | null;
  rarity: string;
  price: number;
};

function templateToListing(t: ApiTemplate): MarketListing {
  return {
    id: t.id,
    name: t.name,
    role: t.role,
    aim: t.aim,
    reflex: t.reflex,
    decision: t.decision,
    composure: t.composure,
    isStarter: false,
    nationality: t.nationality ?? undefined,
    price: t.price
  };
}

export const BOOSTER_PACK_PRICE = 1000;

type BoosterPackResult = {
  success: boolean;
  players?: BotPlayer[];
  reason?: "insufficient_balance" | "not_logged_in" | "no_team";
};

type MarketContextValue = {
  listings: MarketListing[];
  walletBalance: number;
  filters: MarketFilters;
  sort: MarketSort;
  setFilters: (filters: MarketFilters) => void;
  setSort: (sort: MarketSort) => void;
  purchase: (listing: MarketListing) => PurchaseResult | Promise<PurchaseResult>;
  purchaseBoosterPack: () => Promise<BoosterPackResult>;
  addWallet: (amount: number) => void;
  BOOSTER_PACK_PRICE: number;
};

const MarketContext = createContext<MarketContextValue | null>(null);

export const MarketProvider = ({ children }: { children: ReactNode }) => {
  const { user, fetchMe } = useAuth();
  const { team, addPlayer, teamId, isFromApi, refreshTeam } = useTeamContext();
  const [localWallet, setLocalWallet] = useState(userProfile.walletBalance);
  const [apiListings, setApiListings] = useState<MarketListing[]>([]);
  const walletBalance = user ? user.walletBalance : localWallet;
  const [filters, setFiltersState] = useState<MarketFilters>({});
  const [sort, setSort] = useState<MarketSort>("price-asc");

  useEffect(() => {
    if (!user) return;
    api
      .get<ApiTemplate[]>("/market/listings")
      .then((templates) => setApiListings(templates.map(templateToListing)))
      .catch(() => setApiListings([]));
  }, [user?.id]);

  const setFilters = useCallback((f: MarketFilters) => {
    setFiltersState(f);
  }, []);

  const addWallet = useCallback((amount: number) => {
    if (!user) setLocalWallet((prev) => Math.max(0, prev + amount));
  }, [user]);

  const purchase = useCallback(
    (listing: MarketListing): PurchaseResult | Promise<PurchaseResult> => {
      const ownedIds = new Set([...team.starters, ...team.bench].map((p) => p.id));
      if (walletBalance < (listing.price ?? 0)) {
        return { success: false, reason: "insufficient_balance" };
      }

      if (user && teamId && isFromApi) {
        return (async () => {
          try {
            await api.post(`/market/purchase`, { templateId: listing.id, teamId });
            await Promise.all([fetchMe(), refreshTeam()]);
            return { success: true };
          } catch {
            return { success: false, reason: "insufficient_balance" };
          }
        })();
      }

      if (ownedIds.has(listing.id)) {
        return { success: false, reason: "already_owned" };
      }
      const player = listingToPlayer(listing);
      if (!user) setLocalWallet((prev) => prev - (listing.price ?? 0));
      addPlayer(player, false);
      return { success: true, player };
    },
    [walletBalance, team.starters, team.bench, addPlayer, user, teamId, isFromApi, fetchMe, refreshTeam]
  );

  const purchaseBoosterPack = useCallback(async (): Promise<BoosterPackResult> => {
    if (walletBalance < BOOSTER_PACK_PRICE) {
      return { success: false, reason: "insufficient_balance" };
    }

    if (user && teamId && isFromApi) {
      try {
        const players = await api.post<Array<{ id: string; name: string; role: string; aim: number; reflex: number; decision: number; composure: number; isStarter: boolean; nationality: string | null }>>(
          "/market/booster-pack",
          { teamId }
        );
        await Promise.all([fetchMe(), refreshTeam()]);
        const mapped: BotPlayer[] = players.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role as BotPlayer["role"],
          aim: p.aim,
          reflex: p.reflex,
          decision: p.decision,
          composure: p.composure,
          isStarter: p.isStarter,
          nationality: p.nationality ?? undefined,
          kills: 0,
          deaths: 0,
          assists: 0
        }));
        return { success: true, players: mapped };
      } catch {
        return { success: false, reason: "insufficient_balance" };
      }
    }

    const ownedIds = new Set([...team.starters, ...team.bench].map((p) => p.id));
    const available = (marketPlayers as MarketListing[]).filter((p) => !ownedIds.has(p.id));
    if (available.length < 5) {
      return { success: false, reason: "insufficient_balance" };
    }
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 5);
    const mapped: BotPlayer[] = picked.map((l) => listingToPlayer(l));
    setLocalWallet((prev) => Math.max(0, prev - BOOSTER_PACK_PRICE));
    for (const p of mapped) {
      addPlayer(p, false);
    }
    return { success: true, players: mapped };
  }, [walletBalance, user, teamId, isFromApi, team.starters, team.bench, addPlayer, fetchMe, refreshTeam]);

  const ownedIds = useMemo(
    () => new Set([...team.starters, ...team.bench].map((p) => p.id)),
    [team.starters, team.bench]
  );

  const baseListings = user && apiListings.length > 0 ? apiListings : (marketPlayers as MarketListing[]);
  const listings = useMemo(() => {
    const available = baseListings.filter((p) => !ownedIds.has(p.id));
    const filtered = filterListings(available, filters);
    return sortListings(filtered, sort);
  }, [baseListings, filters, sort, ownedIds]);

  return (
    <MarketContext.Provider
      value={{
        listings,
        walletBalance,
        filters,
        sort,
        setFilters,
        setSort,
        purchase,
        purchaseBoosterPack,
        addWallet,
        BOOSTER_PACK_PRICE
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used within MarketProvider");
  return ctx;
};
