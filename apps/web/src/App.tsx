import { useEffect, useMemo, useState } from "react";
import type { AppConfig, CreatePaylinkInput, Paylink, ReceiptSummary } from "@suipaylink/shared";
import { createPaylink, getConfig, getPaylink, getReceipt, listPaylinks, mutatePaylink } from "./api";
import { ChainDemo } from "./ChainDemo";
import { SponsoredDemo } from "./SponsoredDemo";

type PaylinkAction = "fund" | "deliver" | "release" | "refund";

const initialForm: CreatePaylinkInput = {
  mode: "escrow",
  sellerName: "Alice AI Automation Studio",
  sellerAddress: "0xseller_demo_address",
  buyerName: "Bob from Sui Project",
  buyerAddress: "0xbuyer_demo_address",
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

      {receipt && <ReceiptPanel receipt={receipt} />}
    </main>
  );
}

function PublicPaylinkPage({ paylinkId }: { paylinkId: string }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [paylink, setPaylink] = useState<Paylink | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<PaylinkAction | null>(null);
  const [error, setError] = useState<string>("");

  async function refresh() {
    const [nextConfig, nextPaylink, nextReceipt] = await Promise.all([
      getConfig(),
      getPaylink(paylinkId),
      getReceipt(paylinkId),
    ]);
    setConfig(nextConfig);
    setPaylink(nextPaylink);
    setReceipt(nextReceipt);
  }

  useEffect(() => {
    refresh().catch((err) => setError(errorText(err)));
  }, [paylinkId]);

  async function handleAction(action: PaylinkAction) {
    if (!paylink) return;
    setError("");
    setPendingAction(action);
    try {
      await runPaylinkAction(paylink.id, action);
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPendingAction(null);
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
          <PaylinkActions paylink={paylink} onAction={handleAction} pendingAction={pendingAction} />
        </section>
      )}

      {receipt && <ReceiptPanel receipt={receipt} />}
    </main>
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

function ReceiptPanel({ receipt }: { receipt: ReceiptSummary }) {
  return (
    <section className="panel receipt">
      <h2>Receipt</h2>
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

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
