"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { V2contractAddress, V2contractAbi } from "@/constants/contract";
import { Loader2, Trophy } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface ClaimWinningsButtonProps {
  marketId: number;
  className?: string;
  onClaimComplete?: () => void;
}

export function ClaimWinningsButton({
  marketId,
  className = "",
  onClaimComplete,
}: ClaimWinningsButtonProps) {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  // Get user's position in the market
  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getUserShares",
    args: [BigInt(marketId), address as `0x${string}`],
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Get market info to check if it's resolved and which option won
  const { data: marketInfo } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getMarketInfo",
    args: [BigInt(marketId)],
    query: {
      enabled: isConnected && !!address,
    },
  });

  // We'll use a local state to track claimed status
  const [hasAlreadyClaimed, setHasAlreadyClaimed] = useState(false);

  // Contract interaction hooks
  const {
    writeContract,
    data: txHash,
    isPending: isClaimPending,
  } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check if market is resolved and user has shares
  const isMarketResolved = marketInfo ? (marketInfo[5] as boolean) : false;
  const winningOptionId = marketInfo ? (marketInfo[8] as bigint) : 0n;

  // Check if user has winning shares
  const hasWinningShares = () => {
    if (!userShares || !isMarketResolved) return false;
    return userShares[Number(winningOptionId)] > 0n;
  };

  // Handle claiming winnings
  const handleClaimWinnings = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to claim winnings.",
        variant: "destructive",
      });
      return;
    }

    if (!isMarketResolved) {
      toast({
        title: "Market Not Resolved",
        description: "This market hasn't been resolved yet.",
        variant: "destructive",
      });
      return;
    }

    if (hasAlreadyClaimed) {
      toast({
        title: "Already Claimed",
        description: "You have already claimed winnings for this market.",
        variant: "destructive",
      });
      return;
    }

    if (!hasWinningShares()) {
      toast({
        title: "No Winning Shares",
        description: "You don't have any winning shares in this market.",
        variant: "destructive",
      });
      return;
    }

    try {
      await writeContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "claimWinnings",
        args: [BigInt(marketId)],
      });

      // Success toast will be shown by the useEffect below
    } catch (error: any) {
      console.error("Error claiming winnings:", error);

      // Check for the AlreadyClaimed error
      if (error?.message?.includes("AlreadyClaimed")) {
        setHasAlreadyClaimed(true);
        toast({
          title: "Already Claimed",
          description: "You have already claimed winnings for this market.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Claim Failed",
          description: error?.shortMessage || "Failed to claim winnings.",
          variant: "destructive",
        });
      }
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: "Winnings Claimed!",
        description: "Your winnings have been successfully claimed.",
      });

      // Update claimed status
      setHasAlreadyClaimed(true);

      // Refresh data
      refetchShares();
      if (onClaimComplete) onClaimComplete();
    }
  }, [isSuccess, toast, refetchShares, onClaimComplete]);

  // Don't show button if user hasn't connected wallet
  if (!isConnected) return null;

  // Don't show button if market is not resolved
  if (!isMarketResolved) return null;

  // Don't show button if user has already claimed
  if (hasAlreadyClaimed) {
    return (
      <div
        className={`text-xs text-green-600 font-medium text-center ${className}`}
      >
        Winnings claimed
      </div>
    );
  }

  // Don't show button if user doesn't have winning shares
  if (!hasWinningShares()) return null;

  return (
    <Button
      onClick={handleClaimWinnings}
      disabled={isClaimPending || isConfirming}
      size="sm"
      className={`w-full ${className}`}
      variant="success"
    >
      {isClaimPending || isConfirming ? (
        <>
          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
          Claiming...
        </>
      ) : (
        <>
          <Trophy className="h-3 w-3 mr-2" />
          Claim Winnings
        </>
      )}
    </Button>
  );
}
