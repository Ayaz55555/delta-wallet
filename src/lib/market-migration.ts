import {
  contractAddress,
  contractAbi,
  V2contractAddress,
  V2contractAbi,
  publicClient,
} from "@/constants/contract";
import { Market, MarketV2, MarketCategory, MarketOption } from "@/types/types";

// Determine if a market is V1 (binary) or V2 (multi-option)
export async function detectMarketVersion(
  marketId: number
): Promise<"v1" | "v2"> {
  try {
    // Try to fetch V2 market info first
    const v2MarketInfo = await publicClient.readContract({
      address: V2contractAddress,
      abi: V2contractAbi,
      functionName: "getMarketInfo",
      args: [BigInt(marketId)],
    });

    // If successful and has optionCount > 2, it's V2
    const optionCount = Number(v2MarketInfo[4]);
    if (optionCount > 2) {
      return "v2";
    }

    // If optionCount is 2, check if it has V2-specific features
    const hasDescription = v2MarketInfo[1] && v2MarketInfo[1].length > 0; // description field
    if (hasDescription) {
      return "v2";
    }

    return "v1";
  } catch (error) {
    // If V2 call fails, assume it's V1
    console.log("Market appears to be V1:", error);
    return "v1";
  }
}

// Fetch V1 market data
export async function fetchV1Market(marketId: number): Promise<Market> {
  const marketData = await publicClient.readContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  });

  const [
    question,
    optionA,
    optionB,
    endTime,
    outcome,
    totalOptionAShares,
    totalOptionBShares,
    resolved,
  ] = marketData;

  return {
    question,
    optionA,
    optionB,
    endTime: endTime.toString(),
    outcome: outcome.toString(),
    totalOptionAShares: Number(totalOptionAShares),
    totalOptionBShares: Number(totalOptionBShares),
    resolved,
  };
}

// Fetch V2 market data
export async function fetchV2Market(marketId: number): Promise<MarketV2> {
  const marketInfo = await publicClient.readContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  });

  const [
    question,
    description,
    endTime,
    category,
    optionCount,
    resolved,
    disputed,
    winningOptionId,
    creator,
  ] = marketInfo;

  // Fetch all options
  const options: MarketOption[] = [];
  for (let i = 0; i < Number(optionCount); i++) {
    try {
      const optionData = await publicClient.readContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "getMarketOption",
        args: [BigInt(marketId), BigInt(i)],
      });

      const [
        name,
        optionDescription,
        totalShares,
        totalVolume,
        currentPrice,
        isActive,
      ] = optionData;

      options.push({
        name,
        description: optionDescription,
        totalShares,
        totalVolume,
        currentPrice,
        isActive,
      });
    } catch (error) {
      console.error(`Error fetching option ${i}:`, error);
      // Add placeholder option if fetch fails
      options.push({
        name: `Option ${i + 1}`,
        description: "",
        totalShares: 0n,
        totalVolume: 0n,
        currentPrice: 0n,
        isActive: true,
      });
    }
  }

  return {
    question,
    description,
    endTime,
    category: category as MarketCategory,
    optionCount: Number(optionCount),
    options,
    resolved,
    disputed,
    validated: true, // Assume validated if we can fetch it
    winningOptionId: Number(winningOptionId),
    creator,
  };
}

// Unified market fetcher that returns appropriate market data
export async function fetchMarketData(
  marketId: number
): Promise<{ version: "v1" | "v2"; market: Market | MarketV2 }> {
  const version = await detectMarketVersion(marketId);

  if (version === "v2") {
    const market = await fetchV2Market(marketId);
    return { version: "v2", market };
  } else {
    const market = await fetchV1Market(marketId);
    return { version: "v1", market };
  }
}

// Get total market count across both contracts
export async function getTotalMarketCount(): Promise<{
  v1Count: number;
  v2Count: number;
  total: number;
}> {
  try {
    const [v1Count, v2Count] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "getMarketCount",
        args: [],
      }),
      publicClient.readContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "getMarketCount",
        args: [],
      }),
    ]);

    return {
      v1Count: Number(v1Count),
      v2Count: Number(v2Count),
      total: Number(v1Count) + Number(v2Count),
    };
  } catch (error) {
    console.error("Error fetching market counts:", error);
    // Fallback to V1 only
    try {
      const v1Count = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "getMarketCount",
        args: [],
      });

      return {
        v1Count: Number(v1Count),
        v2Count: 0,
        total: Number(v1Count),
      };
    } catch (v1Error) {
      console.error("Error fetching V1 market count:", v1Error);
      return { v1Count: 0, v2Count: 0, total: 0 };
    }
  }
}
