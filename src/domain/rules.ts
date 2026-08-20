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
