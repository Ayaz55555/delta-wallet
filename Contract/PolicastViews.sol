// SPDX-License-Identifier: MIT
pragma solidity ^0.8.;

import "./Policast.sol";
import "./PolicastLogic.sol";

contract PolicastViews {
    PolicastMarketV3 public immutable policast;
    uint256 private constant PAYOUT_PER_SHARE = 100 * 1e18; // Match the main contract constant

    constructor(address _policast) {
        policast = PolicastMarketV3(_policast);
    }

    // CEI-compliant view functions moved from main contract

    function getMarketInfo(uint256 _marketId)
        external
        view
        returns (
            string memory question,
            string memory description,
            uint256 endTime,
            PolicastMarketV3.MarketCategory category,
            PolicastMarketV3.MarketType marketType,
            bool resolved,
            bool invalidated,
            address creator,
            uint256 lmsrB
        )
    {
        (question, description, endTime, category,, resolved, marketType, invalidated,) =
            policast.getMarketBasicInfo(_marketId);
        (,,, creator,) = policast.getMarketExtendedMeta(_marketId);
        lmsrB = policast.getMarketLMSRB(_marketId);
    }

    function getUserShares(uint256 _marketId, address _user) external view returns (uint256[] memory) {
        // Checks: Validate market exists
        require(_marketId < policast.marketCount(), "Market does not exist");

        // Effects: None (pure view)

        // Interactions: None
        (,,,, uint256 optionCount,,,,) = policast.getMarketBasicInfo(_marketId);
        uint256[] memory shares = new uint256[](optionCount);
        for (uint256 i = 0; i < optionCount; i++) {
            shares[i] = policast.getMarketOptionUserShares(_marketId, i, _user);
        }
        return shares;
    }

    function getMarketLiquidity(uint256 _marketId) external view returns (uint256) {
        require(_marketId < policast.marketCount(), "Market does not exist");
        // Return actual LMSR liquidity parameter from main contract
        return policast.getMarketLMSRB(_marketId);
    }

    function calculateCurrentPrice(uint256 _marketId, uint256 _optionId) external view returns (uint256) {
        try policast.getMarketBasicInfo(_marketId) returns (
            string memory,
            string memory,
            uint256, /* endTime */
            PolicastMarketV3.MarketCategory,
            uint256 optionCount,
            bool,
            PolicastMarketV3.MarketType,
            bool,
            uint256
        ) {
            if (_optionId >= optionCount) return 0;

            // Get the current price from market option
            try policast.getMarketOption(_marketId, _optionId) returns (
                string memory, string memory, uint256 totalShares, uint256, uint256 currentPrice, bool
            ) {
                // If no trades yet, return equal probability
                if (totalShares == 0) {
                    // Check if any option has shares
                    bool hasAnyShares = false;
                    for (uint256 i = 0; i < optionCount && !hasAnyShares; i++) {
                        (,, uint256 shares,,,) = policast.getMarketOption(_marketId, i);
                        if (shares > 0) {
                            hasAnyShares = true;
                        }
                    }

                    if (!hasAnyShares) {
                        return 1e18 / optionCount; // Equal probability for all options (sum = 1e18)
                    }
                }

                return currentPrice;
            } catch {
                return 1e18 / optionCount; // Fallback to equal probability (sum = 1e18)
            }
        } catch {
            return 0;
        }
    }

    function getMarketOption(uint256 _marketId, uint256 _optionId)
        external
        view
        returns (string memory name, uint256 totalShares, uint256 currentPrice, bool isActive)
    {
        string memory description;
        uint256 totalVolume;
        (name, description, totalShares, totalVolume, currentPrice, isActive) =
            policast.getMarketOption(_marketId, _optionId);
    }

    function getMarketFinancials(uint256 _marketId)
        external
        view
        returns (
            address creator,
            bool adminLiquidityClaimed,
            uint256 adminInitialLiquidity,
            uint256 userLiquidity,
            uint256 totalVolume,
            uint256 platformFeesCollected
        )
    {
        uint256 createdAt;
        (
            createdAt,
            creator,
            adminLiquidityClaimed,
            adminInitialLiquidity,
            userLiquidity,
            totalVolume,
            platformFeesCollected
        ) = policast.getMarketFinancialsData(_marketId);
    }

    function getMarketTiming(uint256 _marketId)
        external
        view
        returns (uint256 createdAt, uint256 endTime, bool earlyResolutionAllowed)
    {
        (,, endTime,,,,,,) = policast.getMarketBasicInfo(_marketId);
        (,,,, earlyResolutionAllowed) = policast.getMarketExtendedMeta(_marketId);
        (createdAt,,,,,,) = policast.getMarketFinancialsData(_marketId);
    }

    function getMarketsByCategory(PolicastMarketV3.MarketCategory _category, uint256 _limit)
        external
        view
        returns (uint256[] memory)
    {
        uint256 marketCount = policast.marketCount();
        uint256[] memory tempMarkets = new uint256[](marketCount);
        uint256 count = 0;

        for (uint256 i = 0; i < marketCount && (_limit == 0 || count < _limit); i++) {
            (,,, PolicastMarketV3.MarketCategory category,,,,,) = policast.getMarketBasicInfo(i);
            if (category == _category) {
                tempMarkets[count] = i;
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempMarkets[i];
        }
        return result;
    }

    function getUserMarkets(address _user) external view returns (uint256[] memory) {
        uint256 marketCount = policast.marketCount();
        uint256[] memory tempMarkets = new uint256[](marketCount);
        uint256 count = 0;

        for (uint256 i = 0; i < marketCount; i++) {
            // Check if user has any shares in this market
            (,,,, uint256 optionCount,,,,) = policast.getMarketBasicInfo(i);
            bool hasParticipated = false;
            for (uint256 j = 0; j < optionCount; j++) {
                if (policast.getMarketOptionUserShares(i, j, _user) > 0) {
                    hasParticipated = true;
                    break;
                }
            }
            if (hasParticipated) {
                tempMarkets[count] = i;
                count++;
            }
        }

        // Resize array to actual count
        uint256[] memory userMarkets = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            userMarkets[i] = tempMarkets[i];
        }
        return userMarkets;
    }

    function getUnresolvedMarkets() external view returns (uint256[] memory) {
        uint256 marketCount = policast.marketCount();
        uint256[] memory tempMarkets = new uint256[](marketCount);
        uint256 count = 0;

        for (uint256 i = 0; i < marketCount; i++) {
            bool resolved;
            bool invalidated;
            uint256 endTime;
            (,, endTime,,, resolved,, invalidated,) = policast.getMarketBasicInfo(i);
            // Inline isMarketTradable logic since function was removed for size optimization
            bool tradable = !resolved && !invalidated && block.timestamp < endTime;
            if (tradable) {
                tempMarkets[count] = i;
                count++;
            }
        }

        uint256[] memory unresolvedMarkets = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            unresolvedMarkets[i] = tempMarkets[i];
        }

        return unresolvedMarkets;
    }

    function getEventBasedMarkets() external view returns (uint256[] memory) {
        uint256 marketCount = policast.marketCount();
        uint256[] memory tempMarkets = new uint256[](marketCount);
        uint256 count = 0;

        for (uint256 i = 0; i < marketCount; i++) {
            (,,,, bool early) = policast.getMarketExtendedMeta(i);
            if (early) {
                tempMarkets[count] = i;
                count++;
            }
        }

        uint256[] memory eventMarkets = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            eventMarkets[i] = tempMarkets[i];
        }

        return eventMarkets;
    }

    function getMarketCount() external view returns (uint256) {
        return policast.marketCount();
    }

    function getBettingToken() external view returns (address) {
        return address(policast.bettingToken());
    }

    function getUserPortfolio(address _user) external view returns (PolicastMarketV3.UserPortfolio memory) {
        (uint256 totalInvested, uint256 totalWinnings, int256 unrealizedPnL, int256 realizedPnL, uint256 tradeCount) =
            policast.userPortfolios(_user);
        return PolicastMarketV3.UserPortfolio({
            totalInvested: totalInvested,
            totalWinnings: totalWinnings,
            unrealizedPnL: unrealizedPnL,
            realizedPnL: realizedPnL,
            tradeCount: tradeCount
        });
    }

    function isMarketTradable(uint256 _marketId) external view returns (bool) {
        try policast.getMarketBasicInfo(_marketId) returns (
            string memory,
            string memory,
            uint256 endTime,
            PolicastMarketV3.MarketCategory,
            uint256,
            bool resolved,
            PolicastMarketV3.MarketType,
            bool invalidated,
            uint256
        ) {
            return !resolved && !invalidated && block.timestamp < endTime;
        } catch {
            return false;
        }
    }

    function getMarketCreator(uint256 _marketId) external view returns (address) {
        (,,, address creator,) = policast.getMarketExtendedMeta(_marketId);
        return creator;
    }

    function getMarketEndTime(uint256 _marketId) external view returns (uint256) {
        (,, uint256 endTime,,,,,,) = policast.getMarketBasicInfo(_marketId);
        return endTime;
    }

    function getMarketResolved(uint256 _marketId) external view returns (bool) {
        (,,,,, bool resolved,,,) = policast.getMarketBasicInfo(_marketId);
        return resolved;
    }

    function getMarketInvalidated(uint256 _marketId) external view returns (bool) {
        (,,,,,,, bool invalidated,) = policast.getMarketBasicInfo(_marketId);
        return invalidated;
    }

    function getMarketResolvedOutcome(uint256 _marketId) external view returns (uint256) {
        (uint256 winningOptionId,,,,) = policast.getMarketExtendedMeta(_marketId);
        return winningOptionId;
    }

    function getMarketTotalVolume(uint256 _marketId) external view returns (uint256) {
        (,,,,,,,, uint256 tv) = policast.getMarketBasicInfo(_marketId);
        return tv;
    }

    function getMarketOptionCount(uint256 _marketId) external view returns (uint256) {
        (,,,, uint256 optionCount,,,,) = policast.getMarketBasicInfo(_marketId);
        return optionCount;
    }

    function getMarketCategory(uint256 _marketId) external view returns (PolicastMarketV3.MarketCategory) {
        (,,, PolicastMarketV3.MarketCategory category,,,,,) = policast.getMarketBasicInfo(_marketId);
        return category;
    }

    function getMarketType(uint256 _marketId) external view returns (PolicastMarketV3.MarketType) {
        (,,,,,, PolicastMarketV3.MarketType mt,,) = policast.getMarketBasicInfo(_marketId);
        return mt;
    }

    function getMarketEarlyResolutionAllowed(uint256 _marketId) external view returns (bool) {
        (,,,, bool early) = policast.getMarketExtendedMeta(_marketId);
        return early;
    }

    // ===================== NEWLY ADDED FUNCTIONS =====================

    function getFreeMarketInfo(uint256 _marketId)
        external
        view
        returns (
            uint256 maxFreeParticipants,
            uint256 tokensPerParticipant,
            uint256 currentFreeParticipants,
            uint256 totalPrizePool,
            uint256 remainingPrizePool,
            bool isActive
        )
    {
        return policast.getMarketFreeConfig(_marketId);
    }

    function hasUserClaimedFreeTokens(uint256 _marketId, address _user) external view returns (bool) {
        (, bool claimedFree) = policast.getUserClaimStatus(_marketId, _user);
        return claimedFree;
    }

    function hasUserClaimedWinnings(uint256 _marketId, address _user) external view returns (bool) {
        (bool claimedWinnings,) = policast.getUserClaimStatus(_marketId, _user);
        return claimedWinnings;
    }

    function getMarketOdds(uint256 _marketId) external view returns (uint256[] memory) {
        uint256 optionCount = this.getMarketOptionCount(_marketId);
        uint256[] memory odds = new uint256[](optionCount);
        for (uint256 i = 0; i < optionCount; i++) {
            odds[i] = this.calculateCurrentPrice(_marketId, i);
        }
        return odds;
    }

    enum MarketStatus {
        ACTIVE,
        RESOLVED,
        INVALIDATED,
        DISPUTED
    }

    function getMarketStatus(uint256 _marketId) external view returns (MarketStatus) {
        (,,,,, bool resolved,, bool invalidated,) = policast.getMarketBasicInfo(_marketId);
        bool disputed = policast.getMarketDisputeStatus(_marketId);

        if (invalidated) {
            return MarketStatus.INVALIDATED;
        }
        if (disputed) {
            return MarketStatus.DISPUTED;
        }
        if (resolved) {
            return MarketStatus.RESOLVED;
        }
        return MarketStatus.ACTIVE;
    }

    // Additional view functions moved from main contract to reduce size

    function getPlatformStats()
        external
        view
        returns (uint256 totalFeesCollected, address currentFeeCollector, uint256 totalMarkets, uint256 totalTrades)
    {
        // Return actual platform stats using main contract data
        return (
            policast.totalPlatformFeesCollected(),
            policast.feeCollector(),
            policast.marketCount(),
            policast.globalTradeCount()
        );
    }

    function getPlatformFeeBreakdown()
        external
        view
        returns (
            uint256 cumulativeFees,
            uint256 lockedFees,
            uint256 unlockedFees,
            uint256 withdrawnFees,
            address collector
        )
    {
        // Reconstruct fee breakdown from exposed public state vars (function removed from core)
        cumulativeFees = policast.totalPlatformFeesCollected();
        lockedFees = policast.totalLockedPlatformFees();
        unlockedFees = policast.totalUnlockedPlatformFees();
        withdrawnFees = policast.totalWithdrawnPlatformFees();
        collector = policast.feeCollector();
        return (cumulativeFees, lockedFees, unlockedFees, withdrawnFees, collector);
    }

    function getMarketFeeStatus(uint256 _marketId) external view returns (bool feesUnlocked) {
        // Fees are unlocked when a market is resolved.
        (,,,,, bool resolved,,,) = policast.getMarketBasicInfo(_marketId);
        return resolved;
    }

    function getWithdrawableAdminLiquidity(uint256 _marketId) external view returns (uint256) {
        (,,,,, bool resolved,, bool invalidated,) = policast.getMarketBasicInfo(_marketId);
        (, address creator, bool adminLiquidityClaimed, uint256 adminInitialLiquidity,,,) =
            policast.getMarketFinancialsData(_marketId);

        if (msg.sender != creator) {
            return 0;
        }

        if (!resolved && !invalidated) {
            return 0;
        }

        if (adminLiquidityClaimed) {
            return 0;
        }

        return adminInitialLiquidity;
    }

    // The following functions are degraded because the data is not available through simple getters
    // from the main contract. They are intended to be served by an off-chain indexer.

    function getPriceHistory(uint256, /*_marketId*/ uint256 /*_optionId*/ )
        external
        pure
        returns (PolicastMarketV3.PricePoint[] memory)
    {
        // This data is expected to be served by an off-chain indexer listening to events.
        // The public getter for array data is not suitable for returning the whole array.
        return new PolicastMarketV3.PricePoint[](0);
    }

    function getMarketsByCategory(PolicastMarketV3.MarketCategory _category) external view returns (uint256[] memory) {
        return this.getMarketsByCategory(_category, 0);
    }

    function getUserWinnings(address _user, uint256 _marketId) external view returns (uint256) {
        // This requires calculation based on winning shares and payout, which is done in claimWinnings.
        // A simple view is not provided to save contract size.
        (uint256 winningOptionId,,,,) = policast.getMarketExtendedMeta(_marketId);
        (,,,,, bool resolved,,,) = policast.getMarketBasicInfo(_marketId);
        if (!resolved) {
            return 0;
        }
        uint256 userWinningShares = policast.getMarketOptionUserShares(_marketId, winningOptionId, _user);
        return (userWinningShares * policast.PAYOUT_PER_SHARE()) / 1e18;
    }

    // Additional getters moved from main contract to reduce size
    function getTotalFeesCollected() external view returns (uint256) {
        return policast.totalPlatformFeesCollected();
    }

    function getFeeCollector() external view returns (address) {
        return policast.feeCollector();
    }

    function getGlobalTradeCount() external view returns (uint256) {
        return policast.globalTradeCount();
    }

    function calculateCurrentPriceInTokens(uint256 _marketId, uint256 _optionId) external view returns (uint256) {
        // Calculate price directly to avoid circular dependency
        (,,,, uint256 currentPrice, bool isActive) = policast.getMarketOption(_marketId, _optionId);
        require(isActive, "Option inactive");
        return (currentPrice * policast.PAYOUT_PER_SHARE()) / 1e18;
    }

    // Calculate user's unrealized PnL across all positions
    function calculateUnrealizedPnL(address _user) external view returns (int256) {
        int256 totalUnrealized = 0;

        // Iterate through all markets (IDs are 0..marketCount-1). Previous implementation started at 1 and used <= which skipped market 0 and could read past end.
        uint256 mCount = policast.marketCount();
        for (uint256 marketId = 0; marketId < mCount; marketId++) {
            // Get market basic info to check if invalidated and resolved status
            (,,,, uint256 optionCount, bool resolved,, bool invalidated, uint256 totalVolume) =
                policast.getMarketBasicInfo(marketId);
            if (invalidated || totalVolume == 0) continue;

            // Get market info for winning option if resolved
            uint256 winningOptionId = 0;
            if (resolved) {
                (winningOptionId,,,,) = policast.getMarketExtendedMeta(marketId);
            }

            for (uint256 optionId = 0; optionId < optionCount; optionId++) {
                uint256 userShares = policast.getMarketOptionUserShares(marketId, optionId, _user);
                if (userShares == 0) continue;

                uint256 costBasis = policast.userCostBasis(_user, marketId, optionId);
                uint256 currentValue;

                if (resolved) {
                    // For resolved markets, use payout value
                    if (winningOptionId == optionId) {
                        currentValue = userShares * policast.PAYOUT_PER_SHARE() / 1e18;
                    } else {
                        currentValue = 0; // Losing positions worth nothing
                    }
                } else {
                    // For unresolved markets, mark-to-market using token price per share = probability * PAYOUT_PER_SHARE
                    (,,,, uint256 currentPrice,) = policast.getMarketOption(marketId, optionId);
                    // userShares (1e18) * currentPrice (1e18) * PAYOUT_PER_SHARE (1e18) / 1e36 => tokens (1e18)
                    currentValue = (userShares * currentPrice / 1e18) * policast.PAYOUT_PER_SHARE() / 1e18;
                }

                totalUnrealized += int256(currentValue) - int256(costBasis);
            }
        }

        return totalUnrealized;
    }

    // Quote buy cost using LMSR ΔC (includes fee)
    function quoteBuy(uint256 _marketId, uint256 _optionId, uint256 _quantity)
        external
        view
        returns (uint256 rawCost, uint256 fee, uint256 totalCost, uint256 avgPricePerShare)
    {
        require(_marketId < policast.marketCount(), "Market does not exist");
        require(_quantity > 0, "AmountMustBePositive");

        // Gather market data
        (,,,, uint256 optionCount,,,,) = policast.getMarketBasicInfo(_marketId);
        uint256 b = policast.getMarketLMSRB(_marketId);

        // Before shares
        uint256[] memory sharesBefore = new uint256[](optionCount);
        for (uint256 i = 0; i < optionCount; i++) {
            (,, uint256 ts,,,) = policast.getMarketOption(_marketId, i);
            sharesBefore[i] = ts;
        }

        // After shares
        uint256[] memory sharesAfter = new uint256[](optionCount);
        for (uint256 i = 0; i < optionCount; i++) {
            sharesAfter[i] = sharesBefore[i];
        }
        sharesAfter[_optionId] += _quantity;

        // Build MarketData and compute ΔC
        PolicastLogic.MarketData memory m = PolicastLogic.MarketData({
            optionCount: optionCount,
            lmsrB: b,
            maxOptionShares: 0,
            userLiquidity: 0,
            adminInitialLiquidity: 0
        });

        uint256 costBefore = PolicastLogic.calculateLMSRCostWithShares(m, sharesBefore);
        uint256 costAfter = PolicastLogic.calculateLMSRCostWithShares(m, sharesAfter);
        rawCost = costAfter - costBefore;

        uint256 feeRate = policast.platformFeeRate(); // bps
        fee = (rawCost * feeRate) / 10000;
        totalCost = rawCost + fee;

        // Average execution price per share (includes fee)
        avgPricePerShare = (totalCost * 1e18) / _quantity;
    }

    // Quote sell proceeds using LMSR ΔC (includes fee)
    function quoteSell(uint256 _marketId, uint256 _optionId, uint256 _quantity)
        external
        view
        returns (uint256 rawRefund, uint256 fee, uint256 netRefund, uint256 avgPricePerShare)
    {
        require(_marketId < policast.marketCount(), "Market does not exist");
        require(_quantity > 0, "AmountMustBePositive");

        (,,,, uint256 optionCount,,,,) = policast.getMarketBasicInfo(_marketId);
        uint256 b = policast.getMarketLMSRB(_marketId);

        uint256[] memory sharesBefore = new uint256[](optionCount);
        for (uint256 i = 0; i < optionCount; i++) {
            (,, uint256 ts,,,) = policast.getMarketOption(_marketId, i);
            sharesBefore[i] = ts;
        }
        require(sharesBefore[_optionId] >= _quantity, "InsufficientShares");

        uint256[] memory sharesAfter = new uint256[](optionCount);
        for (uint256 i = 0; i < optionCount; i++) {
            sharesAfter[i] = sharesBefore[i];
        }
        sharesAfter[_optionId] -= _quantity;

        PolicastLogic.MarketData memory m = PolicastLogic.MarketData({
            optionCount: optionCount,
            lmsrB: b,
            maxOptionShares: 0,
            userLiquidity: 0,
            adminInitialLiquidity: 0
        });

        uint256 costBefore = PolicastLogic.calculateLMSRCostWithShares(m, sharesBefore);
        uint256 costAfter = PolicastLogic.calculateLMSRCostWithShares(m, sharesAfter);
        rawRefund = costBefore - costAfter;

        uint256 feeRate = policast.platformFeeRate();
        fee = (rawRefund * feeRate) / 10000;
        netRefund = rawRefund - fee;

        // Average execution price per share (includes fee)
        avgPricePerShare = (netRefund * 1e18) / _quantity;
    }

    // Replace linear approximation with LMSR ΔC for sells
    function calculateSellPrice(uint256 _marketId, uint256 _optionId, uint256 _quantity)
        external
        view
        returns (uint256)
    {
        (,, uint256 netRefund,) = this.quoteSell(_marketId, _optionId, _quantity);
        return netRefund;
    }
}
