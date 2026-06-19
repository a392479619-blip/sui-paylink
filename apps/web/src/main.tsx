import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient();
const defaultNetwork = (import.meta.env.VITE_SUI_NETWORK ?? "testnet") as "devnet" | "testnet";
const preferredWallets = ["Slush", "Sui Wallet"];
const requiredWalletFeatures = ["sui:signTransaction", "sui:signTransactionBlock"] as const;
const supportedWalletNameFragments = ["slush", "sui wallet"];
const networks = {
  devnet: {
    network: "devnet" as const,
    url: getJsonRpcFullnodeUrl("devnet"),
  },
  testnet: {
    network: "testnet" as const,
    url: getJsonRpcFullnodeUrl("testnet"),
  },
};

type WalletCandidate = {
  name: string;
  features: Record<string, unknown>;
};

function walletSupportsSuiPayLink(wallet: WalletCandidate) {
  const walletName = wallet.name.toLowerCase();
  if (!supportedWalletNameFragments.some((fragment) => walletName.includes(fragment))) {
    return false;
  }

  return requiredWalletFeatures.some((feature) => Boolean(wallet.features[feature]));
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork={defaultNetwork}>
        <WalletProvider
          autoConnect
          preferredWallets={preferredWallets}
          walletFilter={walletSupportsSuiPayLink}
          slushWallet={{ name: "Slush" }}
        >
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
