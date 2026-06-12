import { ConnectButton, useCurrentAccount, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useMemo, useState } from "react";
import type {
  AppConfig,
  CreatePaylinkInput,
  Paylink,
  ReceiptSummary,
  SponsoredTransactionAction,
  SponsoredTransactionRecord,
} from "@suipaylink/shared";
import {
  buildSponsoredTransaction,
  createPaylink,
  getConfig,
  getPaylink,
  getReceipt,
  listPaylinks,
  listSponsoredTransactions,
  mutatePaylink,
  syncPaylinkChain,
  submitSponsoredTransaction,
} from "./api";
import { ChainDemo } from "./ChainDemo";
import { SponsoredDemo } from "./SponsoredDemo";

type PaylinkAction = "fund" | "deliver" | "release" | "refund";

const initialForm: CreatePaylinkInput = {
  mode: "escrow",
  sellerName: "Alice AI Automation Studio",
  sellerAddress: "0x648badce46f20a771d805670901239e868f5d0c7e297a3616b579075a800f9f5",
  buyerName: "Bob from Sui Project",
  buyerAddress: "0x3bb115974618e32b56dd6fb259b1c8cbfce72177fe7a36ab618e245ef19ca3f1",
  amount: "100",
  token: "mUSDC",
  memo: "AI support workflow setup - 48 hour delivery",
  feeBps: 100,
};

export function App() {
  const [initialPath] = useState(() => window.location.pathname);
  const publicPaylinkId = parsePublicPaylinkId(initialPath);

  if (publicPaylinkId) {
    return <PublicPaylinkPage paylinkId={publicPaylinkId} />;
  }

  return <DashboardPage />;
}

function DashboardPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [form, setForm] = useState<CreatePaylinkInput>(initialForm);
  const [paylinks, setPaylinks] = useState<Paylink[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [syncingChain, setSyncingChain] = useState(false);
  const [error, setError] = useState<string>("");

  const selected = useMemo(
    () => paylinks.find((paylink) => paylink.id === selectedId) ?? paylinks[0],
    [paylinks, selectedId],
  );

  async function refresh() {
    const [nextConfig, nextPaylinks] = await Promise.all([getConfig(), listPaylinks()]);
    setConfig(nextConfig);
    setPaylinks(nextPaylinks);
    setSelectedId((current) => {
      if (current && nextPaylinks.some((paylink) => paylink.id === current)) {
        return current;
      }
      return nextPaylinks[0]?.id ?? "";
    });
  }

  useEffect(() => {
    refresh().catch((err) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    if (!selected) {
      setReceipt(null);
      return;
    }
    getReceipt(selected.id)
      .then(setReceipt)
      .catch(() => setReceipt(null));
  }, [selected?.id, selected?.status]);

  async function handleCreate() {
    setError("");
    try {
      const paylink = await createPaylink(form);
      await refresh();
      setSelectedId(paylink.id);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleAction(action: PaylinkAction) {
    if (!selected) return;
    setError("");
    try {
      await runPaylinkAction(selected.id, action);
      await refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleSyncChain() {
    if (!selected) return;
    setError("");
    setSyncingChain(true);
    try {
      const nextReceipt = await syncPaylinkChain(selected.id);
      await refresh();
      setReceipt(nextReceipt);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSyncingChain(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Sui Overflow 2026 MVP</p>
          <h1>SuiPayLink</h1>
          <p className="hero-copy">
            Gasless stablecoin escrow links for cross-border digital service work.
          </p>
        </div>
        <div className="network-pill">
          <span>Mock API · {config?.network ?? "testnet"}</span>
          <strong>{config?.sponsorEnabled ? "sponsor enabled" : "sponsor not configured"}</strong>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <ChainDemo />

      <SponsoredDemo config={config} />

      <div className="layout">
        <section className="panel">
          <h2>Create paylink</h2>
          <div className="grid">
            <label>
              Mode
              <select
                value={form.mode}
                onChange={(event) => setForm({ ...form, mode: event.target.value as "direct" | "escrow" })}
              >
                <option value="escrow">Escrow</option>
                <option value="direct" disabled>
                  Direct
                </option>
              </select>
            </label>
            <label>
              Amount
              <input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </label>
            <label>
              Token
              <select value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })}>
                {(config?.supportedTokens ?? [{ symbol: "mUSDC" }]).map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fee bps
              <input
                type="number"
                value={form.feeBps}
                onChange={(event) => setForm({ ...form, feeBps: Number(event.target.value) })}
              />
            </label>
          </div>
          <label>
            Seller
            <input
              value={form.sellerName}
              onChange={(event) => setForm({ ...form, sellerName: event.target.value })}
            />
          </label>
          <label>
            Seller address
            <input
              value={form.sellerAddress}
              onChange={(event) => setForm({ ...form, sellerAddress: event.target.value })}
            />
          </label>
          <label>
            Buyer
            <input
              value={form.buyerName ?? ""}
              onChange={(event) => setForm({ ...form, buyerName: event.target.value })}
            />
          </label>
          <label>
            Buyer address
            <input
              value={form.buyerAddress ?? ""}
              onChange={(event) => setForm({ ...form, buyerAddress: event.target.value })}
            />
          </label>
          <label>
            Memo
            <textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </label>
          <button className="primary" onClick={handleCreate}>
            Create escrow paylink
          </button>
        </section>

        <section className="panel">
          <h2>Seller dashboard</h2>
          <div className="table">
            {paylinks.map((paylink) => (
              <button
                className={`row ${selected?.id === paylink.id ? "active" : ""}`}
                key={paylink.id}
                onClick={() => setSelectedId(paylink.id)}
              >
                <span>{paylink.memo}</span>
                <strong>{paylink.amount} {paylink.token}</strong>
                <em>{paylink.status}</em>
              </button>
            ))}
            {paylinks.length === 0 && <p className="muted">No paylinks yet. Create the first demo link.</p>}
          </div>
        </section>
      </div>

      {selected && (
        <section className="paylink">
          <div>
            <p className="eyebrow">Public paylink</p>
            <h2>{selected.amount} {selected.token}</h2>
            <p>{selected.memo}</p>
            <p className="muted">Seller: {selected.sellerName}</p>
            <p className="muted">Buyer: {selected.buyerName ?? "not specified"}</p>
            <p className="muted">Buyer address: {selected.buyerAddress ?? "not specified"}</p>
            <p className="muted">
              Share URL: <a href={selected.publicUrl}>{selected.publicUrl}</a>
            </p>
          </div>
          <PaylinkActions paylink={selected} onAction={handleAction} />
        </section>
      )}

      {receipt && <ReceiptPanel receipt={receipt} onSyncChain={handleSyncChain} syncingChain={syncingChain} />}
    </main>
  );
}

function PublicPaylinkPage({ paylinkId }: { paylinkId: string }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [paylink, setPaylink] = useState<Paylink | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [sponsoredRecords, setSponsoredRecords] = useState<SponsoredTransactionRecord[]>([]);
  const [syncingChain, setSyncingChain] = useState(false);
  const [error, setError] = useState<string>("");

  async function refresh() {
    const [nextConfig, nextPaylink, nextReceipt, nextSponsoredRecords] = await Promise.all([
      getConfig(),
      getPaylink(paylinkId),
      getReceipt(paylinkId),
      listSponsoredTransactions(paylinkId),
    ]);
    setConfig(nextConfig);
    setPaylink(nextPaylink);
    setReceipt(nextReceipt);
    setSponsoredRecords(nextSponsoredRecords);
  }

  useEffect(() => {
    refresh().catch((err) => setError(errorText(err)));
  }, [paylinkId]);

  async function handleSyncChain() {
    setError("");
    setSyncingChain(true);
    try {
      const nextReceipt = await syncPaylinkChain(paylinkId);
      await refresh();
      setReceipt(nextReceipt);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSyncingChain(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Buyer payment link</p>
          <h1>SuiPayLink</h1>
          <p className="hero-copy">{paylink?.memo ?? "Loading paylink..."}</p>
        </div>
        <div className="network-pill">
          <span>{config?.network ?? "testnet"}</span>
          <strong>{paylink?.status ?? "loading"}</strong>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      {!paylink && !error && <section className="panel">Loading paylink...</section>}

      {paylink && (
        <section className="public-paylink">
          <div className="public-summary">
            <div>
              <p className="eyebrow">Escrow request</p>
              <h2>{paylink.amount} {paylink.token}</h2>
            </div>
            <StatusPill status={paylink.status} />
            <p>{paylink.memo}</p>
            <PaylinkFacts paylink={paylink} />
          </div>
          <SponsoredPaylinkActions
            config={config}
            paylink={paylink}
            onError={setError}
            onRefresh={refresh}
          />
        </section>
      )}

      {receipt && <ReceiptPanel receipt={receipt} onSyncChain={handleSyncChain} syncingChain={syncingChain} />}
      {sponsoredRecords.length > 0 && (
        <SponsoredHistory records={sponsoredRecords} network={config?.network ?? "testnet"} />
      )}
    </main>
  );
}

function SponsoredPaylinkActions({
  config,
  paylink,
  onError,
  onRefresh,
}: {
  config: AppConfig | null;
  paylink: Paylink;
  onError: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const token = config?.supportedTokens.find((item) => item.symbol === paylink.token) ?? config?.supportedTokens[0];
  const expectedAmountUnits = token ? amountToBaseUnits(paylink.amount, token.decimals) : "";
  const [paymentCoinId, setPaymentCoinId] = useState("");
  const [coinLookup, setCoinLookup] = useState("");
  const [pendingAction, setPendingAction] = useState<SponsoredTransactionAction | "find-coin" | null>(null);
  const [lastRecord, setLastRecord] = useState<SponsoredTransactionRecord | null>(null);

  async function findExactCoin() {
    if (!account || !token) return;
    onError("");
    setCoinLookup("");
    setPendingAction("find-coin");
    try {
      const coins = await client.getCoins({
        owner: account.address,
        coinType: token.coinType,
        limit: 50,
      });
      const exactCoin = coins.data.find((coin) => coin.balance === expectedAmountUnits);
      if (!exactCoin) {
        setCoinLookup(`No exact ${paylink.amount} ${paylink.token} coin found`);
        return;
      }
      setPaymentCoinId(exactCoin.coinObjectId);
      setCoinLookup(`Selected ${shortId(exactCoin.coinObjectId)}`);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setPendingAction(null);
    }
  }

  async function executeSponsoredAction(action: SponsoredTransactionAction) {
    if (!account) {
      onError("Connect a Sui wallet first");
      return;
    }
    if (!config?.sponsorEnabled) {
      onError("Sponsor wallet is not configured on the API");
      return;
    }
    if (action === "fund-mock-usdc" && !paymentCoinId) {
      onError("Select or paste a payment coin object before funding");
      return;
    }
    if (action !== "fund-mock-usdc" && !paylink.escrowObjectId) {
      onError("This Paylink has no escrow object yet");
      return;
    }
    const expectedSigner = signerAddressForAction(action, paylink);
    if (expectedSigner && !sameSuiAddress(account.address, expectedSigner)) {
      onError(`Connect the ${signerRoleForAction(action)} wallet for ${action}`);
      return;
    }

    onError("");
    setLastRecord(null);
    setPendingAction(action);
    try {
      const built = await buildSponsoredTransaction({
        action,
        senderAddress: account.address,
        paylinkId: paylink.id,
        paymentCoinId: action === "fund-mock-usdc" ? paymentCoinId : undefined,
        sellerAddress: action === "fund-mock-usdc" ? paylink.sellerAddress : undefined,
        expectedAmountUnits: action === "fund-mock-usdc" ? expectedAmountUnits : undefined,
        feeBps: action === "fund-mock-usdc" ? paylink.feeBps : undefined,
        escrowObjectId: action === "fund-mock-usdc" ? undefined : paylink.escrowObjectId,
        deliveryProofUri: action === "mark-delivered" ? "https://example.com/proofs/public-paylink-delivery.pdf" : undefined,
        gasBudgetMist: action === "fund-mock-usdc" ? "50000000" : "10000000",
      });
      setLastRecord(built);

      const transaction = Transaction.from(built.transactionBytes);
      const signed = await signTransaction({
        transaction,
        chain: `sui:${config.network}`,
      });

      if (signed.bytes !== built.transactionBytes) {
        throw new Error("Wallet returned different transaction bytes; refusing to submit");
      }

      const submitted = await submitSponsoredTransaction(built.id, signed.signature);
      setLastRecord(submitted);
      await onRefresh();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setPendingAction(null);
    }
  }

  const sponsorReady = Boolean(config?.sponsorEnabled);
  const actionSigners: Array<{ label: string; action: SponsoredTransactionAction }> = [
    { label: "Fund", action: "fund-mock-usdc" },
    { label: "Deliver", action: "mark-delivered" },
    { label: "Release", action: "release" },
    { label: "Refund", action: "refund" },
  ];

  return (
    <div className="sponsored-actions">
      <div className="sponsored-actions-heading">
        <div>
          <p className="eyebrow">Sponsored escrow</p>
          <h3>{sponsorReady ? "Sponsor ready" : "Sponsor not configured"}</h3>
        </div>
        <ConnectButton connectText="Connect wallet" />
      </div>

      <dl className="facts compact">
        <div>
          <dt>Wallet</dt>
          <dd>{account ? shortId(account.address) : "not connected"}</dd>
        </div>
        <div>
          <dt>Required signers</dt>
          <dd className="signer-list">
            {actionSigners.map((item) => (
              <span key={item.action}>
                {item.label}: {signerRoleForAction(item.action)} {shortId(signerAddressForAction(item.action, paylink)) || "missing"}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Expected units</dt>
          <dd>{expectedAmountUnits || "unknown"}</dd>
        </div>
        <div>
          <dt>Escrow object</dt>
          <dd>{paylink.escrowObjectId ? shortId(paylink.escrowObjectId) : "pending"}</dd>
        </div>
      </dl>

      {paylink.status === "created" && (
        <div className="coin-picker">
          <label>
            Payment coin object
            <input value={paymentCoinId} onChange={(event) => setPaymentCoinId(event.target.value)} />
          </label>
          <button onClick={findExactCoin} disabled={!account || !token || pendingAction === "find-coin"}>
            {pendingAction === "find-coin" ? "Finding..." : "Find exact coin"}
          </button>
          {coinLookup && <p className="muted">{coinLookup}</p>}
        </div>
      )}

      <div className="actions">
        <button
          onClick={() => executeSponsoredAction("fund-mock-usdc")}
          disabled={!sponsorReady || paylink.status !== "created" || pendingAction === "fund-mock-usdc"}
        >
          {pendingAction === "fund-mock-usdc" ? "Funding..." : "Fund with sponsor"}
        </button>
        <button
          onClick={() => executeSponsoredAction("mark-delivered")}
          disabled={!sponsorReady || paylink.status !== "funded" || pendingAction === "mark-delivered"}
        >
          {pendingAction === "mark-delivered" ? "Marking..." : "Mark delivered"}
        </button>
        <button
          onClick={() => executeSponsoredAction("release")}
          disabled={!sponsorReady || paylink.status !== "delivered" || pendingAction === "release"}
        >
          {pendingAction === "release" ? "Releasing..." : "Release with sponsor"}
        </button>
        <button
          onClick={() => executeSponsoredAction("refund")}
          disabled={!sponsorReady || !["funded", "delivered"].includes(paylink.status) || pendingAction === "refund"}
        >
          {pendingAction === "refund" ? "Refunding..." : "Refund with sponsor"}
        </button>
      </div>

      {lastRecord && (
        <div className="sponsored-latest">
          <span>{lastRecord.action}</span>
          <strong>{lastRecord.status}</strong>
          {lastRecord.digest && (
            <a href={explorerUrl(lastRecord.digest, config?.network ?? "testnet")} target="_blank" rel="noreferrer">
              {shortId(lastRecord.digest)}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SponsoredHistory({
  records,
  network,
}: {
  records: SponsoredTransactionRecord[];
  network: AppConfig["network"];
}) {
  return (
    <section className="panel sponsored-history">
      <h2>Sponsored requests</h2>
      <div className="history-list">
        {records.map((record) => (
          <div key={record.id} className="history-row">
            <span>{record.action}</span>
            <strong>{record.status}</strong>
            <em>{record.gasCostMist ? `${record.gasCostMist} MIST` : record.gasBudgetMist}</em>
            {record.digest ? (
              <a href={explorerUrl(record.digest, network)} target="_blank" rel="noreferrer">
                {shortId(record.digest)}
              </a>
            ) : (
              <span>{shortId(record.id)}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function PaylinkFacts({ paylink }: { paylink: Paylink }) {
  return (
    <dl className="facts">
      <div>
        <dt>Seller</dt>
        <dd>{paylink.sellerName}</dd>
      </div>
      <div>
        <dt>Seller address</dt>
        <dd>{paylink.sellerAddress}</dd>
      </div>
      <div>
        <dt>Buyer</dt>
        <dd>{paylink.buyerName ?? "not specified"}</dd>
      </div>
      <div>
        <dt>Buyer address</dt>
        <dd>{paylink.buyerAddress ?? "not specified"}</dd>
      </div>
      <div>
        <dt>Fee</dt>
        <dd>{paylink.feeBps / 100}%</dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>{formatDate(paylink.createdAt)}</dd>
      </div>
    </dl>
  );
}

function PaylinkActions({
  paylink,
  onAction,
  pendingAction,
}: {
  paylink: Paylink;
  onAction: (action: PaylinkAction) => void;
  pendingAction?: PaylinkAction | null;
}) {
  return (
    <div className="actions">
      <button onClick={() => onAction("fund")} disabled={paylink.status !== "created" || pendingAction === "fund"}>
        {pendingAction === "fund" ? "Funding..." : "Buyer funds escrow"}
      </button>
      <button onClick={() => onAction("deliver")} disabled={paylink.status !== "funded" || pendingAction === "deliver"}>
        {pendingAction === "deliver" ? "Marking..." : "Seller marks delivered"}
      </button>
      <button onClick={() => onAction("release")} disabled={paylink.status !== "delivered" || pendingAction === "release"}>
        {pendingAction === "release" ? "Releasing..." : "Buyer releases"}
      </button>
      <button
        onClick={() => onAction("refund")}
        disabled={!["funded", "delivered"].includes(paylink.status) || pendingAction === "refund"}
      >
        {pendingAction === "refund" ? "Refunding..." : "Refund"}
      </button>
    </div>
  );
}

function ReceiptPanel({
  receipt,
  onSyncChain,
  syncingChain,
}: {
  receipt: ReceiptSummary;
  onSyncChain?: () => void;
  syncingChain?: boolean;
}) {
  const chain = receipt.chain;

  return (
    <section className="panel receipt">
      <div className="receipt-heading">
        <h2>Receipt</h2>
        {onSyncChain && (
          <button onClick={onSyncChain} disabled={syncingChain}>
            {syncingChain ? "Syncing..." : "Sync chain"}
          </button>
        )}
      </div>
      <div className="receipt-grid">
        <div>
          <p className="muted">Seller receives</p>
          <strong>{receipt.sellerAmount} {receipt.paylink.token}</strong>
        </div>
        <div>
          <p className="muted">Platform fee</p>
          <strong>{receipt.platformFee} {receipt.paylink.token}</strong>
        </div>
        <div>
          <p className="muted">Digest</p>
          <strong>{receipt.paylink.transactionDigest ?? "pending"}</strong>
        </div>
        <div>
          <p className="muted">Escrow object</p>
          <strong>{receipt.paylink.escrowObjectId ?? "pending"}</strong>
        </div>
      </div>
      <ol className="timeline">
        {receipt.timeline.map((item) => (
          <li key={item.label} className={item.status}>
            <strong>{item.label}</strong>
            {item.timestamp && <span>{formatDate(item.timestamp)}</span>}
          </li>
        ))}
      </ol>
      {chain && (
        <div className="chain-receipt">
          <div className="chain-receipt-header">
            <div>
              <p className="eyebrow">Chain verification</p>
              <h3>{chain.status}</h3>
            </div>
            <span>{formatDate(chain.syncedAt)}</span>
          </div>
          <dl className="facts compact">
            <div>
              <dt>Network</dt>
              <dd>{chain.network}</dd>
            </div>
            <div>
              <dt>Escrow object</dt>
              <dd>{chain.escrowObjectId ? shortId(chain.escrowObjectId) : "pending"}</dd>
            </div>
            <div>
              <dt>Digests</dt>
              <dd>{chain.digests.length}</dd>
            </div>
            <div>
              <dt>Events</dt>
              <dd>{chain.events.length}</dd>
            </div>
          </dl>
          {chain.escrow && (
            <dl className="facts compact">
              <div>
                <dt>Funded</dt>
                <dd>{String(chain.escrow.funded)}</dd>
              </div>
              <div>
                <dt>Delivered</dt>
                <dd>{String(chain.escrow.delivered)}</dd>
              </div>
              <div>
                <dt>Released</dt>
                <dd>{String(chain.escrow.released)}</dd>
              </div>
              <div>
                <dt>Refunded</dt>
                <dd>{String(chain.escrow.refunded)}</dd>
              </div>
            </dl>
          )}
          {chain.digests.length > 0 && (
            <div className="chain-list">
              {chain.digests.map((digest) => (
                <a key={digest} href={explorerUrl(digest, chain.network)} target="_blank" rel="noreferrer">
                  {shortId(digest)}
                </a>
              ))}
            </div>
          )}
          {chain.events.length > 0 && (
            <div className="chain-list">
              {chain.events.slice(0, 6).map((event, index) => (
                <span key={`${event.digest}-${event.type}-${index}`}>{event.type.split("::").slice(-1)[0]}</span>
              ))}
            </div>
          )}
          {chain.errors.length > 0 && (
            <div className="chain-errors">
              {chain.errors.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: Paylink["status"] }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}

async function runPaylinkAction(paylinkId: string, action: PaylinkAction) {
  await mutatePaylink(paylinkId, action, {
    actor: action === "deliver" ? "seller" : "buyer",
    deliveryProofUri: "https://example.com/proofs/alice-ai-workflow-delivery.pdf",
  });
}

function parsePublicPaylinkId(pathname: string): string | null {
  const match = pathname.match(/^\/pay\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function amountToBaseUnits(amount: string, decimals: number): string {
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    return "";
  }
  const units = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  return units || "0";
}

function shortId(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function signerRoleForAction(action: SponsoredTransactionAction): "buyer" | "seller" {
  return action === "mark-delivered" ? "seller" : "buyer";
}

function signerAddressForAction(action: SponsoredTransactionAction, paylink: Paylink): string {
  return (signerRoleForAction(action) === "seller" ? paylink.sellerAddress : paylink.buyerAddress) ?? "";
}

function sameSuiAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function explorerUrl(digest: string, network: AppConfig["network"]): string {
  return `https://suiexplorer.com/txblock/${digest}?network=${network}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
