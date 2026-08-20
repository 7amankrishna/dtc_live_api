import { db } from "@/db";
import { sql } from "drizzle-orm";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Confirm the database is reachable before rendering the dashboard.
  await db.execute(sql`select 1`);

  return (
    <main className="min-h-screen w-full">
      <Dashboard />
    </main>
  );
}
