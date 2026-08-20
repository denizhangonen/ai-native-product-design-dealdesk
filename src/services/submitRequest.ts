import { z } from "zod";
import { getConfig } from "@/config";
import { db } from "@/data/db";
import { appendEvent } from "@/data/events";
import { insertRequest, updateStatus } from "@/data/requests";
import { InvalidRequestInput } from "@/domain/errors";
import type { DiscountRequest } from "@/domain/request";
import { type RoutingDecision, decideRoute } from "@/domain/rules";
import { transition } from "@/domain/status";

const inputSchema = z.object({
  requester: z.object({
    slackUserId: z.string().min(1),
    displayName: z.string().min(1),
  }),
  customer: z.string().min(1).max(200),
  amountCents: z.number().int().nonnegative(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase()),
  discountPercent: z.number().min(0).max(100),
  reason: z.string().max(2000).nullable(),
  reading: z
    .object({
      confidence: z.number().min(0).max(1),
      rationale: z.string().max(200).nullable(),
      model: z.string().min(1).max(100),
    })
    .nullable()
    .default(null),
});

export type SubmitRequestInput = z.input<typeof inputSchema>;

export type SubmitRequestResult = {
  request: DiscountRequest;
  routing: RoutingDecision;
};

export async function submitRequest(input: SubmitRequestInput): Promise<SubmitRequestResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    // Paths only: the values themselves may be customer data.
    const paths = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new InvalidRequestInput(paths);
  }

  const thresholdPercent = getConfig().APPROVAL_THRESHOLD_PERCENT;
  const routing = decideRoute({ discountPercent: parsed.data.discountPercent }, thresholdPercent);
  const event = routing.route === "finance" ? "submitted" : "auto_approved";

  const request = await db().begin(async (tx) => {
    const created = await insertRequest({ ...parsed.data, status: "pending_review" }, tx);

    await appendEvent(
      {
        requestId: created.id,
        type: "created",
        actor: created.requester.slackUserId,
        payload: {
          customer: created.customer,
          discountPercent: created.discountPercent,
          confidence: created.reading?.confidence ?? null,
        },
      },
      tx,
    );

    const status = transition(created.status, event);
    const routed = await updateStatus(
      created.id,
      status,
      routing.route === "finance" ? "finance" : null,
      tx,
    );

    await appendEvent(
      {
        requestId: routed.id,
        type: event,
        actor: "system",
        payload: { ...routing },
      },
      tx,
    );

    return routed;
  });

  console.info({
    event: "request_routed",
    reference: request.reference,
    route: routing.route,
  });
  return { request, routing };
}
