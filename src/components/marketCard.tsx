"use client";

interface Market {
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  outcome: number;
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  resolved: boolean;
}

export interface Market {
  question: string;
  optionA: string;
  optionB: string;
  endTime: bigint;
  outcome: number;
  totalOptionAShares: bigint;
  totalOptionBShares: bigint;
  resolved: boolean;
}

interface MarketCardProps {
  index: number;
  market: Market;
}

export function MarketCard({ index, market }: MarketCardProps) {

  return (
    <div className="bg-card p-4 rounded-xl border border-primary/20 hover:border-primary transition-all">
      <h2 className="text-primary font-semibold">{market.question}</h2>
      <div className="flex justify-between text-sm mt-4">
        <span>Yes: {Math.round((Number(market.totalOptionAShares) / (Number(market.totalOptionAShares) + Number(market.totalOptionBShares))) * 100)}%</span>
        <span>No: {Math.round((Number(market.totalOptionBShares) / (Number(market.totalOptionAShares) + Number(market.totalOptionBShares))) * 100)}%</span>
      </div>
      <p className="text-xs mt-2 text-secondary">Vol: {(Number(market.totalOptionAShares) + Number(market.totalOptionBShares)).toLocaleString()} USDT</p>
    </div>
  );
}
