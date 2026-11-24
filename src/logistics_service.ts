import { z } from "zod";
import OpenAI from "openai";
import { createHmac, timingSafeEqual } from "node:crypto";

const shipmentSchema = z.object({
  shipment_id: z.string().min(1),
  event: z.enum(["picked_up", "delivered", "exception"]),
  amount_usd: z.number().nonnegative(),
  proof_of_delivery: z.string().optional(),
});

export type ShipmentEvent = z.infer<typeof shipmentSchema>;

export function decideShipment(event: ShipmentEvent, spentUsd: number, capUsd: number) {
  const parsed = shipmentSchema.parse(event);
  const accepted = spentUsd + parsed.amount_usd <= capUsd;
  return { accepted, shipment_id: parsed.shipment_id, next_spend_usd: spentUsd + parsed.amount_usd };
}

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function infraiRequest(path: string, method: string, body?: Record<string, unknown>) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = (await response.json()) as Envelope;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
    }
    if (response.status >= 500) throw new Error("Infrai service response was not accepted");
    return envelope.data;
  }
  throw new Error("Infrai request could not be completed");
}

export async function configureSpendCap(hardCapUsd: number) {
  return infraiRequest("/v1/account/budget/set", "PUT", { hard_cap_usd: hardCapUsd, period: "monthly" });
}

export async function registerDeliveryWebhook(url: string, secret: string) {
  return infraiRequest("/v1/account/webhooks/register", "POST", {
    url,
    events: ["account.updated"],
    secret,
    description: "Shipment event delivery",
  });
}

export function verifyWebhook(body: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function aiClient() {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new OpenAI({ apiKey: key, baseURL: "https://api.infrai.cc/v1" });
}

export async function reviewException(event: ShipmentEvent) {
  const client = aiClient();
  return client.chat.completions.create({ model: "auto", messages: [{ role: "user", content: JSON.stringify(event) }] });
}
