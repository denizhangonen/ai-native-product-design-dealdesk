import { z } from "zod";
import { getConfig } from "@/config";
import { db } from "@/data/db";
import { appendEvent } from "@/data/events";
import { insertRequest, updateStatus } from "@/data/requests";
import { InvalidRequestInput } from "@/domain/errors";
import type { DeadlineRequest } from "@/domain/request";
import { type RoutingDecision, decideRoute } from "@/domain/rules";
import { transition } from "@/domain/status";

const inputSchema = z.object({
  requester: z.object({
    slackUserId: z.string().min(1),
    displayName: z.string().min(1),
  }),
  supplier: z.string().min(1).max(200),
  event: z.string().min(1).max(100),
  extensionDays: z.number().int().min(1).max(365),
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
  request: DeadlineRequest;
  routing: RoutingDecision;
};

export async function submitRequest(input: SubmitRequestInput): Promise<SubmitRequestResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    // Paths only: the values themselves may be supplier data.
    const paths = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new InvalidRequestInput(paths);
  }

  const maxAutoDays = getConfig().AUTO_APPROVE_MAX_DAYS;
  const routing = decideRoute({ extensionDays: parsed.data.extensionDays }, maxAutoDays);
  const event = routing.route === "lead" ? "submitted" : "auto_approved";

  const request = await db().begin(async (tx) => {
    const created = await insertRequest({ ...parsed.data, status: "pending_review" }, tx);

    await appendEvent(
      {
        requestId: created.id,
        type: "created",
        actor: created.requester.slackUserId,
        payload: {
          supplier: created.supplier,
          event: created.event,
          extensionDays: created.extensionDays,
          confidence: created.reading?.confidence ?? null,
        },
      },
      tx,
    );

    const status = transition(created.status, event);
    const routed = await updateStatus(
      created.id,
      status,
      routing.route === "lead" ? "sourcing_lead" : null,
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
