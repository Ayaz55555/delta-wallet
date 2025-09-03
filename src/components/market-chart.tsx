"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMarketAnalytics } from "@/hooks/useMarketAnalytics";

interface MarketChartProps {
  marketId: string;
  market?: {
    // V1 Binary options
    optionA?: string;
    optionB?: string;
    // V2 Multi-options
    options?: string[];
    version?: "v1" | "v2";
  };
}

export function MarketChart({ marketId, market }: MarketChartProps) {
  const {
    data: analyticsData,
    loading,
    error,
  } = useMarketAnalytics({
    marketId,
    timeRange: "7d",
    enabled: true,
  });

  if (loading) {
    return (
      <div className="h-48 md:h-64 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-48 md:h-64 flex items-center justify-center">
        <div className="text-xs md:text-sm text-destructive">
          Error loading chart data
        </div>
      </div>
    );
  }

  if (
    !analyticsData ||
    !analyticsData.priceHistory ||
    analyticsData.priceHistory.length === 0
  ) {
    return (
      <div className="h-48 md:h-64 flex items-center justify-center">
        <div className="text-xs md:text-sm text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  // Convert decimal values to percentages for display
  // For V2 markets, analytics might return multi-option data
  const chartData = analyticsData.priceHistory.map((item) => {
    if (market?.version === "v2" && market?.options) {
      // V2 multi-option: convert each option percentage
      const converted: any = { ...item };
      market.options.forEach((_, index) => {
        const optionKey = `option${index}`;
        if ((item as any)[optionKey] !== undefined) {
          converted[optionKey] = Math.round((item as any)[optionKey] * 100);
        }
      });
      return converted;
    } else {
      // V1 binary: convert optionA and optionB
      return {
        ...item,
        optionA:
          item.optionA !== undefined ? Math.round(item.optionA * 100) : 50,
        optionB:
          item.optionB !== undefined ? Math.round(item.optionB * 100) : 50,
      };
    }
  });

  return (
    <div className="w-full">
      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">
        Market Sentiment Over Time
      </h3>
      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 10,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted-foreground/20"
            />
            <XAxis
              dataKey="timestamp"
              className="text-xs fill-muted-foreground"
              tickFormatter={(value) => {
                const date = new Date(value);
                return window.innerWidth < 768
                  ? date.toLocaleDateString().slice(0, 5) // Shorter format on mobile
                  : date.toLocaleDateString();
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              className="text-xs fill-muted-foreground"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                color: "hsl(var(--foreground))",
                fontSize: "12px",
              }}
              labelFormatter={(value) => {
                const date = new Date(value);
                return window.innerWidth < 768
                  ? date.toLocaleDateString()
                  : date.toLocaleString();
              }}
              formatter={(value, name) => [`${value}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} iconType="line" />
            {market?.version === "v2" && market?.options ? (
              // V2 Multi-option lines
              market.options.map((option, index) => {
                const colors = [
                  "hsl(var(--primary))",
                  "hsl(var(--secondary))",
                  "#ef4444", // red
                  "#f97316", // orange
                  "#eab308", // yellow
                  "#22c55e", // green
                  "#06b6d4", // cyan
                  "#3b82f6", // blue
                  "#8b5cf6", // violet
                  "#f59e0b", // amber
                ];
                return (
                  <Line
                    key={index}
                    type="monotone"
                    dataKey={`option${index}`}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    name={option}
                    dot={{
                      fill: colors[index % colors.length],
                      strokeWidth: 2,
                      r: 4,
                    }}
                  />
                );
              })
            ) : (
              // V1 Binary options
              <>
                <Line
                  type="monotone"
                  dataKey="optionA"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name={market?.optionA || "Option A"}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="optionB"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  name={market?.optionB || "Option B"}
                  dot={{ fill: "hsl(var(--secondary))", strokeWidth: 2, r: 4 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default MarketChart;
