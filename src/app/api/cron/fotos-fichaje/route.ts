import { NextResponse } from "next/server";
import { purgeOldPunchPhotos } from "@/modules/attendance/actions";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const removed = await purgeOldPunchPhotos();
  return NextResponse.json({ ok: true, removed });
}
