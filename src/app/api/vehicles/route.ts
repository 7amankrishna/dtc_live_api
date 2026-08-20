import { NextResponse } from "next/server";
import {
  fetchAndStoreVehiclePositions,
} from "@/lib/otd-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await fetchAndStoreVehiclePositions();
    return NextResponse.json({
      ok: result.ok,
      source: result.source,
      message: result.message,
      count: result.data.length,
      timestamp: result.timestamp ?? new Date().toISOString(),
      vehicles: result.data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message, vehicles: [] },
      { status: 500 }
    );
  }
}
