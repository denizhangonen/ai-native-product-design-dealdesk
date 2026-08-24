import type { DeadlineRequest } from "@/domain/request";
import { formatExtension } from "@/domain/request";

export type Route = "auto" | "lead";

export type RoutingDecision = {
  route: Route;
  reason: string;
};

/**
 * The only place that decides who must approve. The model never decides this.
 */
export function decideRoute(
  request: Pick<DeadlineRequest, "extensionDays">,
  maxAutoDays: number,
): RoutingDecision {
  const { extensionDays } = request;
  const limit = `${maxAutoDays}-day limit`;

  if (extensionDays > maxAutoDays) {
    return {
      route: "lead",
      reason: `${formatExtension(extensionDays)} is above the ${limit}, so the sourcing lead must approve`,
    };
  }

  return {
    route: "auto",
    reason: `${formatExtension(extensionDays)} is within the ${limit}`,
  };
}

export type CounterReading = {
  decision: "approve" | "reject";
  counterDays: number | null;
};

/**
 * What an approver's counter offer means. A counter at or above what was asked for
 * grants the request; only a shorter one refuses it. A model reading English kept
 * calling a more generous offer a rejection, so the judgement lives here instead.
 */
export function decideFromCounter(
  reading: CounterReading,
  requestedDays: number,
): "approve" | "reject" {
  if (reading.counterDays !== null && reading.counterDays >= requestedDays) {
    return "approve";
  }
  return reading.decision;
}
