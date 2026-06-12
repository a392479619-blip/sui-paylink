import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";

const network = (import.meta.env.VITE_SUI_NETWORK ?? "testnet") as "devnet" | "testnet";
const packageId =
  import.meta.env.VITE_PACKAGE_ID ??
  "0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340";
const suiType = "0x2::sui::SUI";
const paymentMist = 100_000_000;

type ChainAction = "fund" | "deliver" | "release";

export function ChainDemo() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [escrowId, setEscrowId] = useState("");
  const [digests, setDigests] = useState<Partial<Record<ChainAction, string>>>({});
  const [pending, setPending] = useState<ChainAction | null>(null);
  const [error, setError] = useState("");

  async function execute(action: ChainAction, transaction: Transaction) {
    setError("");
    setPending(action);
    try {
      const result = await signAndExecute({
        transaction,
        chain: `sui:${network}`,
      });
      const details = await client.waitForTransaction({
        digest: result.digest,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      if (details.effects?.status.status !== "success") {
        throw new Error(details.effects?.status.error ?? "Sui transaction failed");
      }

      if (action === "fund") {
        const createdEscrow = details.objectChanges?.find(
          (change) =>
            change.type === "created" &&
            change.objectType.includes("::escrow::Escrow"),
        );
        if (!createdEscrow || createdEscrow.type !== "created") {
          throw new Error("Fund transaction succeeded but no Escrow object was found");
        }
        setEscrowId(createdEscrow.objectId);
      }

      setDigests((current) => ({ ...current, [action]: result.digest }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  }

  async function fundEscrow() {
    if (!account) return;
    const transaction = new Transaction();
    const [payment] = transaction.splitCoins(transaction.gas, [paymentMist]);
    transaction.moveCall({
      target: contractTarget("create_funded_escrow"),
      typeArguments: [suiType],
      arguments: [
        transaction.pure.address(account.address),
        transaction.pure.string("SuiPayLink wallet-signed service delivery"),
        payment,
        transaction.pure.u64(100),
        transaction.pure.address(account.address),
      ],
    });
    await execute("fund", transaction);
  }

  async function markDelivered() {
    if (!escrowId) return;
    const transaction = new Transaction();
    transaction.moveCall({
      target: contractTarget("mark_delivered"),
      typeArguments: [suiType],
      arguments: [
        transaction.object(escrowId),
        transaction.pure.string("https://example.com/proofs/wallet-signed-delivery.pdf"),
      ],
    });
    await execute("deliver", transaction);
  }

  async function releaseEscrow() {
    if (!escrowId) return;
    const transaction = new Transaction();
    transaction.moveCall({
      target: contractTarget("release"),
      typeArguments: [suiType],
      arguments: [transaction.object(escrowId)],
    });
    await execute("release", transaction);
  }

  return (
    <section className="chain-panel">
      <div className="chain-heading">
        <div>
          <p className="eyebrow">Real Sui transaction mode</p>
          <h2>On-chain escrow verification</h2>
          <p className="muted">
            Wallet-signed verification using Test SUI. MockUSDC is verified by the CLI smoke path.
          </p>
        </div>
        <ConnectButton connectText="Connect Sui wallet" />
      </div>

      <dl className="chain-facts">
        <div>
          <dt>Network</dt>
          <dd>{network}</dd>
        </div>
        <div>
          <dt>Package</dt>
          <dd>{shortId(packageId)}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>{account ? shortId(account.address) : "not connected"}</dd>
        </div>
        <div>
          <dt>Escrow</dt>
          <dd>{escrowId ? shortId(escrowId) : "not created"}</dd>
        </div>
      </dl>

      {error && <div className="error">{error}</div>}

      <div className="chain-actions">
        <button className="primary" disabled={!account || pending !== null || !!escrowId} onClick={fundEscrow}>
          {pending === "fund" ? "Funding..." : "1. Create and fund escrow"}
        </button>
        <button disabled={!escrowId || pending !== null || !!digests.deliver} onClick={markDelivered}>
          {pending === "deliver" ? "Submitting..." : "2. Mark delivered"}
        </button>
        <button disabled={!digests.deliver || pending !== null || !!digests.release} onClick={releaseEscrow}>
          {pending === "release" ? "Releasing..." : "3. Release funds"}
        </button>
      </div>

      <div className="chain-digests">
        {(["fund", "deliver", "release"] as const).map((action) => (
          <div key={action}>
            <span>{action}</span>
            {digests[action] ? (
              <a href={explorerUrl(digests[action]!)} target="_blank" rel="noreferrer">
                {shortId(digests[action]!)}
              </a>
            ) : (
              <strong>pending</strong>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function contractTarget(functionName: string): `${string}::${string}::${string}` {
  return `${packageId}::escrow::${functionName}`;
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function explorerUrl(digest: string): string {
  return `https://suiexplorer.com/txblock/${digest}?network=${network}`;
}
