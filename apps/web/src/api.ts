import type {
  AppConfig,
  BuildSponsoredTransactionInput,
  CreatePaylinkInput,
  LocalJudgeActionResult,
  LocalJudgePaylinkResult,
  MintTestMockUsdcInput,
  MintTestMockUsdcResult,
  Paylink,
  ReceiptSummary,
  SponsorReadiness,
  SponsoredTransactionRecord,
} from "@suipaylink/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
export const STATIC_DEMO_ENABLED = import.meta.env.VITE_STATIC_DEMO === "true";
const STATIC_STORE_KEY = "suipaylink.static.paylinks.v1";
const PACKAGE_ID = "0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7";
const MOCK_USDC_COIN_TYPE = `${PACKAGE_ID}::mock_usdc::MOCK_USDC`;

export async function getConfig(): Promise<AppConfig> {
  if (STATIC_DEMO_ENABLED) {
    return staticConfig();
  }
  return request("/api/config");
}

export async function getSponsorReadiness(): Promise<SponsorReadiness> {
  if (STATIC_DEMO_ENABLED) {
    return {
      ready: false,
      network: "testnet",
      sponsorEnabled: false,
      requiredBalanceMist: "100000000",
      packageId: PACKAGE_ID,
      mockUsdcCoinType: MOCK_USDC_COIN_TYPE,
      checks: [
        {
          name: "Static demo",
          ok: false,
          detail: "Static demo cannot sign or submit sponsored transactions",
        },
      ],
    };
  }
  return request("/api/sponsor/readiness");
}

export async function listPaylinks(): Promise<Paylink[]> {
  if (STATIC_DEMO_ENABLED) {
    return loadStaticPaylinks();
  }
  return request("/api/paylinks");
}

export async function getPaylink(id: string): Promise<Paylink> {
  if (STATIC_DEMO_ENABLED) {
    const paylink = loadStaticPaylinks().find((item) => item.id === id);
    if (!paylink) {
      throw new Error("Static demo Paylink not found");
    }
    return paylink;
  }
  return request(`/api/paylinks/${id}`);
}

export async function createPaylink(input: CreatePaylinkInput): Promise<Paylink> {
  if (STATIC_DEMO_ENABLED) {
    const timestamp = new Date().toISOString();
    const id = staticId();
    const paylink: Paylink = {
      ...input,
      id,
      status: "created",
      publicUrl: staticPaylinkUrl(id),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const paylinks = [paylink, ...loadStaticPaylinks()];
    saveStaticPaylinks(paylinks);
    return paylink;
  }
  return request("/api/paylinks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createLocalJudgePaylink(): Promise<LocalJudgePaylinkResult> {
  if (STATIC_DEMO_ENABLED) {
    throw new Error("Static demo mode cannot create a Local Judge Paylink.");
  }
  return request("/api/local-judge/paylinks", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function mutatePaylink(
  id: string,
  action: "fund" | "deliver" | "release" | "refund",
  body: Record<string, unknown> = {},
): Promise<Paylink> {
  if (STATIC_DEMO_ENABLED) {
    const paylinks = loadStaticPaylinks();
    const index = paylinks.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error("Static demo Paylink not found");
    }
    const next = mutateStaticPaylink(paylinks[index], action, body);
    paylinks[index] = next;
    saveStaticPaylinks(paylinks);
    return next;
  }
  return request(`/api/paylinks/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getReceipt(id: string): Promise<ReceiptSummary> {
  if (STATIC_DEMO_ENABLED) {
    return staticReceipt(await getPaylink(id));
  }
  return request(`/api/paylinks/${id}/receipt`);
}

export async function syncPaylinkChain(id: string): Promise<ReceiptSummary> {
  if (STATIC_DEMO_ENABLED) {
    return staticReceipt(await getPaylink(id));
  }
  return request(`/api/paylinks/${id}/sync-chain`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function buildSponsoredTransaction(
  input: BuildSponsoredTransactionInput,
): Promise<SponsoredTransactionRecord> {
  if (STATIC_DEMO_ENABLED) {
    throw new Error(
      `Static demo mode cannot build sponsored transactions for ${input.action}; run the API with SPONSOR_PRIVATE_KEY for real wallet signing.`,
    );
  }
  return request("/api/sponsored-transactions/build", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSponsoredTransaction(id: string): Promise<SponsoredTransactionRecord> {
  if (STATIC_DEMO_ENABLED) {
    throw new Error(`Static demo mode has no sponsored transaction ${id}`);
  }
  return request(`/api/sponsored-transactions/${id}`);
}

export async function listSponsoredTransactions(paylinkId?: string): Promise<SponsoredTransactionRecord[]> {
  if (STATIC_DEMO_ENABLED) {
    void paylinkId;
    return [];
  }
  const query = paylinkId ? `?paylinkId=${encodeURIComponent(paylinkId)}` : "";
  return request(`/api/sponsored-transactions${query}`);
}

export async function submitSponsoredTransaction(
  id: string,
  userSignature: string,
  transactionBytes?: string,
): Promise<SponsoredTransactionRecord> {
  if (STATIC_DEMO_ENABLED) {
    void userSignature;
    void transactionBytes;
    throw new Error(`Static demo mode cannot submit sponsored transaction ${id}`);
  }
  return request(`/api/sponsored-transactions/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ userSignature, transactionBytes }),
  });
}

export async function runLocalJudgePaylinkStep(
  id: string,
  action?: BuildSponsoredTransactionInput["action"],
): Promise<LocalJudgeActionResult> {
  if (STATIC_DEMO_ENABLED) {
    throw new Error("Static demo mode cannot run Local Judge transactions.");
  }
  return request(`/api/local-judge/paylinks/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function mintTestMockUsdc(input: MintTestMockUsdcInput): Promise<MintTestMockUsdcResult> {
  if (STATIC_DEMO_ENABLED) {
    throw new Error("Static demo mode cannot mint test mUSDC; run the API with MOCK_USDC_MINTER_PRIVATE_KEY.");
  }
  return request("/api/mock-usdc/mint", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
      ...init,
    });
  } catch (error) {
    throw new Error(friendlyNetworkError(path, error));
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(friendlyApiError(path, response.status, data));
  }
  return data as T;
}

function friendlyApiError(path: string, status: number, data: unknown): string {
  const payload = data as { code?: string; error?: unknown };
  const rawError = typeof payload.error === "string" ? payload.error : payload.error ? JSON.stringify(payload.error) : "";
  if (path === "/api/mock-usdc/mint" && (payload.code === "sui_rpc_error" || /fetch failed/i.test(rawError))) {
    return "Testnet mUSDC mint failed because the Sui RPC request failed. Retry once; if it still fails, use the CLI fallback command shown on the page.";
  }
  if (payload.code === "sui_rpc_error" || /fetch failed/i.test(rawError)) {
    return "Sui Testnet RPC request failed. Retry after a few seconds; if it repeats, keep the page open and use the latest receipt/history after the network recovers.";
  }
  return rawError || `Request failed with HTTP ${status}`;
}

function friendlyNetworkError(path: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (path === "/api/mock-usdc/mint") {
    return `Could not reach the local API while minting test mUSDC: ${detail}`;
  }
  return `Could not reach the local API: ${detail}`;
}

function staticConfig(): AppConfig {
  return {
    network: "testnet",
    publicBaseUrl: staticPublicBaseUrl(),
    sponsorMode: "mock",
    sponsorEnabled: false,
    packageId: PACKAGE_ID,
    mockUsdcTreasuryCapId: "0xd4a31feca435942ec4d402781ed9102b97e23823b8f23a5c32722851ea740c76",
    mockUsdcMintEnabled: false,
    mockUsdcMintAmountUnits: "100000000",
    feeReceiverAddress: "0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef",
    sponsoredActions: ["fund-mock-usdc", "mark-delivered", "release", "refund"],
    supportedTokens: [
      {
        symbol: "mUSDC",
        displayName: "SuiPayLink Mock USDC",
        coinType: MOCK_USDC_COIN_TYPE,
        decimals: 6,
        gaslessEligible: false,
        testnetOnly: true,
      },
    ],
  };
}

function loadStaticPaylinks(): Paylink[] {
  const seed = staticSeedPaylink();
  const stored = readStoredPaylinks();
  const withSeed = stored.some((paylink) => paylink.id === seed.id) ? stored : [seed, ...stored];
  return withSeed.map((paylink) => ({
    ...paylink,
    publicUrl: staticPaylinkUrl(paylink.id),
  }));
}

function readStoredPaylinks(): Paylink[] {
  try {
    const raw = window.localStorage.getItem(STATIC_STORE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStoredPaylink);
  } catch {
    return [];
  }
}

function saveStaticPaylinks(paylinks: Paylink[]) {
  window.localStorage.setItem(STATIC_STORE_KEY, JSON.stringify(paylinks));
}

function staticSeedPaylink(): Paylink {
  const timestamp = "2026-06-12T00:00:00.000Z";
  return {
    id: "demo-ai-workflow",
    mode: "escrow",
    sellerName: "Alice AI Automation Studio",
    sellerAddress: "0x648badce46f20a771d805670901239e868f5d0c7e297a3616b579075a800f9f5",
    buyerName: "Buyer / initiator",
    buyerAddress: "",
    amount: "100",
    token: "mUSDC",
    memo: "AI automation workflow setup - 48 hour delivery escrow",
    feeBps: 100,
    status: "created",
    demoSeed: true,
    publicUrl: staticPaylinkUrl("demo-ai-workflow"),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mutateStaticPaylink(
  paylink: Paylink,
  action: "fund" | "deliver" | "release" | "refund",
  body: Record<string, unknown>,
): Paylink {
  const timestamp = new Date().toISOString();
  if (action === "fund") {
    if (paylink.status !== "created") {
      throw new Error(`Cannot fund in status ${paylink.status}`);
    }
    return {
      ...paylink,
      status: "funded",
      escrowObjectId: `mock-escrow-${paylink.id}`,
      fundedAt: timestamp,
      updatedAt: timestamp,
    };
  }
  if (action === "deliver") {
    if (paylink.status !== "funded") {
      throw new Error(`Cannot mark delivered in status ${paylink.status}`);
    }
    return {
      ...paylink,
      status: "delivered",
      deliveryProofUri: typeof body.deliveryProofUri === "string" ? body.deliveryProofUri : paylink.deliveryProofUri,
      deliveredAt: timestamp,
      updatedAt: timestamp,
    };
  }
  if (action === "release") {
    if (paylink.status !== "delivered") {
      throw new Error(`Cannot release in status ${paylink.status}`);
    }
    return {
      ...paylink,
      status: "released",
      releasedAt: timestamp,
      updatedAt: timestamp,
    };
  }
  if (paylink.status !== "funded") {
    throw new Error(`Cannot refund in status ${paylink.status}`);
  }
  return {
    ...paylink,
    status: "refunded",
    refundedAt: timestamp,
    updatedAt: timestamp,
  };
}

function staticReceipt(paylink: Paylink): ReceiptSummary {
  const amount = Number(paylink.amount);
  const platformFee = paylink.mode === "escrow" ? amount * (paylink.feeBps / 10000) : 0;
  const sellerAmount = amount - platformFee;
  return {
    paylink,
    platformFee: formatStaticAmount(platformFee),
    sellerAmount: formatStaticAmount(sellerAmount),
    chain: {
      status: "not_available",
      syncedAt: new Date().toISOString(),
      network: "testnet",
      digests: [],
      events: [],
      errors: ["Static demo mode: no Sui transaction was submitted."],
    },
    timeline: [
      staticTimelineItem("Created", paylink.status, ["created", "funded", "delivered", "released", "refunded"], paylink.createdAt),
      staticTimelineItem("Funded", paylink.status, ["funded", "delivered", "released", "refunded"], paylink.fundedAt),
      staticTimelineItem("Delivered", paylink.status, ["delivered", "released"], paylink.deliveredAt),
      staticTimelineItem(
        paylink.status === "refunded" ? "Refunded" : "Released",
        paylink.status,
        ["released", "refunded"],
        paylink.status === "refunded" ? paylink.refundedAt : paylink.releasedAt,
      ),
    ],
  };
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function staticTimelineItem(
  label: string,
  currentStatus: Paylink["status"],
  completeStatuses: Paylink["status"][],
  timestamp?: string,
) {
  const status = completeStatuses.includes(currentStatus)
    ? "complete"
    : currentStatus === "created" && label === "Created"
      ? "current"
      : "pending";
  return { label, status, timestamp } as const;
}

function staticId(): string {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
  return `demo-${suffix}`;
}

function staticPublicBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString().replace(/\/$/, "");
}

function staticPaylinkUrl(id: string): string {
  const base = `${staticPublicBaseUrl()}/`;
  return new URL(`pay/${encodeURIComponent(id)}`, base).toString();
}

function formatStaticAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function isStoredPaylink(value: unknown): value is Paylink {
  const candidate = value as Partial<Paylink>;
  return Boolean(
    candidate &&
      typeof candidate.id === "string" &&
      typeof candidate.mode === "string" &&
      typeof candidate.status === "string" &&
      typeof candidate.sellerName === "string" &&
      typeof candidate.sellerAddress === "string" &&
      typeof candidate.amount === "string" &&
      typeof candidate.token === "string" &&
      typeof candidate.memo === "string" &&
      typeof candidate.createdAt === "string" &&
      typeof candidate.updatedAt === "string",
  );
}
