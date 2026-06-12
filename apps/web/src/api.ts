import type {
  AppConfig,
  BuildSponsoredTransactionInput,
  CreatePaylinkInput,
  Paylink,
  ReceiptSummary,
  SponsoredTransactionRecord,
} from "@suipaylink/shared";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8787";

export async function getConfig(): Promise<AppConfig> {
  return request("/api/config");
}

export async function listPaylinks(): Promise<Paylink[]> {
  return request("/api/paylinks");
}

export async function getPaylink(id: string): Promise<Paylink> {
  return request(`/api/paylinks/${id}`);
}

export async function createPaylink(input: CreatePaylinkInput): Promise<Paylink> {
  return request("/api/paylinks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function mutatePaylink(
  id: string,
  action: "fund" | "deliver" | "release" | "refund",
  body: Record<string, unknown> = {},
): Promise<Paylink> {
  return request(`/api/paylinks/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getReceipt(id: string): Promise<ReceiptSummary> {
  return request(`/api/paylinks/${id}/receipt`);
}

export async function buildSponsoredTransaction(
  input: BuildSponsoredTransactionInput,
): Promise<SponsoredTransactionRecord> {
  return request("/api/sponsored-transactions/build", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSponsoredTransaction(id: string): Promise<SponsoredTransactionRecord> {
  return request(`/api/sponsored-transactions/${id}`);
}

export async function submitSponsoredTransaction(
  id: string,
  userSignature: string,
): Promise<SponsoredTransactionRecord> {
  return request(`/api/sponsored-transactions/${id}/submit`, {
    method: "POST",
    body: JSON.stringify({ userSignature }),
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ? JSON.stringify(data.error) : "Request failed");
  }
  return data as T;
}
