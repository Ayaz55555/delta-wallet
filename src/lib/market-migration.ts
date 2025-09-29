import {
  contractAddress,
  contractAbi,
  V2contractAddress,
  V2contractAbi,
  publicClient,
  PolicastViewsAbi,
  PolicastViews,
} from "@/constants/contract";
import {
  Market,
  MarketV2,
  MarketCategory,
  MarketType,
  MarketOption,
} from "@/types/types";

// Determine if a market is V1 (binary) or V2 (multi-option)
export async function detectMarketVersion(
  marketId: number
): Promise<"v1" | "v2"> {
  try {
    // Try both V1 and V2 in parallel
    const [v1Result, v2Result] = await Promise.allSettled([
      publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "getMarketInfo",
        args: [BigInt(marketId)],
      }),
      publicClient.readContract({
        address: PolicastViews,
        abi: PolicastViewsAbi,
        functionName: "getMarketInfo",
        args: [BigInt(marketId)],
      }),
    ]);

    const v1Exists = v1Result.status === "fulfilled";
    const v2Exists = v2Result.status === "fulfilled";

    // If only one version exists, return that one
    if (v1Exists && !v2Exists) return "v1";
    if (v2Exists && !v1Exists) return "v2";

    // If both exist, we need to decide which one to prioritize
    if (v1Exists && v2Exists) {
      // Check if markets are active/ended to decide priority
      const v1Data = v1Result.value as unknown as any[];
      const v2Data = v2Result.value as unknown as any[];

      // V1 market structure: [question, optionA, optionB, endTime, outcome, totalOptionAShares, totalOptionBShares, resolved]
      const v1EndTime = Number(v1Data[3]);
      const v1Resolved = v1Data[7] as boolean;

      // V2 market structure: [question, description, endTime, category, optionCount, resolved, disputed, marketType, invalidated, winningOptionId, creator]
      const v2EndTime = Number(v2Data[2]);
      const v2Resolved = v2Data[5] as boolean;

      const currentTime = Math.floor(Date.now() / 1000);

      // Priority logic:
      // 1. If one is active and other is ended/resolved, prefer active
      // 2. If both are active or both are ended, prefer V2 (newer contract)
      // 3. If times are very different, prefer the one with later end time

      const v1Active = !v1Resolved && v1EndTime > currentTime;
      const v2Active = !v2Resolved && v2EndTime > currentTime;

      if (v2Active && !v1Active) {
        console.log(`Market ${marketId}: V2 active, V1 ended - choosing V2`);
        return "v2";
      }
      if (v1Active && !v2Active) {
        console.log(`Market ${marketId}: V1 active, V2 ended - choosing V1`);
        return "v1";
      }

      // If both have same status, prefer V2 (newer contract)
      console.log(
        `Market ${marketId}: Both versions exist with same status - preferring V2`
      );
      return "v2";
    }

    // If neither exists, fallback to V1
    console.log(`Market ${marketId}: Neither version found - defaulting to V1`);
    return "v1";
  } catch (error) {
    console.error(`Error detecting market version for ${marketId}:`, error);
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
  const marketInfoRaw = await publicClient.readContract({
    address: PolicastViews,
    abi: PolicastViewsAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
  });

  const marketInfoArr = marketInfoRaw as unknown as readonly any[];

  // The V2 `getMarketInfo` shape has changed across versions. Support both
  // legacy (short) and newer (long) tuple shapes by checking length and
  // mapping indices defensively.
  let question = "";
  let description = "";
  let endTime: bigint = 0n;
  let category: MarketCategory = 0 as MarketCategory;
  let optionCount: bigint = 0n;
  let resolved = false;
  let disputed = false;
  let marketTypeValue: number = 0;
  let invalidated = false;
  let validated = false;
  let totalVolume: bigint = 0n;
  let winningOptionId: bigint = 0n;
  let creator = "";
  let earlyResolutionAllowed = false;

  if (marketInfoArr.length >= 13) {
    // Newer V2 shape (13+ entries)
    // Based on V2 contract ABI:
    // 0: question, 1: description, 2: endTime, 3: category, 4: optionCount,
    // 5: resolved, 6: winningOptionId, 7: disputed, 8: validated, 9: invalidated,
    // 10: totalVolume, 11: creator, 12: earlyResolutionAllowed
    question = String(marketInfoArr[0] ?? "");
    description = String(marketInfoArr[1] ?? "");
    endTime = BigInt(marketInfoArr[2] ?? 0n);
    category = Number(marketInfoArr[3] ?? 0) as MarketCategory;
    optionCount = BigInt(marketInfoArr[4] ?? 0n);
    resolved = Boolean(marketInfoArr[5]);
    winningOptionId = BigInt(marketInfoArr[6] ?? 0n);
    disputed = Boolean(marketInfoArr[7]);
    // Note: validated is at index 8, invalidated is at index 9
    validated = Boolean(marketInfoArr[8]);
    invalidated = Boolean(marketInfoArr[9]);
    totalVolume = BigInt(marketInfoArr[10] ?? 0n);
    creator = String(marketInfoArr[11] ?? "");
    earlyResolutionAllowed = Boolean(marketInfoArr[12]);
  } else {
    // Legacy/shorter shape used previously
    question = String(marketInfoArr[0] ?? "");
    description = String(marketInfoArr[1] ?? "");
    endTime = BigInt(marketInfoArr[2] ?? 0n);
    category = Number(marketInfoArr[3] ?? 0) as MarketCategory;
    optionCount = BigInt(marketInfoArr[4] ?? 0n);
    resolved = Boolean(marketInfoArr[5]);
    disputed = Boolean(marketInfoArr[6]);
    marketTypeValue = Number(marketInfoArr[7] ?? 0);
    invalidated = Boolean(marketInfoArr[8]);
    totalVolume = BigInt(marketInfoArr[9] ?? 0n);
    // winningOptionId / creator / earlyResolutionAllowed not present in legacy
  }

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
        optionTotalVolume,
        currentPrice,
        isActive,
      ] = optionData as readonly any[];

      options.push({
        name: String(name ?? ""),
        description: String(optionDescription ?? ""),
        totalShares: BigInt(totalShares ?? 0n),
        totalVolume: BigInt(optionTotalVolume ?? 0n),
        currentPrice: BigInt(currentPrice ?? 0n),
        isActive: Boolean(isActive),
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
    marketType: marketTypeValue as MarketType,
    optionCount: optionCount,
    options,
    resolved,
    disputed,
    validated,
    invalidated,
    earlyResolutionAllowed,
    winningOptionId,
    creator,
    createdAt: 0n, // Not available in basic market info
    adminInitialLiquidity: 0n,
    userLiquidity: 0n,
    totalVolume,
    platformFeesCollected: 0n,
    ammFeesCollected: 0n,
    adminLiquidityClaimed: false,
    ammLiquidityPool: 0n,
    payoutIndex: 0n,
  };
}

// Unified market fetcher that returns appropriate market data
export async function fetchMarketData(
  marketId: number
): Promise<{ version: "v1" | "v2"; market: Market | MarketV2 }> {
  const version = await detectMarketVersion(marketId);

  try {
    if (version === "v2") {
      const market = await fetchV2Market(marketId);
      return { version: "v2", market };
    } else {
      const market = await fetchV1Market(marketId);
      return { version: "v1", market };
    }
  } catch (error) {
    console.error(`Failed to fetch ${version} market ${marketId}:`, error);

    // Fallback: try the other version if the detected one fails
    try {
      if (version === "v2") {
        console.log(`Fallback: trying V1 for market ${marketId}`);
        const market = await fetchV1Market(marketId);
        return { version: "v1", market };
      } else {
        console.log(`Fallback: trying V2 for market ${marketId}`);
        const market = await fetchV2Market(marketId);
        return { version: "v2", market };
      }
    } catch (fallbackError) {
      console.error(
        `Fallback also failed for market ${marketId}:`,
        fallbackError
      );
      throw new Error(
        `Market ${marketId} not found in either V1 or V2 contracts`
      );
    }
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
      }) as Promise<bigint>,
      publicClient.readContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "marketCount",
        args: [],
      }) as Promise<bigint>,
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
