import cors from "@fastify/cors";
import Fastify, { type FastifyReply } from "fastify";
import {
  buildSponsoredTransactionSchema,
  createPaylinkSchema,
  mutatePaylinkSchema,
  submitSponsoredTransactionSchema,
} from "@suipaylink/shared";
import { appConfig, port } from "./config.js";
import {
  SponsorError,
  buildSponsoredTransaction,
  getSponsorAddress,
  getSponsoredTransaction,
  listSponsoredTransactions,
  syncPaylinkChainState,
  submitSponsoredTransaction,
} from "./sponsor.js";
import {
  buildReceipt,
  createPaylink,
  fundPaylink,
  getPaylink,
  listPaylinks,
  markDelivered,
  refundPaylink,
  releasePaylink,
} from "./store.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
});

app.get("/health", async () => ({
  ok: true,
  service: "sui-paylink-api",
  sponsorMode: appConfig.sponsorMode,
  sponsorEnabled: appConfig.sponsorEnabled,
}));

app.get("/api/config", async () => ({
  ...appConfig,
  sponsorAddress: safeSponsorAddress(),
}));

app.get("/api/paylinks", async () => listPaylinks());

app.post("/api/paylinks", async (request, reply) => {
  const parsed = createPaylinkSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  return createPaylink(parsed.data);
});

app.get<{ Params: { id: string } }>("/api/paylinks/:id", async (request, reply) => {
  const paylink = getPaylink(request.params.id);
  if (!paylink) {
    return reply.code(404).send({ error: "Paylink not found" });
  }
  return paylink;
});

app.get<{ Params: { id: string } }>("/api/paylinks/:id/receipt", async (request, reply) => {
  try {
    return buildReceipt(request.params.id);
  } catch (error) {
    return reply.code(404).send({ error: errorMessage(error) });
  }
});

app.post<{ Params: { id: string } }>("/api/paylinks/:id/sync-chain", async (request, reply) => {
  try {
    const chain = await syncPaylinkChainState(request.params.id);
    return {
      ...buildReceipt(request.params.id),
      chain,
    };
  } catch (error) {
    if (error instanceof SponsorError) {
      return sendSponsorError(reply, error);
    }
    return reply.code(502).send({ code: "chain_sync_failed", error: errorMessage(error) });
  }
});

app.post<{ Params: { id: string } }>("/api/paylinks/:id/fund", async (request, reply) => {
  const parsed = mutatePaylinkSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  try {
    return fundPaylink(request.params.id);
  } catch (error) {
    return reply.code(400).send({ error: errorMessage(error) });
  }
});

app.post<{ Params: { id: string } }>("/api/paylinks/:id/deliver", async (request, reply) => {
  const parsed = mutatePaylinkSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  try {
    return markDelivered(
      request.params.id,
      parsed.data.deliveryProofUri ?? "https://example.com/delivery-proof",
    );
  } catch (error) {
    return reply.code(400).send({ error: errorMessage(error) });
  }
});

app.post<{ Params: { id: string } }>("/api/paylinks/:id/release", async (request, reply) => {
  const parsed = mutatePaylinkSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  try {
    return releasePaylink(request.params.id);
  } catch (error) {
    return reply.code(400).send({ error: errorMessage(error) });
  }
});

app.post<{ Params: { id: string } }>("/api/paylinks/:id/refund", async (request, reply) => {
  const parsed = mutatePaylinkSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  try {
    return refundPaylink(request.params.id);
  } catch (error) {
    return reply.code(400).send({ error: errorMessage(error) });
  }
});

app.post("/api/sponsored-transactions/build", async (request, reply) => {
  const parsed = buildSponsoredTransactionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  try {
    return await buildSponsoredTransaction(parsed.data);
  } catch (error) {
    return sendSponsorError(reply, error);
  }
});

app.get<{ Querystring: { paylinkId?: string } }>("/api/sponsored-transactions", async (request) => {
  return listSponsoredTransactions(request.query.paylinkId);
});

app.get<{ Params: { id: string } }>("/api/sponsored-transactions/:id", async (request, reply) => {
  try {
    return getSponsoredTransaction(request.params.id);
  } catch (error) {
    return sendSponsorError(reply, error);
  }
});

app.post<{ Params: { id: string } }>("/api/sponsored-transactions/:id/submit", async (request, reply) => {
  const parsed = submitSponsoredTransactionSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }
  try {
    return await submitSponsoredTransaction(request.params.id, parsed.data);
  } catch (error) {
    return sendSponsorError(reply, error);
  }
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(500).send({ error: "Internal server error" });
});

await app.listen({ port, host: "127.0.0.1" });

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function sendSponsorError(reply: FastifyReply, error: unknown) {
  if (error instanceof SponsorError) {
    return reply.code(error.statusCode).send({ code: error.code, error: error.message });
  }
  return reply.code(502).send({ code: "sui_rpc_error", error: errorMessage(error) });
}

function safeSponsorAddress(): string | undefined {
  try {
    return getSponsorAddress();
  } catch {
    return undefined;
  }
}
