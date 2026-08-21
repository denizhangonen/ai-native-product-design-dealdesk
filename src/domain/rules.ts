import type { DiscountRequest } from "@/domain/request";

export type Route = "auto" | "finance";

export type RoutingDecision = {
  route: Route;
  reason: string;
};

/**
 * The only place that decides who must approve. The model never decides this.
 */
export function decideRoute(
  request: Pick<DiscountRequest, "discountPercent">,
  thresholdPercent: number,
): RoutingDecision {
  const { discountPercent } = request;

  if (discountPercent > thresholdPercent) {
    return {
      route: "finance",
      reason: `${discountPercent}% is above the ${thresholdPercent}% limit, so finance must approve`,
    };
  }

  return {
    route: "auto",
    reason: `${discountPercent}% is within the ${thresholdPercent}% limit`,
  };
}

export type CounterReading = {
  decision: "approve" | "reject";
  counterPercent: number | null;
};

/**
 * What an approver's counter offer means. A counter at or above what was asked for
 * grants the request; only a lower one refuses it. A model reading English kept
 * calling a more generous offer a rejection, so the judgement lives here instead.
 */
export function decideFromCounter(
  reading: CounterReading,
  requestedPercent: number,
): "approve" | "reject" {
  if (reading.counterPercent !== null && reading.counterPercent >= requestedPercent) {
    return "approve";
  }
  return reading.decision;
}
