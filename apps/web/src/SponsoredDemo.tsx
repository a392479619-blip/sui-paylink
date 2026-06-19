import { ConnectButton, useCurrentAccount, useCurrentWallet, useSignTransaction } from "@mysten/dapp-kit";
import { useState } from "react";
import type { AppConfig, SponsoredTransactionAction, SponsoredTransactionRecord } from "@suipaylink/shared";
import { buildSponsoredTransaction, submitSponsoredTransaction } from "./api";

const walletSignatureTimeoutMs = 60_000;

type SponsoredForm = {
  action: SponsoredTransactionAction;
  paymentCoinId: string;
  escrowObjectId: string;
  sellerAddress: string;
  expectedAmountUnits: string;
  feeBps: string;
  gasBudgetMist: string;
  deliveryProofUri: string;
};

const initialForm: SponsoredForm = {
  action: "fund-mock-usdc",
  paymentCoinId: "",
  escrowObjectId: "",
  sellerAddress: "",
  expectedAmountUnits: "",
  feeBps: "100",
  gasBudgetMist: "50000000",
  deliveryProofUri: "https://example.com/proofs/sponsored-delivery.pdf",
};

export function SponsoredDemo({ config }: { config: AppConfig | null }) {
  const account = useCurrentAccount();
  const { currentWallet } = useCurrentWallet();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [form, setForm] = useState<SponsoredForm>(initialForm);
  const [record, setRecord] = useState<SponsoredTransactionRecord | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleBuildSignSubmit() {
    if (!account) return;
    const unsupportedWallet = unsupportedSponsoredWalletReason(currentWallet?.name);
    if (unsupportedWallet) {
      setError(unsupportedWallet);
      return;
    }
    setPending(true);
    setError("");
    setRecord(null);
    try {
      const built = await buildSponsoredTransaction({
        action: form.action,
        senderAddress: account.address,
        paymentCoinId: form.paymentCoinId || undefined,
        escrowObjectId: form.escrowObjectId || undefined,
        sellerAddress: form.sellerAddress || undefined,
        expectedAmountUnits: form.expectedAmountUnits || undefined,
        feeBps: form.feeBps ? Number(form.feeBps) : undefined,
        gasBudgetMist: form.gasBudgetMist || undefined,
        deliveryProofUri: form.deliveryProofUri || undefined,
      });
      setRecord(built);

      const signed = await withTimeout(
        signTransaction({
          transaction: built.transactionBytes,
          chain: `sui:${config?.network ?? "testnet"}`,
        }),
        walletSignatureTimeoutMs,
        "Wallet did not return a signature. Unlock the wallet, keep the confirmation popup open, and retry.",
      );

      if (signed.bytes !== built.transactionBytes) {
        throw new Error("Wallet returned different transaction bytes; refusing to submit");
      }

      const submitted = await submitSponsoredTransaction(built.id, signed.signature);
      setRecord(submitted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  const needsCoin = form.action === "fund-mock-usdc";
  const needsEscrow = form.action !== "fund-mock-usdc";
  const needsSeller = form.action === "fund-mock-usdc";
  const canSubmit = Boolean(account) && !pending;

  return (
    <section className="sponsor-panel">
      <div className="sponsor-heading">
        <div>
          <p className="eyebrow">Sponsored transaction mode</p>
          <h2>mUSDC escrow sponsor path</h2>
        </div>
        <ConnectButton connectText="Connect Sui wallet" />
      </div>

      {unsupportedSponsoredWalletReason(currentWallet?.name) && (
        <div className="sponsor-result">
          <div>
            <span>Wallet</span>
            <strong>unsupported</strong>
          </div>
          <div>
            <span>Action</span>
            <strong>{unsupportedSponsoredWalletReason(currentWallet?.name)}</strong>
          </div>
        </div>
      )}

      <dl className="sponsor-facts">
        <div>
          <dt>Sponsor</dt>
          <dd>{config?.sponsorEnabled ? shortId(config.sponsorAddress ?? "configured") : "not configured"}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>{account ? shortId(account.address) : "not connected"}</dd>
        </div>
        <div>
          <dt>Package</dt>
          <dd>{config?.packageId ? shortId(config.packageId) : "unknown"}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>{config?.supportedTokens[0]?.symbol ?? "mUSDC"}</dd>
        </div>
      </dl>

      {error && <div className="error">{error}</div>}

      <div className="sponsor-grid">
        <label>
          Action
          <select
            value={form.action}
            onChange={(event) => setForm({ ...form, action: event.target.value as SponsoredTransactionAction })}
          >
            {(config?.sponsoredActions ?? ["fund-mock-usdc", "mark-delivered", "release", "refund"]).map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payment Coin ID
          <input
            disabled={!needsCoin}
            value={form.paymentCoinId}
            onChange={(event) => setForm({ ...form, paymentCoinId: event.target.value })}
          />
        </label>
        <label>
          Escrow Object ID
          <input
            disabled={!needsEscrow}
            value={form.escrowObjectId}
            onChange={(event) => setForm({ ...form, escrowObjectId: event.target.value })}
          />
        </label>
        <label>
          Seller Address
          <input
            disabled={!needsSeller}
            value={form.sellerAddress}
            onChange={(event) => setForm({ ...form, sellerAddress: event.target.value })}
          />
        </label>
        <label>
          Expected Units
          <input
            disabled={!needsCoin}
            inputMode="numeric"
            value={form.expectedAmountUnits}
            onChange={(event) => setForm({ ...form, expectedAmountUnits: event.target.value })}
          />
        </label>
        <label>
          Fee bps
          <input
            disabled={!needsCoin}
            inputMode="numeric"
            value={form.feeBps}
            onChange={(event) => setForm({ ...form, feeBps: event.target.value })}
          />
        </label>
        <label>
          Gas Budget Mist
          <input
            inputMode="numeric"
            value={form.gasBudgetMist}
            onChange={(event) => setForm({ ...form, gasBudgetMist: event.target.value })}
          />
        </label>
        <label>
          Delivery Proof URI
          <input
            disabled={form.action !== "mark-delivered"}
            value={form.deliveryProofUri}
            onChange={(event) => setForm({ ...form, deliveryProofUri: event.target.value })}
          />
        </label>
      </div>

      <button className="primary" disabled={!canSubmit} onClick={handleBuildSignSubmit}>
        {pending ? "Submitting sponsored transaction..." : "Build, sign, and submit"}
      </button>

      {record && (
        <div className="sponsor-result">
          <div>
            <span>Status</span>
            <strong>{record.status}</strong>
          </div>
          <div>
            <span>Request</span>
            <strong>{record.id}</strong>
          </div>
          <div>
            <span>Digest</span>
            {record.digest ? (
              <a href={explorerUrl(record.digest, config?.network ?? "testnet")} target="_blank" rel="noreferrer">
                {shortId(record.digest)}
              </a>
            ) : (
              <strong>pending</strong>
            )}
          </div>
          <div>
            <span>Expires</span>
            <strong>{new Date(record.expiresAt).toLocaleTimeString()}</strong>
          </div>
        </div>
      )}
    </section>
  );
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function explorerUrl(digest: string, network: AppConfig["network"]): string {
  return `https://suiexplorer.com/txblock/${digest}?network=${network}`;
}

function unsupportedSponsoredWalletReason(walletName: string | undefined): string {
  if (!walletName) return "";
  const normalized = walletName.toLowerCase();
  if (normalized.includes("slush") || normalized.includes("sui wallet")) return "";
  return `${walletName} is connected, but this sponsored transaction demo only supports Slush or Sui Wallet. Disconnect this wallet, then connect Slush or Sui Wallet.`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
