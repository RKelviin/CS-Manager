import { listingToPlayer } from "./marketUtils";
import type { MarketListing } from "./types";
import { PlayerCard } from "../team/PlayerCard";

type Props = {
  listing: MarketListing;
  onBuy: () => void;
  canAfford: boolean;
  disabled?: boolean;
};

export const MarketPlayerCard = ({ listing, onBuy, canAfford, disabled }: Props) => {
  const player = listingToPlayer(listing);
  const price = listing.price ?? 0;

  return (
    <div style={{ width: "100%", maxWidth: 108, minWidth: 0 }}>
      <PlayerCard
        player={player}
        variant="market"
        price={price}
        onBuy={onBuy}
        canAfford={canAfford && !disabled}
      />
    </div>
  );
};
