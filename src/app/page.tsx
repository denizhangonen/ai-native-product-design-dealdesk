import { AutoRefresh } from "@/components/AutoRefresh";
import { RequestTable } from "@/components/RequestTable";
import { listRecent } from "@/data/requests";
import { isFinal } from "@/domain/status";

// Rebuilt at most every few seconds. The page exists to show state changing, but a
// link that gets shared must not open a database connection per visitor.
export const revalidate = 5;

export default async function Home() {
  const requests = await listRecent(50);

  return (
    <main className="mx-auto max-w-4xl px-6 py-14 sm:px-10">
      <header className="mb-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
          Dealdesk
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Deadline extensions</h1>
        <p className="mt-3 max-w-xl text-base text-gray-600 dark:text-gray-400">
          Approvals run where work happens - Slack and email. This is the read-only window.
        </p>
      </header>
      <RequestTable requests={requests} />
      <AutoRefresh everySeconds={5} active={requests.some((request) => !isFinal(request.status))} />
    </main>
  );
}
