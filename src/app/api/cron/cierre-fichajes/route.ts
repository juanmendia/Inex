import { NextResponse } from "next/server";
import { closeStaleOpenIns } from "@/modules/attendance/actions";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const closed = await closeStaleOpenIns();
  return NextResponse.json({ ok: true, closed });
}
