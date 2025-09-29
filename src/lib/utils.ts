import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combine classes with tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number to fixed decimals
export function toFixed(value: number, decimals: number) {
  return value.toFixed(decimals);
}

// Format date to readable string
export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Format price with proper decimals
export function formatPrice(price: bigint, decimals: number = 18): string {
  const formatted = Number(price) / Math.pow(10, decimals);
  if (formatted < 0.01) return formatted.toFixed(4);
  if (formatted < 1) return formatted.toFixed(3);
  return formatted.toFixed(2);
}

// Format Ethereum address to shortened form
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

// Debug logging utility - only logs in development
export const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

// Debug error logging - logs in all environments but with prefix
export const debugError = (...args: any[]) => {
  console.error("[DEBUG]", ...args);
};

// Verification utilities for contract interactions
export const verifyMarketCreation = (args: {
  question: string;
  description: string;
  options: { name: string; description: string }[];
  duration: number;
  initialLiquidity: number;
  marketType: number;
}) => {
  const errors: string[] = [];

  if (!args.question.trim()) errors.push("Question is required");
  if (args.question.length > 200) errors.push("Question too long");
  if (!args.description.trim()) errors.push("Description is required");
  if (args.description.length > 1000) errors.push("Description too long");
  if (args.options.length < 2) errors.push("At least 2 options required");
  if (args.options.length > 10) errors.push("Maximum 10 options");
  if (args.duration < 1) errors.push("Duration must be at least 1 day");
  if (args.initialLiquidity < 4000) errors.push("Minimum liquidity is 4000");

  return {
    isValid: errors.length === 0,
    errors,
  };
};
