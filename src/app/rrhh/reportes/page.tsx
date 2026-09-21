import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { baYmd } from "@/lib/attendance";
import { scoreGroup, scorePeople, workdaysUntil } from "@/lib/attendance-report";
import { AttendanceReportView } from "./attendance-report";

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; ids?: string }>;
}) {
  const s = await requireStaff();
  const sp = await searchParams;
  const db = createAdminClient();
  const tid = s.tenantId!;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const fromDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDay = new Date(year, month, 0).toISOString().slice(0, 10);
  const fromIso = new Date(year, month - 1, 1).toISOString();
  const toIso = new Date(year, month, 1).toISOString();
  const today = baYmd();

  const [pending, signed, non, emps, tickets, peopleRes, locRes, agRes, punchRes, offRes, viaticRes] = await Promise.all([
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "pending"),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "signed"),
    db.from("receipts").select("id", { count: "exact", head: true }).eq("tenant_id", tid).eq("status", "non_conforming"),
    db.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tid),
    db.from("hr_tickets").select("id", { count: "exact", head: true }).eq("tenant_id", tid).neq("status", "closed"),
    db
      .from("employees")
      .select("id, first_name, last_name, work_location_id, agreement_id, status")
      .eq("tenant_id", tid)
      .eq("status", "active")
      .order("last_name"),
    db.from("work_locations").select("id, day_start").eq("tenant_id", tid),
    db.from("collective_agreements").select("id, day_start").eq("tenant_id", tid),
    db
      .from("attendance_records")
      .select("employee_id, recorded_at, punch_type, method")
      .eq("tenant_id", tid)
      .gte("recorded_at", fromIso)
      .lt("recorded_at", toIso),
    db
      .from("time_off")
      .select("employee_id, kind, starts_on, ends_on")
      .eq("tenant_id", tid)
      .eq("status", "approved")
      .lte("starts_on", toDay)
      .gte("ends_on", fromDay),
    db
      .from("viatic_days")
      .select("employee_id, day")
      .eq("tenant_id", tid)
      .eq("status", "approved")
      .gte("day", fromDay)
      .lte("day", toDay),
  ]);

  const locStart = new Map((locRes.data ?? []).map((l) => [l.id, l.day_start]));
  const agStart = new Map((agRes.data ?? []).map((a) => [a.id, a.day_start]));
  const people = (peopleRes.data ?? []).map((e) => ({
    id: e.id,
    name: `${e.last_name}, ${e.first_name}`,
    locationStart: e.work_location_id ? locStart.get(e.work_location_id) : null,
    agreementStart: e.agreement_id ? agStart.get(e.agreement_id) : null,
  }));
  const picked = (sp.ids ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const selected = sp.ids === undefined ? people.map((p) => p.id) : picked.filter((id) => people.some((p) => p.id === id));
  const days = workdaysUntil(fromDay, toDay, today);
  const rows = scorePeople({
    people: people.filter((p) => selected.includes(p.id)),
    days,
    punches: punchRes.data ?? [],
    offs: offRes.data ?? [],
    viatics: viaticRes.data ?? [],
  });
  const group = scoreGroup(rows);

  return (
    <Shell area="rrhh" title="Reportes" session={s}>
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["Empleados", emps.count ?? 0],
          ["Pendientes", pending.count ?? 0],
          ["Firmados", signed.count ?? 0],
          ["No conformes", non.count ?? 0],
          ["Consultas abiertas", tickets.count ?? 0],
        ].map(([l, n]) => (
          <div key={String(l)} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <p className="text-sm text-zinc-500">{l}</p>
            <p className="text-2xl font-semibold">{n}</p>
          </div>
        ))}
      </div>
      <a href="/rrhh/reportes/csv" className="mt-6 inline-block rounded-lg bg-[#142236] px-4 py-2 text-sm text-white">
        Descargar CSV de recibos
      </a>

      <AttendanceReportView
        year={year}
        month={month}
        people={people.map(({ id, name }) => ({ id, name }))}
        selected={selected}
        rows={rows}
        group={group}
      />
    </Shell>
  );
}
