"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  V2contractAddress,
  V2contractAbi,
  PolicastViews,
  PolicastViewsAbi,
} from "@/constants/contract";
import { Loader2, DollarSign, TrendingUp, Coins } from "lucide-react";
//
interface V3FinancialManagerProps {
  marketId?: number; // Optional for platform-wide management
  isCreator?: boolean;
  isLP?: boolean;
  isFeeCollector?: boolean;
  isPlatformMode?: boolean; // New prop for platform-wide management
}

export function V3FinancialManager({
  marketId,
  isCreator = false,
  isLP = false,
  isFeeCollector = false,
  isPlatformMode = false,
}: V3FinancialManagerProps) {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actualIsCreator, setActualIsCreator] = useState(isCreator);
  const [actualIsLP, setActualIsLP] = useState(isLP);

  // Contract interactions
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  // Fetch market basic info & extended meta to determine creator and status
  const { data: marketBasic } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getMarketBasicInfo",
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: { enabled: isConnected && marketId !== undefined },
  });

  const { data: marketExtended } = useReadContract({
    address: V2contractAddress,
    abi: V2contractAbi,
    functionName: "getMarketExtendedMeta",
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: { enabled: isConnected && marketId !== undefined },
  });

  // Fetch market fee status instead of financials
  const { data: marketFeeStatus, refetch: refetchFeeStatus } = useReadContract({
    address: PolicastViews,
    abi: PolicastViewsAbi,
    functionName: "getMarketFeeStatus",
    args: marketId !== undefined ? [BigInt(marketId)] : undefined,
    query: { enabled: isConnected && marketId !== undefined },
  });

  // Fetch user portfolio for LP info
  const { data: userPortfolio, refetch: refetchUserPortfolio } =
    useReadContract({
      address: V2contractAddress,
      abi: V2contractAbi,
      functionName: "userPortfolios",
      args: address ? [address] : undefined,
      query: { enabled: isConnected && Boolean(address) },
    });

  // Fetch platform fee breakdown instead of platform stats
  const { data: platformFeeBreakdown, refetch: refetchPlatformFeeBreakdown } =
    useReadContract({
      address: PolicastViews,
      abi: PolicastViewsAbi,
      functionName: "getPlatformFeeBreakdown",
      query: { enabled: isConnected && isFeeCollector },
    });

  // Determine actual roles based on contract data
  useEffect(() => {
    if (marketExtended && address) {
      // getMarketExtendedMeta returns: [winningOptionId, disputed, validated, creator, earlyResolutionAllowed]
      const extended = marketExtended as readonly [
        bigint,
        boolean,
        boolean,
        `0x${string}`,
        boolean
      ];
      const creator = extended[3];
      setActualIsCreator(
        creator && address
          ? creator.toLowerCase() === address.toLowerCase()
          : false
      );
    }
  }, [marketExtended, address]);

  useEffect(() => {
    if (userPortfolio && address) {
      // userPortfolios returns: [totalInvested, totalWinnings, unrealizedPnL, realizedPnL, tradeCount]
      const [totalInvested] = userPortfolio as readonly [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint
      ];
      setActualIsLP(totalInvested > 0n);
    }
  }, [userPortfolio, address]);

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && hash) {
      handleRefresh();
      toast({
        title: "Transaction Successful",
        description: "Financial operation completed successfully.",
      });
    }
  }, [isConfirmed, hash]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchFeeStatus(),
        refetchUserPortfolio(),
        isFeeCollector ? refetchPlatformFeeBreakdown() : Promise.resolve(),
      ]);
      toast({
        title: "Data Refreshed",
        description: "Financial data has been updated.",
      });
    } catch (error) {
      console.error("Failed to refresh data:", error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh financial data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Withdraw platform fees (for fee collector)
  const handleWithdrawPlatformFees = async () => {
    try {
      toast({
        title: "Transaction Submitted",
        description: "Withdrawing platform fees...",
      });

      await writeContract({
        address: V2contractAddress,
        abi: V2contractAbi,
        functionName: "withdrawPlatformFees",
        args: [],
      });
    } catch (error: any) {
      console.error("Error withdrawing platform fees:", error);
      toast({
        title: "Transaction Failed",
        description: error?.shortMessage || "Failed to withdraw platform fees.",
        variant: "destructive",
      });
    }
  };

  // Format amounts
  const formatAmount = (amount: bigint | undefined) => {
    if (!amount) return "0.00";
    const value = Number(amount) / 10 ** 18;
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Management</CardTitle>
          <CardDescription>
            Connect wallet to view financial options
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // If no marketId provided, show platform-wide management only
  if (marketId === undefined) {
    if (!isFeeCollector) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Platform Financial Management</CardTitle>
            <CardDescription>
              You need to be a fee collector to access platform financial
              features
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    // Platform-wide fee collection interface
    const [
      cumulativeFees,
      lockedFees,
      unlockedFees,
      withdrawnFees,
      feeCollectorAddr,
    ] = platformFeeBreakdown || [];

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Platform Fee Collection
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </CardTitle>
            <CardDescription>
              Global platform statistics and fee withdrawal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Fees Collected</p>
                <p className="text-lg font-semibold">
                  {formatAmount(cumulativeFees)} buster
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Fees</p>
                <p className="text-lg font-semibold">
                  {formatAmount(unlockedFees)} buster
                </p>
              </div>
            </div>

            {unlockedFees && unlockedFees > 0n && (
              <Button
                onClick={handleWithdrawPlatformFees}
                disabled={isPending || isConfirming}
                className="w-full flex items-center gap-2"
              >
                {isPending || isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                Withdraw Platform Fees
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [collected, unlocked, lockedPortion] = marketFeeStatus || [];
  const [
    totalInvested = 0n,
    totalWinnings = 0n,
    unrealizedPnL = 0n,
    realizedPnL = 0n,
    tradeCount = 0n,
  ] = userPortfolio || [];
  const [
    cumulativeFees,
    lockedFees,
    unlockedFees,
    withdrawnFees,
    feeCollectorAddr,
  ] = platformFeeBreakdown || [];

  return (
    <div className="space-y-4">
      {/* Market Financial Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Market Fee Status
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Fees Collected</p>
              <p className="text-lg font-semibold">
                {formatAmount(collected)} buster
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Locked Portion</p>
              <p className="text-lg font-semibold">
                {formatAmount(lockedPortion)} buster
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={unlocked ? "default" : "secondary"}>
              {unlocked ? "Unlocked" : "Locked"}
            </Badge>
            <span className="text-sm text-gray-500">
              Fees {unlocked ? "can" : "cannot"} be withdrawn
            </span>
          </div>
        </CardContent>
      </Card>

      {/* User Portfolio */}
      {userPortfolio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Your Portfolio
            </CardTitle>
            <CardDescription>
              Your trading activity and performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Invested</p>
                <p className="text-lg font-semibold">
                  {formatAmount(totalInvested)} buster
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Winnings</p>
                <p className="text-lg font-semibold">
                  {formatAmount(totalWinnings)} buster
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Realized P&L</p>
                <p
                  className={`text-lg font-semibold ${
                    realizedPnL >= 0n ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {realizedPnL < 0n ? "-" : ""}
                  {formatAmount(
                    realizedPnL < 0n ? -realizedPnL : realizedPnL
                  )}{" "}
                  buster
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Trade Count</p>
                <p className="text-lg font-semibold">
                  {tradeCount?.toString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Fee Collection */}
      {isFeeCollector && platformFeeBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Platform Fee Collection
            </CardTitle>
            <CardDescription>
              Global platform statistics and fee withdrawal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Fees Collected</p>
                <p className="text-lg font-semibold">
                  {formatAmount(cumulativeFees)} buster
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Fees</p>
                <p className="text-lg font-semibold">
                  {formatAmount(unlockedFees)} buster
                </p>
              </div>
            </div>

            {unlockedFees && unlockedFees > 0n && (
              <Button
                onClick={handleWithdrawPlatformFees}
                disabled={isPending || isConfirming}
                className="w-full flex items-center gap-2"
              >
                {isPending || isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                Withdraw Platform Fees
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
