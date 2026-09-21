import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/files";
import { ManualAttendanceForm } from "./manual-form";
import { StaffViaticForm } from "@/app/empleado/fichaje/viatic-form";
import { AttendanceBoard, type AttendancePunch } from "./attendance-board";
import { isPunchOut } from "@/lib/attendance";
import { closeStaleOpenIns } from "@/modules/attendance/actions";

function named(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && typeof v === "object" && "name" in v) return String((v as { name: string }).name);
  return null;
}

function empName(raw: unknown) {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && typeof v === "object" && "last_name" in v && "first_name" in v) {
    const e = v as { first_name: string; last_name: string; employee_number?: string };
    const nom = `${e.last_name}, ${e.first_name}`;
    return { nom, search: `${e.employee_number ?? ""} ${e.last_name} ${e.first_name}` };
  }
  return { nom: "Empleado", search: "" };
}

export default async function AsistenciaRrhh({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const s = await requireStaff();
  await closeStaleOpenIns({ tenantId: s.tenantId! });
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  const db = createAdminClient();
  const fromDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDay = new Date(year, month, 0).toISOString().slice(0, 10);
  const peopleQ = db
    .from("employees")
    .select("id, first_name, last_name, employee_number")
    .eq("tenant_id", s.tenantId!)
    .eq("status", "active")
    .order("last_name");
  const countQ = db.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", s.tenantId!).eq("status", "active");
  const full = await db
    .from("attendance_records")
    .select(
      "id, recorded_at, method, punch_type, employee_id, latitude, longitude, distance_meters, photo_path, work_locations(name), employees(first_name, last_name, employee_number)",
    )
    .eq("tenant_id", s.tenantId!)
    .gte("recorded_at", from.toISOString())
    .lt("recorded_at", to.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(2500);
  const [{ data: records }, { data: people }, { count: emps }, { data: viaticRows }] = await Promise.all([
    full.error
      ? db
          .from("attendance_records")
          .select("id, recorded_at, method, punch_type, employee_id, work_locations(name), employees(first_name, last_name, employee_number)")
          .eq("tenant_id", s.tenantId!)
          .gte("recorded_at", from.toISOString())
          .lt("recorded_at", to.toISOString())
          .order("recorded_at", { ascending: false })
          .limit(2500)
      : Promise.resolve(full),
    peopleQ,
    countQ,
    db.from("viatic_days").select("employee_id, day").eq("tenant_id", s.tenantId!).gte("day", fromDay).lte("day", toDay),
  ]);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const unique = new Set((records ?? []).filter((r) => new Date(r.recorded_at) >= dayStart).map((r) => r.employee_id));

  const photos = new Map<string, string>();
  await Promise.all(
    (records ?? []).slice(0, 80).map(async (r) => {
      const path = (r as { photo_path?: string | null }).photo_path;
      if (!path) return;
      try {
        photos.set(r.id, await signedUrl(path));
      } catch {
        /* ponytail: si el storage falla, igual se ve el turno */
      }
    }),
  );

  const punches: AttendancePunch[] = (records ?? []).map((r) => {
    const e = empName(r.employees);
    return {
      id: r.id,
      employeeId: r.employee_id,
      name: e.nom,
      search: e.search,
      at: r.recorded_at,
      out: isPunchOut(r),
      missingOut: String((r as { method?: string }).method ?? "") === "missing_out",
      scheduledOut: String((r as { method?: string }).method ?? "") === "scheduled_out",
      branch: named(r.work_locations),
      photo: photos.get(r.id) ?? null,
      meters: (r as { distance_meters?: number | null }).distance_meters ?? null,
    };
  });

  return (
    <Shell area="rrhh" title="Asistencia" session={s}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Activos
          </p>
          <p className="text-2xl font-semibold">{emps ?? 0}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Ficharon hoy
          </p>
          <p className="text-2xl font-semibold">{unique.size}</p>
        </div>
        <div className="panel p-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Fichajes del mes
          </p>
          <p className="text-2xl font-semibold">{records?.length ?? 0}</p>
        </div>
      </div>

      <ManualAttendanceForm employees={people ?? []} />
      <StaffViaticForm employees={people ?? []} />
      <AttendanceBoard
        punches={punches}
        employees={people ?? []}
        year={year}
        month={month}
        viatics={(viaticRows ?? []).map((v) => {
          const p = (people ?? []).find((e) => e.id === v.employee_id);
          const name = p ? `${p.last_name}, ${p.first_name}` : "Empleado";
          return { employeeId: v.employee_id, date: String(v.day).slice(0, 10), name };
        })}
      />
    </Shell>
  );
}
