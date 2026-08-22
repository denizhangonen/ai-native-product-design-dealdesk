import type { ReactNode } from "react";
import type { DiscountRequest } from "@/domain/request";
import type { RoutingDecision } from "@/domain/rules";

type PanelProps = {
  title: string;
  footer: string;
  children: ReactNode;
};

function Panel({ title, footer, children }: PanelProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50/50 p-6 dark:border-gray-800 dark:bg-gray-900/40">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
        {title}
      </h3>
      <p className="mt-3 text-base leading-relaxed">{children}</p>
      <p className="mt-4 text-sm text-gray-500">{footer}</p>
    </section>
  );
}

/**
 * The point of the whole system, on one screen: the model reports what it read,
 * and a rule in code decides what happens. Neither panel can do the other's job.
 */
export function HowItWasDecided({
  request,
  routing,
}: {
  request: DiscountRequest;
  routing: RoutingDecision;
}) {
  const reading = request.reading;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Panel
        title="The model read"
        footer={
          reading
            ? `${Math.round(reading.confidence * 100)}% confident · ${reading.model}`
            : "Not recorded for this request"
        }
      >
        {reading?.rationale ?? "No note was returned."}
      </Panel>

      <Panel title="The rule decided" footer="src/domain/rules.ts, a pure function with tests">
        {routing.reason}
      </Panel>
    </div>
  );
}
