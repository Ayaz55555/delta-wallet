"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { V2contractAddress, V2contractAbi } from "@/constants/contract";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Coins } from "lucide-react";
import { toast } from "sonner";

interface UserWinnings {
  marketId: number;
  amount: bigint;
  hasWinnings: boolean;
}

export function ClaimWinningsSection() {
  const { address, isConnected } = useAccount();
  const [userMarkets, setUserMarkets] = useState<number[]>([]);
  const [winningsData, setWinningsData] = useState<UserWinnings[]>([]);
  const [loading, setLoading] = useState(false);

  // Contract write for claiming winnings
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Auto-discover markets where user participated
  const fetchUserMarkets = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auto-discover-user-markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Auto-discovered markets:", data);

        // Set winnings data directly from API response
        setWinningsData(data.winningsData || []);
        setUserMarkets(data.participatedMarkets || []);
      } else {
        console.error("Failed to auto-discover markets:", response.statusText);
        // Fallback to empty state
        setWinningsData([]);
        setUserMarkets([]);
      }
    } catch (error) {
      console.error("Error auto-discovering markets:", error);
      // Fallback to empty state
      setWinningsData([]);
      setUserMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Auto-discover user's participated markets
  useEffect(() => {
    if (isConnected && address) {
      // Use auto-discovery instead of hardcoded range
      fetchUserMarkets();
    }
  }, [isConnected, address, fetchUserMarkets]);

  // Handle claiming winnings
  const handleClaimWinnings = async (marketId: number) => {
    if (!address) return;

    try {
      writeContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "claimWinnings",
        args: [BigInt(marketId)],
      });
    } catch (error) {
      console.error("Error claiming winnings:", error);
      toast.error("Failed to claim winnings");
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      toast.success("Winnings claimed successfully!");
      // Refresh the entire winnings data after successful claim
      fetchUserMarkets();
    }
  }, [isSuccess, fetchUserMarkets]);

  if (!isConnected) {
    return (
      <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
        <CardContent className="p-6 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-orange-600" />
          <h3 className="font-semibold text-gray-900 mb-2">
            Claim Your Winnings
          </h3>
          <p className="text-sm text-gray-600">
            Connect your wallet to view and claim available winnings
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalWinnings = winningsData.reduce((sum, w) => sum + w.amount, 0n);
  const totalWinningsEth = Number(totalWinnings) / 1e18;

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <Trophy className="w-5 h-5" />
          Claim Your Winnings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            <span className="ml-2 text-sm text-gray-600">
              Checking available winnings...
            </span>
          </div>
        ) : winningsData.length === 0 ? (
          <div className="text-center py-8">
            <Coins className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No winnings available to claim</p>
            <p className="text-sm text-gray-500 mt-1">
              Check back after markets resolve
            </p>
          </div>
        ) : (
          <>
            {/* Total Winnings Summary */}
            <div className="bg-green-100 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Total Available Winnings
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    {totalWinningsEth.toFixed(4)} $Buster
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-200 text-green-800"
                >
                  {winningsData.length} Market
                  {winningsData.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>

            {/* Individual Market Claims */}
            <div className="space-y-3">
              {winningsData.map((winnings) => (
                <div
                  key={winnings.marketId}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      Market #{winnings.marketId}
                    </p>
                    <p className="text-sm text-gray-600">
                      {(Number(winnings.amount) / 1e18).toFixed(4)} $Buster
                    </p>
                  </div>
                  <Button
                    onClick={() => handleClaimWinnings(winnings.marketId)}
                    disabled={isPending || isConfirming}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Claiming...
                      </>
                    ) : (
                      "Claim"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
