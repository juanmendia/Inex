import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data } = await db
    .from("receipts")
    .select("period_year, period_month, kind, status, employees(last_name, first_name, employee_number)")
    .eq("tenant_id", s.tenantId!);

  const lines = ["legajo,apellido,nombre,periodo,tipo,estado"];
  for (const r of data ?? []) {
    const emp = r.employees as { last_name: string; first_name: string; employee_number: string } | { last_name: string; first_name: string; employee_number: string }[] | null;
    const e = Array.isArray(emp) ? emp[0] : emp;
    lines.push(
      [e?.employee_number, e?.last_name, e?.first_name, `${r.period_month}/${r.period_year}`, r.kind, r.status]
        .map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`)
        .join(","),
    );
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=recibos.csv",
    },
  });
}
