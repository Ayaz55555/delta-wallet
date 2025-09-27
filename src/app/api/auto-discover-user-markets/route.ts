import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { V2contractAddress, V2contractAbi } from "@/constants/contract";

const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || "https://mainnet.base.org"
  ),
});
//
interface UserWinnings {
  marketId: number;
  amount: bigint; // raw token amount (1e18 scaled)
  hasWinnings: boolean; // true if claimable now
}

interface MarketBasicInfo {
  resolved: boolean;
  invalidated: boolean;
  optionCount: number;
}

// Helper: safe bigint parse
const toBigInt = (v: any, def: bigint = 0n) => {
  try {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(v);
    if (typeof v === "string" && v !== "") return BigInt(v);
    return def;
  } catch {
    return def;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userAddress } = body;

    if (!userAddress) {
      return NextResponse.json(
        { error: "User address is required" },
        { status: 400 }
      );
    }

    console.log("[winnings-api] Auto-discover start", { userAddress });

    // Step 1: Discover markets via trade history
    let participatedMarkets = await discoverUserMarketsFromTrades(userAddress);
    console.log("[winnings-api] markets from trades", participatedMarkets);

    // Step 2: Fallback scan (resolved markets only) if none found
    if (participatedMarkets.length === 0) {
      console.log("[winnings-api] No markets via trades -> fallback scan");
      participatedMarkets = await fallbackScanParticipation(userAddress);
      console.log("[winnings-api] fallback markets", participatedMarkets);
    }

    // Deduplicate & sort
    participatedMarkets = Array.from(new Set(participatedMarkets)).sort(
      (a, b) => a - b
    );

    // Step 3: Compute claimable winnings (on-chain; no stub reliance)
    const winningsData = await computeClaimableWinnings(
      userAddress,
      participatedMarkets
    );

    console.log("[winnings-api] claimable markets count", winningsData.length);

    return NextResponse.json({
      participatedMarkets,
      winningsData,
      totalMarkets: participatedMarkets.length,
      claimableMarkets: winningsData.length,
    });
  } catch (error) {
    console.error("Auto-discover user markets error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to auto-discover user markets: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// Step 1: Discover markets from trade history directly
async function discoverUserMarketsFromTrades(
  userAddress: string
): Promise<number[]> {
  const tradeHistory = await readUserTradeHistory(userAddress);
  if (!tradeHistory.length) return [];
  const markets = new Set<number>();
  for (const trade of tradeHistory) {
    // Support both tuple and object
    const marketIdRaw = (trade && (trade.marketId ?? trade[0])) as any;
    const mId = Number(marketIdRaw);
    if (!Number.isNaN(mId)) markets.add(mId);
  }
  return Array.from(markets).sort((a, b) => a - b);
}

// Fallback: scan resolved markets to detect participation via winning option shares OR any option shares
async function fallbackScanParticipation(
  userAddress: string
): Promise<number[]> {
  const markets: number[] = [];
  try {
    const mCount = Number(
      await (publicClient.readContract as any)({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "marketCount",
      })
    );
    if (mCount === 0) return markets;

    const PAYOUT = await (publicClient.readContract as any)({
      address: V2contractAddress,
      abi: V2contractAbi,
      functionName: "PAYOUT_PER_SHARE",
    });
    void PAYOUT; // not needed for participation detection

    const maxScan = Math.min(mCount, 300); // safety cap
    for (let marketId = 0; marketId < maxScan; marketId++) {
      try {
        const basic: any = await (publicClient.readContract as any)({
          address: V2contractAddress,
          abi: V2contractAbi,
          functionName: "getMarketBasicInfo",
          args: [BigInt(marketId)],
        });
        // basic tuple indices: 0 question,1 desc,2 endTime,3 category,4 optionCount,5 resolved,6 marketType,7 invalidated,8 totalVolume
        const optionCount = Number(basic[4] ?? 0);
        let participated = false;
        for (let option = 0; option < optionCount; option++) {
          const shares = await (publicClient.readContract as any)({
            address: V2contractAddress,
            abi: V2contractAbi,
            functionName: "getMarketOptionUserShares",
            args: [
              BigInt(marketId),
              BigInt(option),
              userAddress as `0x${string}`,
            ],
          });
          if (toBigInt(shares) > 0n) {
            participated = true;
            break;
          }
        }
        if (participated) markets.push(marketId);
      } catch (err) {
        // ignore individual market errors
      }
    }
  } catch (e) {
    console.warn("[winnings-api] fallback scan failed", e);
  }
  return markets;
}

// Try to read user's trade history directly from contract
async function readUserTradeHistory(userAddress: string): Promise<any[]> {
  try {
    const trades: any[] = [];
    let index = 0;
    const maxAttempts = 100; // Prevent infinite loops

    while (index < maxAttempts) {
      try {
        const trade = (await (publicClient.readContract as any)({
          address: V2contractAddress,
          abi: V2contractAbi,
          functionName: "userTradeHistory",
          args: [userAddress as `0x${string}`, BigInt(index)],
        })) as unknown;

        if (trade) {
          trades.push(trade);
          index++;
        } else {
          // No more trades
          break;
        }
      } catch (error) {
        // If we get a contract revert, it likely means we've reached the end
        console.log(`Reached end of trade history at index ${index}`);
        break;
      }
    }

    console.log(
      `Successfully read ${trades.length} trades from userTradeHistory`
    );
    return trades;
  } catch (error) {
    console.error("Failed to read user trade history:", error);
    throw error;
  }
}

// Compute claimable winnings for markets
async function computeClaimableWinnings(
  userAddress: string,
  markets: number[]
): Promise<UserWinnings[]> {
  if (!markets.length) return [];
  const results: UserWinnings[] = [];

  // Read payout constant once
  let payoutPerShare: bigint = 100n * 10n ** 18n;
  try {
    payoutPerShare = await (publicClient.readContract as any)({
      address: V2contractAddress,
      abi: V2contractAbi,
      functionName: "PAYOUT_PER_SHARE",
    });
  } catch {
    /* fallback to constant */
  }

  for (const marketId of markets) {
    try {
      const basic: any = await (publicClient.readContract as any)({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "getMarketBasicInfo",
        args: [BigInt(marketId)],
      });
      const resolved = Boolean(basic[5]);
      const invalidated = Boolean(basic[7]);
      if (!resolved || invalidated) continue;

      const extended: any = await (publicClient.readContract as any)({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "getMarketExtendedMeta",
        args: [BigInt(marketId)],
      });
      const winningOptionId = toBigInt(extended[0]);
      const disputed = Boolean(extended[1]);
      if (disputed) continue;

      const userShares = await (publicClient.readContract as any)({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "getMarketOptionUserShares",
        args: [BigInt(marketId), winningOptionId, userAddress as `0x${string}`],
      });
      const sharesBI = toBigInt(userShares);
      if (sharesBI === 0n) continue;

      // Simulate claim to ensure not already claimed / still claimable
      let claimable = false;
      try {
        await publicClient.simulateContract({
          address: V2contractAddress,
          abi: V2contractAbi,
          functionName: "claimWinnings",
          args: [BigInt(marketId)],
          account: userAddress as `0x${string}`,
        });
        claimable = true; // simulation succeeded
      } catch (simError: any) {
        // If revert indicates AlreadyClaimed or NoWinningShares treat as not claimable
        const msg = (
          simError?.shortMessage ||
          simError?.message ||
          ""
        ).toLowerCase();
        if (msg.includes("alreadyclaimed") || msg.includes("nowinningshares")) {
          claimable = false;
        } else {
          // Other errors (e.g., MarketNotReady) also render not claimable
          claimable = false;
        }
      }
      if (!claimable) continue;

      const amount = (sharesBI * payoutPerShare) / 10n ** 18n; // shares (1e18) * payout (1e18) / 1e18
      if (amount > 0n) {
        results.push({ marketId, amount, hasWinnings: true });
      }
    } catch (err) {
      // Skip problematic market
      console.debug(`[winnings-api] market ${marketId} processing error`, err);
    }
  }
  return results;
}
