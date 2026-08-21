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
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Dealdesk</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Discount approvals that happen in Slack and email. This page only watches.
        </p>
      </header>
      <RequestTable requests={requests} />
      <AutoRefresh everySeconds={5} active={requests.some((request) => !isFinal(request.status))} />
    </main>
  );
}
