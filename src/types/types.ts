// V1 Market (Legacy - Binary options)
export interface Market {
  question: string;
  optionA: string;
  optionB: string;
  endTime: string;
  outcome: string;
  totalOptionAShares: number;
  totalOptionBShares: number;
  resolved: boolean;
}

// V2 Market Categories
export enum MarketCategory {
  POLITICS = 0,
  SPORTS = 1,
  ENTERTAINMENT = 2,
  TECHNOLOGY = 3,
  ECONOMICS = 4,
  SCIENCE = 5,
  WEATHER = 6,
  OTHER = 7,
}

// V2 Market Option
export interface MarketOption {
  name: string;
  description: string;
  totalShares: bigint;
  totalVolume: bigint;
  currentPrice: bigint;
  isActive: boolean;
}

// V2 Market (Multi-option)
export interface MarketV2 {
  question: string;
  description: string;
  endTime: bigint;
  category: MarketCategory;
  optionCount: number;
  options: MarketOption[];
  resolved: boolean;
  disputed: boolean;
  validated: boolean;
  winningOptionId: number;
  creator: string;
  totalLiquidity?: bigint;
  totalVolume?: bigint;
  createdAt?: bigint;
}

// V2 User Portfolio
export interface UserPortfolio {
  totalInvested: bigint;
  totalWinnings: bigint;
  unrealizedPnL: bigint;
  realizedPnL: bigint;
  tradeCount: number;
}

// V2 Market Stats from Contract
export interface MarketStatsV2 {
  totalVolume: bigint;
  participantCount: number;
  averagePrice: bigint;
  priceVolatility: bigint;
  lastTradePrice: bigint;
  lastTradeTime: bigint;
}

export interface PriceHistoryData {
  date: string;
  timestamp: number;
  optionA: number;
  optionB: number;
  volume: number;
  trades?: number;
}

export interface VolumeHistoryData {
  date: string;
  timestamp: number;
  volume: number;
  trades: number;
}

export interface MarketAnalytics {
  priceHistory: PriceHistoryData[];
  volumeHistory: VolumeHistoryData[];
  totalVolume: number;
  totalTrades: number;
  priceChange24h: number;
  volumeChange24h: number;
  lastUpdated: string;
}

export interface MarketStats {
  marketId: string;
  currentPriceA: number;
  currentPriceB: number;
  totalShares: number;
  totalVolume: number;
  confidence: number;
  trend: "up" | "down" | "stable";
}
