import { db } from "@/data/db";

export async function GET() {
  try {
    await db()`select 1`;
    return Response.json({ ok: true, db: true });
  } catch (error) {
    // Code only: a driver error message can carry the connection string.
    const code = (error as { code?: string }).code ?? "unknown";
    console.error({ event: "health_check_failed", code });
    return Response.json({ ok: false, db: false }, { status: 503 });
  }
}
