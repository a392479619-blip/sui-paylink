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
const localTestWalletEnabled =
  typeof window !== "undefined" && ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
const preferredWallets = localTestWalletEnabled
  ? ["Unsafe Burner Wallet", "Sui Wallet", "Slush", "OKX Wallet"]
  : ["Slush", "OKX Wallet", "Sui Wallet"];
const requiredWalletFeatures = ["sui:signTransaction", "sui:signTransactionBlock"] as const;
const supportedWalletNameFragments = localTestWalletEnabled
  ? ["unsafe burner", "okx", "sui wallet", "slush"]
  : ["okx", "sui wallet", "slush"];
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
          enableUnsafeBurner={localTestWalletEnabled}
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
