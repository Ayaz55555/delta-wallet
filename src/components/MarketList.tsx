"use client";

import { UnifiedMarketList } from "./unified-market-list";

interface MarketListProps {
  filter: "active" | "pending" | "resolved";
}

export function MarketList({ filter }: MarketListProps) {
  // Delegate to the unified component that handles both V1 and V2 markets
  return <UnifiedMarketList filter={filter} />;
}
