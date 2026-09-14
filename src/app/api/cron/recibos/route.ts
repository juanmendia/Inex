import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePeriodReceipts } from "@/lib/generate-receipts";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = prev.getMonth() + 1;
  const db = createAdminClient();
  const { data: tenants } = await db.from("tenants").select("id").eq("status", "active");
  let made = 0;
  for (const t of tenants ?? []) {
    made += await generatePeriodReceipts({ tenantId: t.id, userId: null, year, month });
  }
  return NextResponse.json({ ok: true, year, month, made });
}
