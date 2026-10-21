// Thin wrapper around the PayMongo Payment Intent + Payment Method APIs
// (https://docs.paymongo.com/reference), with a MOCK fallback so the app
// stays fully demoable without a real PayMongo sandbox account.
//
// Verified against PayMongo's public docs on 2026-08-16:
//   - Create Payment Intent:  https://docs.paymongo.com/reference/create-a-paymentintent
//   - Attach to Intent:       https://docs.paymongo.com/reference/attach-to-paymentintent
//   - Create Payment Method:  https://docs.paymongo.com/reference/create-a-paymentmethod
//   - Webhooks:               https://docs.paymongo.com/docs/developer-tools-webhooks-key-concepts
// The webhook signature scheme in particular could not be confirmed from a
// live worked example — re-check it against current docs before going live
// (see the comment on verifyWebhookSignature below).

import crypto from "node:crypto";
import type { PaymentMethodType } from "@/lib/types";

const API_BASE = "https://api.paymongo.com/v1";

/** True if real PayMongo API keys are set — otherwise the app uses the mock payment flow everywhere. */
export function isPaymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY && process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY);
}

// PayMongo uses HTTP Basic auth with the API key as the username and an
// empty password.
function authHeader(key: string): string {
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// Shared fetch wrapper for every PayMongo API call below — handles auth headers and turns error responses into thrown Errors.
async function paymongoFetch<T>(
  path: string,
  key: string,
  init: { method: "GET" | "POST"; body?: unknown }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(key),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    const message = json?.errors?.[0]?.detail ?? `PayMongo request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

export type Billing = {
  name: string;
  email: string;
  phone: string;
};

export type CardDetails = {
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
};

export type IntentResult = {
  id: string;
  clientKey: string;
  status: string;
  isMock: boolean;
};

export type AttachResult = {
  status: string;
  /** Present when the customer must be redirected to authorize the payment (GCash, Maya, 3DS). */
  nextActionRedirectUrl: string | null;
  lastPaymentError: string | null;
};

/** Creates a Payment Intent for the given amount, or a mock equivalent if no API keys are configured. */
export async function createPaymentIntent(params: {
  amountCentavos: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<IntentResult> {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;

  if (!secretKey) {
    return {
      id: `pi_mock_${cryptoRandomId()}`,
      clientKey: `pi_mock_${cryptoRandomId()}_client`,
      status: "awaiting_payment_method",
      isMock: true,
    };
  }

  const json = await paymongoFetch<{
    data: { id: string; attributes: { client_key: string; status: string } };
  }>("/payment_intents", secretKey, {
    method: "POST",
    body: {
      data: {
        attributes: {
          amount: params.amountCentavos,
          currency: "PHP",
          payment_method_allowed: ["card", "gcash", "paymaya"],
          payment_method_options: { card: { request_three_d_secure: "any" } },
          description: params.description,
          metadata: params.metadata,
        },
      },
    },
  });

  return {
    id: json.data.id,
    clientKey: json.data.attributes.client_key,
    status: json.data.attributes.status,
    isMock: false,
  };
}

/** Creates a Payment Method (uses the PUBLIC key, per PayMongo's convention). */
export async function createPaymentMethod(params: {
  type: PaymentMethodType;
  billing: Billing;
  card?: CardDetails;
}): Promise<{ id: string; isMock: boolean }> {
  const publicKey = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY;

  if (!publicKey) {
    return { id: `pm_mock_${cryptoRandomId()}`, isMock: true };
  }

  const json = await paymongoFetch<{ data: { id: string } }>("/payment_methods", publicKey, {
    method: "POST",
    body: {
      data: {
        attributes: {
          type: params.type,
          billing: {
            name: params.billing.name,
            email: params.billing.email,
            phone: params.billing.phone,
          },
          ...(params.card
            ? {
                details: {
                  card_number: params.card.cardNumber,
                  exp_month: params.card.expMonth,
                  exp_year: params.card.expYear,
                  cvc: params.card.cvc,
                },
              }
            : {}),
        },
      },
    },
  });

  return { id: json.data.id, isMock: false };
}

/** Attaches a Payment Method to a Payment Intent, kicking off the actual charge attempt. */
export async function attachPaymentMethod(params: {
  intentId: string;
  paymentMethodId: string;
  returnUrl: string;
  isMock: boolean;
}): Promise<AttachResult> {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;

  if (params.isMock || !secretKey) {
    // Mock mode never talks to PayMongo — the calling route sends the user
    // to our own /checkout/[orderId]/mock-gateway simulation instead.
    return { status: "awaiting_next_action", nextActionRedirectUrl: null, lastPaymentError: null };
  }

  const json = await paymongoFetch<{
    data: {
      attributes: {
        status: string;
        next_action: { type: string; redirect?: { url: string } } | null;
        last_payment_error: { detail?: string } | null;
      };
    };
  }>(`/payment_intents/${params.intentId}/attach`, secretKey, {
    method: "POST",
    body: {
      data: {
        attributes: {
          payment_method: params.paymentMethodId,
          return_url: params.returnUrl,
        },
      },
    },
  });

  return {
    status: json.data.attributes.status,
    nextActionRedirectUrl: json.data.attributes.next_action?.redirect?.url ?? null,
    lastPaymentError: json.data.attributes.last_payment_error?.detail ?? null,
  };
}

/** Retrieves the current status of a real (non-mock) Payment Intent — used as a webhook fallback. */
export async function retrievePaymentIntentStatus(intentId: string): Promise<string | null> {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) return null;

  const json = await paymongoFetch<{ data: { attributes: { status: string } } }>(
    `/payment_intents/${intentId}`,
    secretKey,
    { method: "GET" }
  );
  return json.data.attributes.status;
}

/**
 * Verifies the `Paymongo-Signature` header on an incoming webhook request.
 *
 * PayMongo's docs confirm the header name and that it's an HMAC-SHA256 of
 * the request over a per-endpoint secret, but a live worked example of the
 * exact signed string could not be confirmed while writing this. This
 * function defensively supports two known-plausible schemes:
 *   1. Stripe-style `t=<timestamp>,te=<test_sig>,li=<live_sig>` header,
 *      signing `${timestamp}.${rawBody}`.
 *   2. A plain hex HMAC-SHA256 of the raw body, sent as the whole header.
 * Before going live, re-verify this against PayMongo's current docs
 * (https://docs.paymongo.com/docs/developer-tools-best-practices) or a
 * captured real webhook request, and simplify to the one true scheme.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const hmacHex = (payload: string) => crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const safeEqual = (a: string, b: string) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  if (signatureHeader.includes("=") && signatureHeader.includes(",")) {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((kv) => kv.split("=") as [string, string])
    );
    const timestamp = parts.t;
    const testSig = parts.te;
    if (!timestamp || !testSig) return false;
    return safeEqual(hmacHex(`${timestamp}.${rawBody}`), testSig);
  }

  return safeEqual(hmacHex(rawBody), signatureHeader);
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
