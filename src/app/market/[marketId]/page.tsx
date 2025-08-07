import {
  contract,
  contractAbi,
  publicClient,
  V2contractAddress,
  V2contractAbi,
} from "@/constants/contract";
import { Metadata, ResolvingMetadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// V1 Market Info Contract Return
type MarketInfoV1ContractReturn = readonly [
  string, // question
  string, // optionA
  string, // optionB
  bigint, // endTime
  number, // outcome
  bigint, // totalOptionAShares
  bigint, // totalOptionBShares
  boolean // resolved
];

// V2 Market Info Contract Return
type MarketInfoV2ContractReturn = readonly [
  string, // question
  string, // description
  bigint, // endTime
  number, // category
  bigint, // optionCount
  boolean, // resolved
  boolean, // disputed
  bigint, // winningOptionId
  string // creator
];

// Helper function to determine market version and fetch data
async function fetchMarketData(marketId: string) {
  if (!process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL) {
    throw new Error("NEXT_PUBLIC_ALCHEMY_RPC_URL is not set");
  }

  const marketIdBigInt = BigInt(marketId);

  // Try V2 first (newer contract)
  try {
    const v2MarketData = (await publicClient.readContract({
      address: V2contractAddress,
      abi: V2contractAbi,
      functionName: "getMarketInfo",
      args: [marketIdBigInt],
    })) as MarketInfoV2ContractReturn;

    // If successful and market exists, return V2 data
    if (v2MarketData[0]) {
      // question exists
      return {
        version: "v2" as const,
        data: v2MarketData,
      };
    }
  } catch (error) {
    // V2 market doesn't exist, try V1
    console.log(`Market ${marketId} not found in V2, trying V1...`);
  }

  // Try V1
  try {
    const v1MarketData = (await publicClient.readContract({
      address: contract.address,
      abi: contractAbi,
      functionName: "getMarketInfo",
      args: [marketIdBigInt],
    })) as MarketInfoV1ContractReturn;

    // If successful and market exists, return V1 data
    if (v1MarketData[0]) {
      // question exists
      return {
        version: "v1" as const,
        data: v1MarketData,
      };
    }
  } catch (error) {
    console.log(`Market ${marketId} not found in V1 either`);
  }

  throw new Error(`Market ${marketId} not found in either V1 or V2 contracts`);
}

export async function generateMetadata(
  { params }: { params: Promise<{ marketId: string }> },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  parent: ResolvingMetadata
): Promise<Metadata> {
  try {
    const { marketId } = await params;

    if (!marketId || isNaN(Number(marketId))) {
      console.error("generateMetadata: Invalid marketId", marketId);
      throw new Error("Invalid marketId");
    }

    const marketResult = await fetchMarketData(marketId);

    let market: any;
    let yesPercent = "0.0";

    if (marketResult.version === "v1") {
      const marketData = marketResult.data as MarketInfoV1ContractReturn;
      market = {
        question: marketData[0],
        optionA: marketData[1],
        optionB: marketData[2],
        endTime: marketData[3],
        outcome: marketData[4],
        totalOptionAShares: marketData[5],
        totalOptionBShares: marketData[6],
        resolved: marketData[7],
        version: "v1",
      };

      const total = market.totalOptionAShares + market.totalOptionBShares;
      yesPercent =
        total > 0n
          ? (Number((market.totalOptionAShares * 1000n) / total) / 10).toFixed(
              1
            )
          : "0.0";
    } else {
      const marketData = marketResult.data as MarketInfoV2ContractReturn;
      market = {
        question: marketData[0],
        description: marketData[1],
        endTime: marketData[2],
        category: marketData[3],
        optionCount: Number(marketData[4]), // Convert bigint to number
        resolved: marketData[5],
        disputed: marketData[6],
        winningOptionId: Number(marketData[7]), // Convert bigint to number
        creator: marketData[8],
        version: "v2",
      };

      // For V2, use a generic description
      yesPercent = "Multi-option";
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://buster-mkt.vercel.app";
    const imageUrl = `${baseUrl}/api/market-image?marketId=${marketId}`;
    const postUrl = `${baseUrl}/api/frame-action`;
    const marketUrl = `${baseUrl}/market/${marketId}/details`;

    const description =
      market.version === "v1"
        ? `View market: ${market.question} - ${market.optionA}: ${yesPercent}%`
        : `View market: ${market.question} - ${market.optionCount} options available`;

    return {
      title: market.question,
      description,
      other: {
        "fc:miniapp": "vNext",
        "fc:miniapp:image": imageUrl,
        "fc:miniapp:post_url": postUrl,
        "fc:miniapp:button:1": "View",
        "fc:miniapp:button:1:action": "post",
        "fc:miniapp:state": Buffer.from(JSON.stringify({ marketId })).toString(
          "base64"
        ),
      },
      metadataBase: new URL(baseUrl),
      openGraph: {
        title: market.question,
        description,
        images: [
          { url: imageUrl, width: 1200, height: 630, alt: market.question },
        ],
        url: marketUrl,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: market.question,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Market Not Found",
      description: "Unable to load market data for metadata",
    };
  }
}

export default async function MarketPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  if (!marketId || isNaN(Number(marketId))) {
    notFound();
  }

  redirect(`/market/${marketId}/details`);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="mb-4">Redirecting to market details...</p>
      <Button asChild variant="outline">
        <Link href="/">Home</Link>
      </Button>
    </div>
  );
}
