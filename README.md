# Δ Delta Wallet Market (Buster-MKT)

Delta Wallet Market is a fully on-chain, decentralized prediction trading platform that allows users to create, trade, and analyze markets with true transparency. Built with a modern Web3 stack, it combines prediction economics, real-time analytics, and social interoperability into one seamless experience.

---

## 🚀 Core Highlights

- **Permissionless Market Creation** – Launch and resolve prediction markets fully onchain
- **On-chain Betting Engine** – Powered by ERC-20 tokens with verifiable outcomes
- **Live Analytics & Leaderboards** – See performance, rankings & trading insights
- **Dynamic Share Cards** – Auto-generated performance visuals using Satori
- **Farcaster Mini-App Support** – Trade and share directly through frames
- **Secure Claim Mechanism** – One-time or cooldown-based faucet system
- **Admin Controls** – Market moderation, role control, payout handling
- **Open Source & Auditable** – Built for transparency, extensibility & trust

---

## 🏗 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | Next.js 15, React, TailwindCSS |
| Blockchain | Viem, Wagmi, Solidity |
| Wallet & State | Reown (WalletConnect), Zustand |
| Media Gen | Satori + Sharp |
| Data Layer | Subgraph, Supabase |
| Deployment | Vercel, On-chain Contracts |

---

## 📂 Repo Structure

src/ → App source (pages, API, UI)
docs/ → Architecture & protocol docs
contract/ → Smart contract core
subgraph/ → Blockchain indexing layer
public/ → Static assets
---

## ⚙️ Local Setup

### 1. Clone & Install
```sh
git clone https://github.com/yourusername/delta-wallet.git
cd delta-wallet
npm install

cp .env.example .env.local


NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_CONTRACT_MARKET=
NEXT_PUBLIC_CONTRACT_TOKEN=

