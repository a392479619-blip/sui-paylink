import { ConnectButton, useCurrentAccount, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useMemo, useState } from "react";
import type {
  AppConfig,
  CreatePaylinkInput,
  Paylink,
  ReceiptSummary,
  SponsorReadiness,
  SponsoredTransactionAction,
  SponsoredTransactionRecord,
} from "@suipaylink/shared";
import {
  buildSponsoredTransaction,
  createPaylink,
  getConfig,
  getPaylink,
  getReceipt,
  getSponsorReadiness,
  listPaylinks,
  listSponsoredTransactions,
  mintTestMockUsdc,
  mutatePaylink,
  syncPaylinkChain,
  submitSponsoredTransaction,
  STATIC_DEMO_ENABLED,
} from "./api";
import { ChainDemo } from "./ChainDemo";
import { SponsoredDemo } from "./SponsoredDemo";

type PaylinkAction = "fund" | "deliver" | "release" | "refund";
type PaylinkPageRole = "overview" | "buyer" | "seller";

type PaylinkRoute = {
  id: string;
  role: PaylinkPageRole;
};

const initialForm: CreatePaylinkInput = {
  mode: "escrow",
  sellerName: "Alice AI Automation Studio",
  sellerAddress: "0x648badce46f20a771d805670901239e868f5d0c7e297a3616b579075a800f9f5",
  buyerName: "Buyer / initiator",
  buyerAddress: "",
  amount: "100",
  token: "mUSDC",
  memo: "AI support workflow setup - 48 hour delivery",
  feeBps: 100,
};

const TESTNET_PACKAGE_ID = "0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7";
const SPONSORED_ESCROW_OBJECT_ID = "0x9a1fefe14c9148a246122c9d280075994a698650e09ca6e664d9c42e4304e066";

const submissionEvidence = [
  {
    label: "Package",
    value: TESTNET_PACKAGE_ID,
    href: explorerObjectUrl(TESTNET_PACKAGE_ID, "testnet"),
  },
  {
    label: "Publish",
    value: "EzCXP2GqsZg9E9y1tBuje7RiTMQx2a8peExXeEc4SAjH",
    href: explorerUrl("EzCXP2GqsZg9E9y1tBuje7RiTMQx2a8peExXeEc4SAjH", "testnet"),
  },
  {
    label: "Sponsored fund",
    value: "6JPrSsia2NDvzR5SgYBn21KXCFREb7QRsnzfQzs8saad",
    href: explorerUrl("6JPrSsia2NDvzR5SgYBn21KXCFREb7QRsnzfQzs8saad", "testnet"),
  },
  {
    label: "Sponsored release",
    value: "2AUpapsvVJdkXLtt9jVo2X8dgBPP2pvKv8FdGE6nz8QM",
    href: explorerUrl("2AUpapsvVJdkXLtt9jVo2X8dgBPP2pvKv8FdGE6nz8QM", "testnet"),
  },
  {
    label: "Sponsored escrow",
    value: SPONSORED_ESCROW_OBJECT_ID,
    href: explorerObjectUrl(SPONSORED_ESCROW_OBJECT_ID, "testnet"),
  },
];

const submissionBoundaries = [
  {
    status: "Verified",
    title: "Move escrow state machine",
    detail: "Published on Sui Testnet with SUI escrow, pre-delivery refund, two-party, MockUSDC, and sponsored MockUSDC smoke evidence.",
  },
  {
    status: "Verified",
    title: "Gasless escrow proof",
    detail: "Sponsored MockUSDC flow proves buyer and seller can stay at 0 SUI while sponsor pays gas.",
  },
  {
    status: "Demo",
    title: "Static public demo",
    detail: "Browser-local Paylink demo for reviewers. It does not build transaction bytes, spend gas, or submit new Sui transactions.",
  },
  {
    status: "Open",
    title: "Browser-wallet E2E",
    detail: "Needs funded sponsor gas and one real wallet-signed sponsored flow before calling it full hosted gasless UX.",
  },
];

export function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const paylinkRoute = parsePaylinkRoute(currentPath);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(path: string) {
    const href = appHref(path);
    window.history.pushState({}, "", href);
    setCurrentPath(new URL(href).pathname);
    window.scrollTo({ top: 0 });
  }

  if (paylinkRoute) {
    return <PublicPaylinkPage paylinkId={paylinkRoute.id} role={paylinkRoute.role} />;
  }
  if (isCreatePath(currentPath)) {
    return <CreateOrderPage onNavigate={navigate} />;
  }
  if (!isDashboardPath(currentPath)) {
    return <InvalidRoutePage path={currentPath} onNavigate={navigate} />;
  }

  return <DashboardPage onNavigate={navigate} />;
}

function DashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const account = useCurrentAccount();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [paylinks, setPaylinks] = useState<Paylink[]>([]);
  const [error, setError] = useState<string>("");
  const connectedAddress = account?.address ?? "";
  const userOrders = useMemo(
    () => (connectedAddress ? paylinks.filter((paylink) => paylinkBelongsToWallet(paylink, connectedAddress)) : []),
    [paylinks, connectedAddress],
  );
  const activeOrders = userOrders.filter((paylink) => !["released", "refunded"].includes(paylink.status)).length;
  const buyerOrders = userOrders.filter((paylink) => paylink.buyerAddress && sameSuiAddress(paylink.buyerAddress, connectedAddress)).length;
  const sellerOrders = userOrders.filter((paylink) => paylink.sellerAddress && sameSuiAddress(paylink.sellerAddress, connectedAddress)).length;
  const canCreate = Boolean(connectedAddress);

  async function refresh() {
    const [nextConfig, nextPaylinks] = await Promise.all([getConfig(), listPaylinks()]);
    setConfig(nextConfig);
    setPaylinks(nextPaylinks);
  }

  useEffect(() => {
    refresh().catch((err) => setError(errorText(err)));
  }, []);

  function openCreatePage() {
    if (!canCreate) return;
    onNavigate("create");
  }

  return (
    <main className="shell">
      {STATIC_DEMO_ENABLED && <StaticDemoBanner />}
      <section className="hero platform-hero">
        <div>
          <p className="eyebrow">SuiPayLink platform</p>
          <h1>Escrow links for service work on Sui</h1>
          <p className="hero-copy">
            Buyers lock stablecoin funds before work starts. Sellers see proof of funds, deliver the service,
            and get paid after buyer release. The app sponsor covers Sui gas for the wallet-signed flow.
          </p>
          <div className="hero-actions">
            <ConnectButton connectText="Connect wallet" />
            <button className="primary" onClick={openCreatePage} disabled={!canCreate}>
              Create escrow order
            </button>
          </div>
          {!canCreate && <p className="muted">Connect a Sui wallet to create orders and view related orders.</p>}
        </div>
        <div className="platform-status-card">
          <p className="eyebrow">Account center</p>
          <dl>
            <div>
              <dt>Network</dt>
              <dd>{config?.network ?? "testnet"}</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>{connectedAddress ? shortId(connectedAddress) : "not connected"}</dd>
            </div>
            <div>
              <dt>Related orders</dt>
              <dd>{connectedAddress ? userOrders.length : "connect first"}</dd>
            </div>
            <div>
              <dt>Sponsor gas</dt>
              <dd>{config?.sponsorEnabled ? "enabled" : "not configured"}</dd>
            </div>
          </dl>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="platform-grid">
        <div className="platform-card">
          <span>01</span>
          <strong>Funds lock before work</strong>
          <p>Seller can verify that the buyer has funded the escrow before committing delivery time.</p>
        </div>
        <div className="platform-card">
          <span>02</span>
          <strong>Buyer controls final release</strong>
          <p>Funds are released after delivery review. Pre-delivery refunds stay separate from post-delivery disputes.</p>
        </div>
        <div className="platform-card">
          <span>03</span>
          <strong>Gasless wallet signing</strong>
          <p>Buyer and seller sign the business actions while the sponsor pays Sui network gas.</p>
        </div>
      </section>

      <section className="panel orders-center">
        <div className="orders-heading">
          <div>
            <p className="eyebrow">Your orders</p>
            <h2>Related escrow orders</h2>
          </div>
          <div className="order-stats">
            <span>{activeOrders} active</span>
            <span>{buyerOrders} buyer</span>
            <span>{sellerOrders} seller</span>
          </div>
        </div>

        {!connectedAddress && (
          <div className="empty-state">
            <h3>Connect wallet to load your order center</h3>
            <p className="muted">After login, this page shows orders where the connected wallet is the buyer or seller.</p>
            <ConnectButton connectText="Connect wallet" />
          </div>
        )}

        {connectedAddress && userOrders.length === 0 && (
          <div className="empty-state">
            <h3>No related orders yet</h3>
            <p className="muted">Create a buyer-started escrow order, or ask a buyer to use your seller wallet address.</p>
            <button className="primary" onClick={openCreatePage}>
              Create escrow order
            </button>
          </div>
        )}

        {connectedAddress && userOrders.length > 0 && (
          <div className="order-list">
            {userOrders.map((paylink) => (
              <UserOrderCard key={paylink.id} paylink={paylink} accountAddress={connectedAddress} />
            ))}
          </div>
        )}
      </section>

      <details className="advanced-verification">
        <summary>Advanced verification panels</summary>
        <p className="muted">
          These panels are for low-level Sui transaction checks. They are not required for the buyer/seller demo flow.
        </p>
        <ChainDemo />
        <SponsoredDemo config={config} />
        <SubmissionEvidencePanel />
      </details>
    </main>
  );
}

function CreateOrderPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const account = useCurrentAccount();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [form, setForm] = useState<CreatePaylinkInput>(initialForm);
  const [createdPaylink, setCreatedPaylink] = useState<Paylink | null>(null);
  const [error, setError] = useState<string>("");
  const canCreate = Boolean(account?.address);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((err) => setError(errorText(err)));
  }, []);

  async function handleCreate() {
    setError("");
    if (!account?.address) {
      setError("Connect the buyer wallet before creating an escrow order");
      return;
    }
    try {
      const paylink = await createPaylink({
        ...form,
        buyerAddress: account.address,
      });
      setCreatedPaylink(paylink);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <main className="shell">
      {STATIC_DEMO_ENABLED && <StaticDemoBanner />}
      <section className="hero">
        <div>
          <p className="eyebrow">Create escrow order</p>
          <h1>Start a buyer-funded service escrow</h1>
          <p className="hero-copy">
            Fill in the seller and service details. The buyer wallet comes from the wallet already connected on the platform home.
          </p>
        </div>
        <div className="hero-actions stacked">
          <button className="button-link" onClick={() => onNavigate("")}>
            Back to platform
          </button>
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <div className="layout create-layout">
        <section className="panel">
          <h2>Order details</h2>
          <p className="muted">
            Enter the seller receiving wallet and service scope. The seller does not need an account before order creation.
          </p>
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
            Seller receiving address
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
          <div className="wallet-bound-field">
            <span>Buyer wallet</span>
            <strong>{account?.address ? shortId(account.address) : "Not connected"}</strong>
            <p className="muted">This wallet comes from the platform home and becomes the buyer for funding, refund, and release actions.</p>
          </div>
          <label>
            Memo
            <textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
          </label>
          <div className="create-order-action">
            <button className="primary" onClick={handleCreate} disabled={!canCreate}>
              Create escrow order
            </button>
            <button className="button-link" onClick={() => onNavigate("")}>
              Back to platform
            </button>
          </div>
        </section>

        <aside className="panel create-side-panel">
          <p className="eyebrow">What happens next</p>
          <h2>Buyer and seller get separate pages</h2>
          <ol>
            <li>Buyer funds escrow from the Buyer page.</li>
            <li>Seller marks delivery from the Seller page.</li>
            <li>Buyer releases funds after review.</li>
          </ol>
          <p className="muted">
            Refund is only automatic before seller delivery. After delivery, problems move to the dispute path in this MVP.
          </p>
        </aside>
      </div>

      {createdPaylink && (
        <section className="paylink">
          <div>
            <p className="eyebrow">Created order</p>
            <h2>{createdPaylink.amount} {createdPaylink.token}</h2>
            <p>{createdPaylink.memo}</p>
            <p className="muted">Buyer wallet: {createdPaylink.buyerAddress || "recorded after funding"}</p>
            <p className="muted">Seller wallet: {createdPaylink.sellerAddress}</p>
            <div className="role-links">
              <a className="button-link" href={paylinkHref(createdPaylink.id, "buyer")} target="_blank" rel="noreferrer">
                Open Buyer page
              </a>
              <a className="button-link" href={paylinkHref(createdPaylink.id, "seller")} target="_blank" rel="noreferrer">
                Open Seller page
              </a>
              <a className="button-link" href={paylinkHref(createdPaylink.id, "overview")} target="_blank" rel="noreferrer">
                Open overview
              </a>
            </div>
          </div>
          <StatusPill status={createdPaylink.status} />
        </section>
      )}
    </main>
  );
}

function UserOrderCard({ paylink, accountAddress }: { paylink: Paylink; accountAddress: string }) {
  const role = orderRoleForWallet(paylink, accountAddress);
  const primaryRole: PaylinkPageRole = role === "seller" ? "seller" : "buyer";

  return (
    <article className="order-card">
      <div>
        <div className="order-card-topline">
          <span className={`role-badge ${role}`}>{role}</span>
          <StatusPill status={paylink.status} />
        </div>
        <h3>{paylink.memo}</h3>
        <p className="muted">{paylink.amount} {paylink.token} · {paylink.sellerName}</p>
      </div>
      <dl className="facts compact">
        <div>
          <dt>Buyer</dt>
          <dd>{paylink.buyerAddress ? shortId(paylink.buyerAddress) : "pending"}</dd>
        </div>
        <div>
          <dt>Seller</dt>
          <dd>{paylink.sellerAddress ? shortId(paylink.sellerAddress) : "pending"}</dd>
        </div>
        <div>
          <dt>Escrow</dt>
          <dd>{paylink.escrowObjectId ? shortId(paylink.escrowObjectId) : "pending"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDate(paylink.createdAt)}</dd>
        </div>
      </dl>
      <div className="role-links">
        <a className="button-link" href={paylinkHref(paylink.id, primaryRole)}>
          Continue as {role}
        </a>
        <a className="button-link" href={paylinkHref(paylink.id, "overview")}>
          Overview
        </a>
      </div>
    </article>
  );
}

function paylinkBelongsToWallet(paylink: Paylink, address: string): boolean {
  return Boolean(
    (paylink.buyerAddress && sameSuiAddress(paylink.buyerAddress, address)) ||
      (paylink.sellerAddress && sameSuiAddress(paylink.sellerAddress, address)),
  );
}

function orderRoleForWallet(paylink: Paylink, address: string): "buyer" | "seller" {
  if (paylink.sellerAddress && sameSuiAddress(paylink.sellerAddress, address)) {
    return "seller";
  }
  return "buyer";
}

function InvalidRoutePage({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Route not available</p>
          <h1>SuiPayLink</h1>
          <p className="hero-copy">
            <code>{path}</code> is not a valid demo route. Start from the home page and open the generated Buyer,
            Seller, or Overview links.
          </p>
        </div>
      </section>
      <section className="panel missing-paylink">
        <h2>Use the generated demo links</h2>
        <p className="muted">
          Valid routes look like <code>/buyer/&lt;id&gt;</code>, <code>/seller/&lt;id&gt;</code>, or{" "}
          <code>/pay/&lt;id&gt;</code>.
        </p>
        <button className="button-link" onClick={() => onNavigate("")}>
          Back to platform
        </button>
      </section>
    </main>
  );
}

function PublicPaylinkPage({ paylinkId, role }: { paylinkId: string; role: PaylinkPageRole }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [paylink, setPaylink] = useState<Paylink | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [sponsorReadiness, setSponsorReadiness] = useState<SponsorReadiness | null>(null);
  const [sponsoredRecords, setSponsoredRecords] = useState<SponsoredTransactionRecord[]>([]);
  const [syncingChain, setSyncingChain] = useState(false);
  const [runningMockDemo, setRunningMockDemo] = useState(false);
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
    getSponsorReadiness()
      .then(setSponsorReadiness)
      .catch(() => setSponsorReadiness(null));
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

  async function handleRunMockDemo() {
    if (!paylink) return;
    setError("");
    setRunningMockDemo(true);
    try {
      const nextAction = mockDemoActionsForStatus(paylink.status)[0];
      if (nextAction) {
        await runPaylinkAction(paylink.id, nextAction);
      }
      await refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRunningMockDemo(false);
    }
  }

  return (
    <main className="shell">
      {STATIC_DEMO_ENABLED && <StaticDemoBanner />}
      <section className="hero">
        <div>
          <p className="eyebrow">{roleEyebrow(role)}</p>
          <h1>SuiPayLink</h1>
          <p className="hero-copy">{paylink?.memo ?? "Loading paylink..."}</p>
        </div>
        <div className="network-pill">
          <span>{config?.network ?? "testnet"}</span>
          <strong>{paylink?.status ?? "loading"}</strong>
        </div>
      </section>

      {error && !paylink && <MissingPaylinkPanel paylinkId={paylinkId} error={error} />}
      {error && paylink && <div className="error">{error}</div>}

      {!paylink && !error && <section className="panel">Loading paylink...</section>}

      {paylink && (
        <>
        <RoleSwitch paylink={paylink} role={role} />
        <section className={`public-paylink ${role}`}>
          {role === "overview" ? (
            <>
              <PaylinkSummary paylink={paylink} />
              <OverviewFlowPanel paylink={paylink} sponsorReadiness={sponsorReadiness} records={sponsoredRecords} />
            </>
          ) : (
            <>
              <SponsoredPaylinkActions
                config={config}
                sponsorReadiness={sponsorReadiness}
                paylink={paylink}
                role={role}
                onError={setError}
                onRefresh={refresh}
              />
              <PaylinkSummary paylink={paylink} compact />
            </>
          )}
        </section>
        </>
      )}

      {paylink?.demoSeed && !config?.sponsorEnabled && (
        <DemoSeedPanel paylink={paylink} running={runningMockDemo} onRun={handleRunMockDemo} />
      )}

      {receipt && <ReceiptPanel receipt={receipt} onSyncChain={handleSyncChain} syncingChain={syncingChain} />}
      {sponsoredRecords.length > 0 && (
        <SponsoredHistory records={sponsoredRecords} network={config?.network ?? "testnet"} />
      )}
    </main>
  );
}

function SubmissionEvidencePanel() {
  return (
    <section className="submission-panel">
      <div className="submission-heading">
        <div>
          <p className="eyebrow">Submission evidence</p>
          <h2>Testnet proof and demo boundary</h2>
        </div>
        <a className="button-link" href={demoPaylinkHref()}>
          Open demo Paylink
        </a>
      </div>

      <div className="evidence-grid">
        {submissionEvidence.map((item) => (
          <a key={item.label} className="evidence-item" href={item.href} target="_blank" rel="noreferrer">
            <span>{item.label}</span>
            <strong>{shortId(item.value)}</strong>
          </a>
        ))}
      </div>

      <div className="boundary-grid">
        {submissionBoundaries.map((item) => (
          <div key={item.title} className={`boundary-item ${item.status.toLowerCase()}`}>
            <span>{item.status}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MissingPaylinkPanel({ paylinkId, error }: { paylinkId: string; error: string }) {
  return (
    <section className="panel missing-paylink">
      <p className="eyebrow">Paylink not available</p>
      <h2>This link is not in the local database</h2>
      <p>
        The local database was cleared, so old demo links such as <code>{paylinkId}</code> no longer exist.
        Start from the home page and create a new buyer-started escrow order.
      </p>
      <p className="muted">Raw error: {error}</p>
      <a className="button-link" href={appHref("")}>
        Back to platform
      </a>
    </section>
  );
}

function StaticDemoBanner() {
  return (
    <section className="static-demo-banner">
      <div>
        <p className="eyebrow">Public static demo</p>
        <strong>Browser-only mock mode</strong>
      </div>
      <p>
        This page is built for GitHub Pages. It can demonstrate Paylink creation and mock escrow state,
        but it does not build sponsored transactions, spend gas, or submit new Sui transactions.
      </p>
    </section>
  );
}

function RoleSwitch({ paylink, role }: { paylink: Paylink; role: PaylinkPageRole }) {
  const links: Array<{ label: string; role: PaylinkPageRole; detail: string }> = [
    { label: "Buyer page", role: "buyer", detail: "mint test mUSDC, fund escrow, release after delivery" },
    { label: "Seller page", role: "seller", detail: "mark delivered after buyer funds escrow" },
    { label: "Overview", role: "overview", detail: "see both sides and transaction history" },
  ];

  return (
    <section className="role-switch">
      {links.map((item) => (
        <a
          key={item.role}
          className={item.role === role ? "active" : ""}
          href={paylinkHref(paylink.id, item.role)}
        >
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </a>
      ))}
    </section>
  );
}

function PaylinkSummary({ paylink, compact = false }: { paylink: Paylink; compact?: boolean }) {
  return (
    <div className={`public-summary ${compact ? "compact-summary" : ""}`}>
      <div>
        <p className="eyebrow">Escrow request</p>
        <h2>{paylink.amount} {paylink.token}</h2>
      </div>
      <StatusPill status={paylink.status} />
      <p>{paylink.memo}</p>
      <PaylinkFacts paylink={paylink} compact={compact} />
    </div>
  );
}

function OverviewFlowPanel({
  paylink,
  sponsorReadiness,
  records,
}: {
  paylink: Paylink;
  sponsorReadiness: SponsorReadiness | null;
  records: SponsoredTransactionRecord[];
}) {
  const currentAction = currentWalletAction(paylink.status);
  const nextRole = currentAction ? signerRoleForAction(currentAction) : undefined;

  return (
    <section className="overview-flow-panel">
      <div className="overview-flow-heading">
        <div>
          <p className="eyebrow">Workflow overview</p>
          <h2>{currentAction ? `${capitalize(nextRole ?? "next")} action next` : "Escrow flow complete"}</h2>
        </div>
        <StatusPill status={paylink.status} />
      </div>

      <div className="overview-actions">
        <a className="button-link" href={paylinkHref(paylink.id, "buyer")}>
          Open Buyer page
        </a>
        <a className="button-link" href={paylinkHref(paylink.id, "seller")}>
          Open Seller page
        </a>
      </div>

      <div className="overview-steps">
        {walletE2ESteps.map((step) => {
          const state = walletE2EStepState(paylink.status, step.action);
          return (
            <div key={step.action} className={`overview-step ${state}`}>
              <span>{step.role}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <em>{signerExpectationLabel(step.action, paylink)}</em>
            </div>
          );
        })}
      </div>

      <dl className="facts overview-facts">
        <div>
          <dt>Sponsor</dt>
          <dd>{sponsorReadiness?.ready ? "ready" : "not ready"}</dd>
        </div>
        <div>
          <dt>Escrow object</dt>
          <dd>{paylink.escrowObjectId ? shortId(paylink.escrowObjectId) : "pending"}</dd>
        </div>
        <div>
          <dt>Sponsored records</dt>
          <dd>{records.length}</dd>
        </div>
        <div>
          <dt>Next role</dt>
          <dd>{nextRole ?? "none"}</dd>
        </div>
      </dl>
    </section>
  );
}

function SponsoredPaylinkActions({
  config,
  sponsorReadiness,
  paylink,
  role,
  onError,
  onRefresh,
}: {
  config: AppConfig | null;
  sponsorReadiness: SponsorReadiness | null;
  paylink: Paylink;
  role: PaylinkPageRole;
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
  const [pendingAction, setPendingAction] = useState<
    SponsoredTransactionAction | "find-coin" | "mint-test-coin" | null
  >(null);
  const [lastRecord, setLastRecord] = useState<SponsoredTransactionRecord | null>(null);

  async function mintTestCoin() {
    if (!account || !expectedAmountUnits) return;
    onError("");
    setCoinLookup("");
    setPendingAction("mint-test-coin");
    try {
      const minted = await mintTestMockUsdc({
        recipientAddress: account.address,
        amountUnits: expectedAmountUnits,
        paylinkId: paylink.id,
      });
      if (minted.coinObjectId) {
        setPaymentCoinId(minted.coinObjectId);
        setCoinLookup(`Minted and selected ${shortId(minted.coinObjectId)} (${shortId(minted.digest)})`);
        return;
      }
      setCoinLookup(`Minted ${paylink.amount} ${paylink.token}; click Find exact coin to select it`);
    } catch (err) {
      onError(errorText(err));
    } finally {
      setPendingAction(null);
    }
  }

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
    if (action === "fund-mock-usdc" && !paylink.sellerAddress) {
      onError("Create the paylink with a seller receiving address before buyer funding");
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
        sellerAddress: action === "fund-mock-usdc" ? paylink.sellerAddress || undefined : undefined,
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

  const sponsorReady = Boolean(config?.sponsorEnabled && sponsorReadiness?.ready);
  const sponsorTitle = sponsorReady
    ? "Sponsor ready"
    : config?.sponsorEnabled
      ? "Sponsor not funded"
      : "Sponsor not configured";
  const connectedAddress = account?.address;
  const buyerConnected = Boolean(
    connectedAddress &&
      (!paylink.buyerAddress || sameSuiAddress(connectedAddress, paylink.buyerAddress)) &&
      (!paylink.sellerAddress || !sameSuiAddress(connectedAddress, paylink.sellerAddress)),
  );
  const sellerConnected = Boolean(
    connectedAddress && paylink.sellerAddress && sameSuiAddress(connectedAddress, paylink.sellerAddress),
  );
  const pending = Boolean(pendingAction);
  const canMintTestCoin = Boolean(
    config?.mockUsdcMintEnabled &&
      buyerConnected &&
      expectedAmountUnits &&
      paylink.status === "created" &&
      pendingAction !== "mint-test-coin",
  );
  const canFindExactCoin = Boolean(buyerConnected && token && pendingAction !== "find-coin");
  const canFund = Boolean(
    sponsorReady &&
      buyerConnected &&
      paylink.sellerAddress &&
      paymentCoinId.trim() &&
      paylink.status === "created" &&
      pendingAction !== "fund-mock-usdc",
  );
  const canDeliver = Boolean(
    sponsorReady &&
      sellerConnected &&
      paylink.escrowObjectId &&
      paylink.status === "funded" &&
      pendingAction !== "mark-delivered",
  );
  const canRelease = Boolean(
    sponsorReady &&
      buyerConnected &&
      paylink.escrowObjectId &&
      paylink.status === "delivered" &&
      pendingAction !== "release",
  );
  const canRefund = Boolean(
    sponsorReady &&
      buyerConnected &&
      paylink.escrowObjectId &&
      paylink.status === "funded" &&
      pendingAction !== "refund",
  );
  const showBuyerControls = role !== "seller";
  const showSellerControls = role !== "buyer";
  const roleInstruction = actionInstructionForRole(role, paylink);
  const actionSigners: Array<{ label: string; action: SponsoredTransactionAction }> = [
    { label: "Fund", action: "fund-mock-usdc" },
    { label: "Deliver", action: "mark-delivered" },
    { label: "Release", action: "release" },
    { label: "Pre-delivery refund", action: "refund" },
  ];

  return (
    <div className="sponsored-actions">
      <div className="sponsored-actions-heading">
        <div>
          <p className="eyebrow">Sponsored escrow</p>
          <h3>{sponsorTitle}</h3>
        </div>
        <ConnectButton connectText="Connect wallet" />
      </div>

      <div className={`role-focus-panel ${role}`}>
        <span>{roleLabel(role)}</span>
        <strong>{roleInstruction.title}</strong>
        <p>{roleInstruction.detail}</p>
      </div>

      <WalletE2EChecklist paylink={paylink} accountAddress={account?.address} role={role} />
      <SponsorReadinessCard readiness={sponsorReadiness} />

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
                {item.label}: {signerRoleForAction(item.action)} {signerExpectationLabel(item.action, paylink)}
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

      {showBuyerControls && paylink.status === "created" && (
        <div className="coin-picker">
          <div>
            <p className="eyebrow">Buyer test coin</p>
            <p className="muted">
              Buyer needs one exact {paylink.amount} {paylink.token} coin object before funding escrow.
            </p>
            {config?.mockUsdcMintEnabled ? (
              <p className="muted">
                Judge Test Mode can mint test mUSDC to the connected Buyer and auto-select the new coin object.
              </p>
            ) : (
              <p className="muted">
                Web mint is not configured. Use the CLI fallback command below, then paste or find the coin object.
              </p>
            )}
            <code className="mint-command">{mintMockUsdcCommand(config, paylink)}</code>
          </div>
          <label>
            Payment coin object
            <input value={paymentCoinId} onChange={(event) => setPaymentCoinId(event.target.value)} />
          </label>
          <button onClick={mintTestCoin} disabled={!canMintTestCoin || pending}>
            {pendingAction === "mint-test-coin" ? "Minting..." : `Mint ${paylink.amount} test ${paylink.token}`}
          </button>
          <button onClick={findExactCoin} disabled={!canFindExactCoin || pending}>
            {pendingAction === "find-coin" ? "Finding..." : "Find exact coin"}
          </button>
          {coinLookup && <p className="muted">{coinLookup}</p>}
        </div>
      )}

      <div className="actions">
        {showBuyerControls && (
          <>
            <button
              onClick={() => executeSponsoredAction("fund-mock-usdc")}
              disabled={!canFund || pending}
            >
              {pendingAction === "fund-mock-usdc" ? "Funding..." : "Buyer signs fund escrow"}
            </button>
            <button
              onClick={() => executeSponsoredAction("release")}
              disabled={!canRelease || pending}
            >
              {pendingAction === "release" ? "Releasing..." : "Buyer signs release"}
            </button>
            {paylink.status === "funded" && (
              <button
                onClick={() => executeSponsoredAction("refund")}
                disabled={!canRefund || pending}
              >
                {pendingAction === "refund" ? "Refunding..." : "Refund before delivery"}
              </button>
            )}
          </>
        )}
        {showSellerControls && (
          <button
            onClick={() => executeSponsoredAction("mark-delivered")}
            disabled={!canDeliver || pending}
          >
            {pendingAction === "mark-delivered" ? "Marking..." : "Seller signs delivery"}
          </button>
        )}
      </div>

      {showBuyerControls && paylink.status === "delivered" && (
        <section className="role-claim-card">
          <div>
            <p className="eyebrow">Dispute policy</p>
            <h3>Automatic refund is closed after delivery</h3>
            <p>
              Buyer can release funds after reviewing delivery. If there is a problem, this MVP records the
              issue off-chain; production dispute handling needs deadlines, evidence review, or mutual approval.
            </p>
          </div>
        </section>
      )}

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

function WalletE2EChecklist({
  paylink,
  accountAddress,
  role,
}: {
  paylink: Paylink;
  accountAddress?: string;
  role: PaylinkPageRole;
}) {
  const currentAction = currentWalletAction(paylink.status);
  const visibleSteps = walletE2ESteps.filter((step) => {
    if (role === "buyer") return step.role === "Buyer";
    if (role === "seller") return step.role === "Seller";
    return true;
  });

  return (
    <section className="wallet-e2e-card">
      <div>
        <p className="eyebrow">Browser-wallet E2E</p>
        <h3>{walletChecklistTitle(role, currentAction)}</h3>
      </div>
      <div className="wallet-e2e-steps">
        {visibleSteps.map((step) => {
          const expected = signerAddressForAction(step.action, paylink);
          const state = walletE2EStepState(paylink.status, step.action);
          const roleMatchesPage = role === signerRoleForAction(step.action);
          const connected = Boolean(
            accountAddress && (expected ? sameSuiAddress(accountAddress, expected) : roleMatchesPage),
          );
          return (
            <div key={step.action} className={`wallet-e2e-step ${state}`}>
              <span>{step.role}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <em>
                Expected: {signerExpectationLabel(step.action, paylink)}
                {state === "current" ? ` / ${connected ? "connected" : "connect this wallet"}` : ""}
              </em>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SponsorReadinessCard({ readiness }: { readiness: SponsorReadiness | null }) {
  const checking = readiness === null;
  const ready = readiness?.ready === true;
  return (
    <section className={`sponsor-readiness-card compact ${checking ? "checking" : ready ? "ready" : "warn"}`}>
      <div className="sponsor-readiness-heading">
        <div>
          <p className="eyebrow">Sponsored gas</p>
          <h3>{checking ? "Checking sponsor" : ready ? "Sponsor pays SUI gas" : "Sponsor not ready"}</h3>
          <p>
            {checking
              ? "Reading the local sponsor health check."
              : ready
              ? "Buyer and seller sign escrow actions; the app sponsor covers network gas."
              : "Sponsored signing is unavailable until the local sponsor setup is fixed."}
          </p>
        </div>
        <strong>{checking ? "checking" : readiness?.balanceMist ? `${readiness.balanceMist} MIST` : "0 MIST"}</strong>
      </div>
      {readiness?.checks.length ? (
        <details className="readiness-details">
          <summary>Technical checks</summary>
          <div className="readiness-checks">
            {readiness.checks.map((check) => (
              <div key={check.name} className={check.ok ? "ok" : "warn"}>
                <span>{check.ok ? "OK" : "TODO"}</span>
                <strong>{check.name}</strong>
                <p>{check.detail}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function DemoSeedPanel({
  paylink,
  running,
  onRun,
}: {
  paylink: Paylink;
  running: boolean;
  onRun: () => void;
}) {
  const remainingActions = mockDemoActionsForStatus(paylink.status);
  const nextAction = remainingActions[0];
  const complete = remainingActions.length === 0 && paylink.status === "released";

  return (
    <section className="demo-panel">
      <div>
        <p className="eyebrow">Demo mode</p>
        <h2>{complete ? "Two-party escrow released" : "Two-party escrow walkthrough"}</h2>
        <p>
          This local demo separates buyer funding, seller delivery, and buyer release. It does not create a wallet
          signature, spend gas, or submit a new Sui transaction.
        </p>
      </div>
      <div className="demo-steps">
        {demoFlowSteps.map((step) => (
          <div key={step.action} className={`demo-step ${demoStepState(paylink.status, step.action)}`}>
            <span>{step.role}</span>
            <strong>{step.title}</strong>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>
      <button className="primary" onClick={onRun} disabled={running || remainingActions.length === 0}>
        {running ? "Running step..." : complete ? "Demo complete" : demoActionLabel(nextAction)}
      </button>
    </section>
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

function PaylinkFacts({ paylink, compact = false }: { paylink: Paylink; compact?: boolean }) {
  return (
    <dl className={`facts ${compact ? "summary-facts" : ""}`}>
      <div>
        <dt>Seller</dt>
        <dd>{paylink.sellerName}</dd>
      </div>
      <div>
        <dt>Seller address</dt>
        <dd>{paylink.sellerAddress || "required before buyer funding"}</dd>
      </div>
      <div>
        <dt>Buyer</dt>
        <dd>{paylink.buyerName ?? "not specified"}</dd>
      </div>
      <div>
        <dt>Buyer address</dt>
        <dd>{paylink.buyerAddress || "recorded from funding wallet"}</dd>
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
        disabled={paylink.status !== "funded" || pendingAction === "refund"}
      >
        {pendingAction === "refund" ? "Refunding..." : "Refund before delivery"}
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

function mockDemoActionsForStatus(status: Paylink["status"]): PaylinkAction[] {
  if (status === "created") {
    return ["fund", "deliver", "release"];
  }
  if (status === "funded") {
    return ["deliver", "release"];
  }
  if (status === "delivered") {
    return ["release"];
  }
  return [];
}

const demoFlowSteps: Array<{
  action: PaylinkAction;
  role: "Buyer" | "Seller";
  title: string;
  detail: string;
}> = [
  {
    action: "fund",
    role: "Buyer",
    title: "Buyer funds escrow",
    detail: "Bob locks 100 mUSDC into escrow before Alice starts delivery.",
  },
  {
    action: "deliver",
    role: "Seller",
    title: "Seller marks delivered",
    detail: "Alice submits delivery proof after finishing the service work.",
  },
  {
    action: "release",
    role: "Buyer",
    title: "Buyer releases funds",
    detail: "Bob confirms delivery and releases funds to Alice plus platform fee.",
  },
];

const walletE2ESteps: Array<{
  action: SponsoredTransactionAction;
  role: "Buyer" | "Seller";
  title: string;
  detail: string;
}> = [
  {
    action: "fund-mock-usdc",
    role: "Buyer",
    title: "Buyer signs fund escrow",
    detail: "Buyer signs the business transaction with a 100 mUSDC coin. Sponsor pays SUI gas.",
  },
  {
    action: "mark-delivered",
    role: "Seller",
    title: "Seller signs delivery",
    detail: "Seller wallet marks the escrow delivered with a proof URI.",
  },
  {
    action: "release",
    role: "Buyer",
    title: "Buyer signs release",
    detail: "Buyer confirms delivery and releases escrow funds.",
  },
];

function demoActionLabel(action?: PaylinkAction): string {
  if (action === "fund") return "Buyer funds escrow";
  if (action === "deliver") return "Seller marks delivered";
  if (action === "release") return "Buyer releases funds";
  return "No demo action";
}

function demoStepState(status: Paylink["status"], action: PaylinkAction): "complete" | "current" | "pending" {
  const completed = completedDemoActions(status);
  if (completed.includes(action)) return "complete";
  if (mockDemoActionsForStatus(status)[0] === action) return "current";
  return "pending";
}

function completedDemoActions(status: Paylink["status"]): PaylinkAction[] {
  if (status === "released") return ["fund", "deliver", "release"];
  if (status === "delivered") return ["fund", "deliver"];
  if (status === "funded") return ["fund"];
  return [];
}

function currentWalletAction(status: Paylink["status"]): SponsoredTransactionAction | undefined {
  if (status === "created") return "fund-mock-usdc";
  if (status === "funded") return "mark-delivered";
  if (status === "delivered") return "release";
  return undefined;
}

function walletE2EStepState(
  status: Paylink["status"],
  action: SponsoredTransactionAction,
): "complete" | "current" | "pending" {
  if (walletE2ECompletedActions(status).includes(action)) return "complete";
  if (currentWalletAction(status) === action) return "current";
  return "pending";
}

function walletE2ECompletedActions(status: Paylink["status"]): SponsoredTransactionAction[] {
  if (status === "released") return ["fund-mock-usdc", "mark-delivered", "release"];
  if (status === "delivered") return ["fund-mock-usdc", "mark-delivered"];
  if (status === "funded") return ["fund-mock-usdc"];
  return [];
}

function parsePaylinkRoute(pathname: string): PaylinkRoute | null {
  const appPath = normalizedAppPath(pathname);
  const match = appPath.match(/^\/(pay|buyer|seller)\/([^/]+)\/?$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const role = match[1] === "buyer" || match[1] === "seller" ? match[1] : "overview";
  return { role, id: decodeURIComponent(match[2]) };
}

function isDashboardPath(pathname: string): boolean {
  const appPath = normalizedAppPath(pathname);
  return appPath === "/" || appPath === "";
}

function isCreatePath(pathname: string): boolean {
  return normalizedAppPath(pathname) === "/create";
}

function normalizedAppPath(pathname: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
}

function appHref(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.origin)).toString();
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

function signerExpectationLabel(action: SponsoredTransactionAction, paylink: Paylink): string {
  const address = signerAddressForAction(action, paylink);
  if (address) {
    return shortId(address);
  }
  return `open ${signerRoleForAction(action)} wallet`;
}

function sameSuiAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function roleEyebrow(role: PaylinkPageRole): string {
  if (role === "buyer") return "Buyer payment page";
  if (role === "seller") return "Seller delivery page";
  return "Escrow overview";
}

function roleLabel(role: PaylinkPageRole): string {
  if (role === "buyer") return "Buyer flow";
  if (role === "seller") return "Seller flow";
  return "Full flow";
}

function capitalize(value: string): string {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value;
}

function walletChecklistTitle(
  role: PaylinkPageRole,
  currentAction: SponsoredTransactionAction | undefined,
): string {
  if (!currentAction) return "Wallet flow complete";
  if (role === "buyer") return signerRoleForAction(currentAction) === "buyer" ? "Buyer action required" : "Waiting for seller";
  if (role === "seller") return signerRoleForAction(currentAction) === "seller" ? "Seller action required" : "Waiting for buyer";
  return "Next wallet signature required";
}

function actionInstructionForRole(
  role: PaylinkPageRole,
  paylink: Paylink,
): { title: string; detail: string } {
  const status = paylink.status;
  if (role === "buyer") {
    if (status === "created") {
      if (!paylink.sellerAddress) {
        return {
          title: "Seller receiving address is missing.",
          detail: "Create the order with the seller wallet address first. No seller account setup is needed.",
        };
      }
      return {
        title: "Connect Buyer wallet, mint test mUSDC, then fund escrow.",
        detail: "The connected wallet becomes the buyer when funding succeeds. Sponsor pays the SUI gas.",
      };
    }
    if (status === "funded") {
      return {
        title: "Buyer is waiting for Seller delivery.",
        detail: "Buyer can still cancel before delivery, but refund closes after Seller marks delivered.",
      };
    }
    if (status === "delivered") {
      return {
        title: "Buyer reviews delivery and releases funds.",
        detail: "Automatic refund is closed after delivery. Problems move to an off-chain dispute path in this MVP.",
      };
    }
    return {
      title: "Buyer flow is complete.",
      detail: "Use Receipt and Sponsored requests below as evidence.",
    };
  }
  if (role === "seller") {
    if (status === "created") {
      if (!paylink.sellerAddress) {
        return {
          title: "Seller receiving address is missing.",
          detail: "Buyer must create the order with the seller wallet address before funding escrow.",
        };
      }
      return {
        title: "Seller is waiting for Buyer funding.",
        detail: "No seller login is required here. The seller only signs delivery after funds are escrowed.",
      };
    }
    if (status === "funded") {
      return {
        title: "Connect Seller wallet and sign delivery.",
        detail: "This marks the escrow delivered with a proof URI. Sponsor pays gas.",
      };
    }
    if (status === "delivered") {
      return {
        title: "Seller delivery is complete.",
        detail: "Switch to Buyer page so the buyer can release funds.",
      };
    }
    return {
      title: "Seller flow is complete.",
      detail: "Use Receipt and Sponsored requests below as evidence.",
    };
  }
  return {
    title: "Overview shows both parties.",
    detail: "Use Buyer and Seller pages for clean recording, and keep this page for receipt/history.",
  };
}

function mintMockUsdcCommand(config: AppConfig | null, paylink: Paylink): string {
  const token = config?.supportedTokens.find((item) => item.symbol === paylink.token) ?? config?.supportedTokens[0];
  const units = token ? amountToBaseUnits(paylink.amount, token.decimals) : "100000000";
  const packageValue = config?.packageId ?? "<package-id>";
  const treasuryCap = config?.mockUsdcTreasuryCapId ?? "<mock-usdc-treasury-cap-id>";
  const buyer = paylink.buyerAddress ?? "<buyer-address>";
  return `sui client call --package ${packageValue} --module mock_usdc --function mint --args ${treasuryCap} ${units} ${buyer} --gas-budget 10000000 --json`;
}

function explorerUrl(digest: string, network: AppConfig["network"]): string {
  return `https://suiexplorer.com/txblock/${digest}?network=${network}`;
}

function explorerObjectUrl(objectId: string, network: AppConfig["network"]): string {
  return `https://suiexplorer.com/object/${objectId}?network=${network}`;
}

function demoPaylinkHref(): string {
  return new URL("pay/demo-ai-workflow", new URL(import.meta.env.BASE_URL, window.location.origin)).toString();
}

function paylinkHref(id: string, role: PaylinkPageRole): string {
  const segment = role === "buyer" ? "buyer" : role === "seller" ? "seller" : "pay";
  return new URL(`${segment}/${encodeURIComponent(id)}`, new URL(import.meta.env.BASE_URL, window.location.origin)).toString();
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
