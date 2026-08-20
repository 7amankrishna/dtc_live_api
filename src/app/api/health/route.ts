import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  console.log('DATABASE_URL:', databaseUrl);
  // Mask the password in the response for safety
  const masked = databaseUrl?.replace(/:[^:@]+@/, ':****@') ?? 'undefined';
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, databaseUrl: masked });
  } catch (err) {
    console.error('Database error:', err);
    return Response.json({ ok: false, error: err.message, databaseUrl: masked }, { status: 500 });
  }
}
