import { PunchPad } from "@/components/punch-button";
import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";
import Link from "next/link";

function nextPunch(records: { punch_type: string | null; method: string | null }[] | null): "in" | "out" {
  const last = records?.[0];
  if (!last) return "in";
  const out = last.punch_type === "out" || String(last.method ?? "").endsWith(":out");
  return out ? "in" : "out";
}

export default async function EmpleadoHome() {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  const db = createAdminClient();
  const now = new Date();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [{ count: pending }, { data: events }, { data: mates }, { data: settings }, { data: today }] = await Promise.all([
    db
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", me?.id ?? "00000000-0000-0000-0000-000000000000")
      .eq("status", "pending"),
    db
      .from("events")
      .select("id, title, starts_at")
      .eq("tenant_id", s.tenantId!)
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(5),
    db
      .from("employees")
      .select("first_name, last_name, birth_date")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "active"),
    db.from("tenant_settings").select("require_mobile_punch").eq("tenant_id", s.tenantId!).maybeSingle(),
    me
      ? db
          .from("attendance_records")
          .select("punch_type, method, recorded_at")
          .eq("employee_id", me.id)
          .gte("recorded_at", dayStart.toISOString())
          .order("recorded_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ]);

  const hour = now.getHours();
  const saludo = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const month = now.getMonth();
  const day = now.getDate();
  const birthdays = (mates ?? []).filter((e) => {
    if (!e.birth_date) return false;
    const d = new Date(e.birth_date + "T00:00:00");
    return d.getMonth() === month && d.getDate() === day;
  });
  const next = nextPunch(today ?? []);

  return (
    <Shell area="empleado" title="Inicio" session={s}>
      <p className="text-sm text-zinc-500">{saludo}</p>
      <h2 className="text-2xl font-semibold">Hola, {me?.first_name ?? s.fullName}</h2>

      {settings?.require_mobile_punch ? (
        <div className="panel mt-6 max-w-md p-5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Fichaje
          </p>
          <p className="mt-1 text-lg font-semibold">{next === "in" ? "Registrá la entrada" : "Registrá la salida"}</p>
          <div className="mt-4">
            <PunchPad next={next} hasFace={Boolean((me as { face_photo_path?: string | null } | null)?.face_photo_path)} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/empleado/recibos" className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Recibos pendientes</p>
          <p className="mt-1 text-3xl font-semibold">{pending ?? 0}</p>
        </Link>
        <Link href="/empleado/consultas" className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Consultas a RRHH</p>
          <p className="mt-1 text-lg font-medium">Abrir</p>
        </Link>
        <div className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Próximo evento</p>
          <p className="mt-1 text-sm font-medium">
            {events?.[0]
              ? `${events[0].title} · ${new Date(events[0].starts_at).toLocaleDateString("es-AR")}`
              : "Sin eventos"}
          </p>
        </div>
      </div>
      <div className="mt-6 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
        <p className="text-sm font-medium text-zinc-700">Cumpleaños de hoy</p>
        {birthdays.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Hoy no hay cumpleaños.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {birthdays.map((b) => (
              <li key={`${b.last_name}-${b.first_name}`}>
                {b.first_name} {b.last_name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
