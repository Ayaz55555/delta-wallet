"use client";

import React from "react"; // Import React
import { WagmiConfig, createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { metaMask } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { sdk } from "@farcaster/miniapp-sdk";
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(), // Use default RPC for Farcaster compatibility
  },
  connectors: [
    miniAppConnector(), // Farcaster connector first
    metaMask({
      dappMetadata: {
        name: "Policast",
        url: typeof window !== "undefined" ? window.location.origin : "",
      },
    }),
  ],
});

const queryClient = new QueryClient();

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiConfig>
  );
}
