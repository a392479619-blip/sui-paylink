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

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork={defaultNetwork}>
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
