"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Asks the server again while something is still moving, and stops once nothing is.
 * An idle tab left open overnight must not keep querying the database forever.
 */
export function AutoRefresh({ everySeconds, active }: { everySeconds: number; active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => router.refresh(), everySeconds * 1000);
    return () => clearInterval(timer);
  }, [active, everySeconds, router]);

  return null;
}
