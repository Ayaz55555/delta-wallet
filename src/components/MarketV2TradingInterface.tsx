"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { MarketV2BuyInterface } from "./market-v2-buy-interface";
import { MarketV2SellInterface } from "./MarketV2SellInterface";
import { MarketV2, MarketOption } from "@/types/types";
import { ShoppingCart, TrendingDown } from "lucide-react";

interface MarketV2TradingInterfaceProps {
  marketId: number;
  market: MarketV2;
  onSellComplete?: () => void;
}

export function MarketV2TradingInterface({
  marketId,
  market,
  onSellComplete,
}: MarketV2TradingInterfaceProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <ShoppingCart className="w-5 h-5" />
          Trade Shares
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "buy" | "sell")}
        >
          <TabsList className="grid w-full grid-cols-2 h-10 md:h-11">
            <TabsTrigger
              value="buy"
              className="text-sm md:text-base flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Buy
            </TabsTrigger>
            <TabsTrigger
              value="sell"
              className="text-sm md:text-base flex items-center gap-2"
            >
              <TrendingDown className="w-4 h-4" />
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="mt-4">
            <MarketV2BuyInterface marketId={marketId} market={market} />
          </TabsContent>

          <TabsContent value="sell" className="mt-4">
            <MarketV2SellInterface
              marketId={marketId}
              market={market}
              onSellComplete={onSellComplete}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
