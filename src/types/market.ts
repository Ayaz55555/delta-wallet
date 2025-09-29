// Shared typed tuple definitions derived from on-chain ABIs
// V2 / V3 Market related tuple types

export type MarketBasicInfoTuple = readonly [
  string, // question
  string, // description
  bigint, // endTime
  number, // category (uint8 enum)
  bigint, // optionCount
  boolean, // resolved
  number, // marketType (uint8 enum)
  boolean, // invalidated
  bigint // totalVolume
];

export type MarketExtendedMetaTuple = readonly [
  bigint, // winningOptionId
  boolean, // disputed
  boolean, // validated
  `0x${string}`, // creator
  boolean // earlyResolutionAllowed
];

export type UserPortfolioTuple = readonly [
  bigint, // totalInvested
  bigint, // totalWinnings
  bigint, // unrealizedPnL (int256 but cast to bigint)
  bigint, // realizedPnL (int256 but cast to bigint)
  bigint // tradeCount
];

export interface PendingMarketMapped {
  marketId: number;
  question: string;
  description: string;
  creator: `0x${string}`;
  createdAt: bigint; // currently unknown from basic/extended calls
  endTime: bigint;
  optionCount: bigint;
  category: number;
  validated: boolean;
  invalidated: boolean;
  resolved: boolean;
  disputed: boolean;
  totalVolume: bigint;
  earlyResolutionAllowed: boolean;
}

export function mapMarketInfo(
  marketId: number,
  basic: MarketBasicInfoTuple,
  extended: MarketExtendedMetaTuple
): PendingMarketMapped {
  const [
    question,
    description,
    endTime,
    category,
    optionCount,
    resolved,
    _marketType,
    invalidated,
    totalVolume,
  ] = basic;
  const [
    _winningOptionId,
    disputed,
    validated,
    creator,
    earlyResolutionAllowed,
  ] = extended;

  return {
    marketId,
    question,
    description,
    creator,
    createdAt: 0n,
    endTime,
    optionCount,
    category,
    validated,
    invalidated,
    resolved,
    disputed,
    totalVolume,
    earlyResolutionAllowed,
  };
}
