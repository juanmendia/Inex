import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/files";
import { TIME_OFF_KIND, TIME_OFF_STATUS } from "@/lib/time-off";
import {
  decideTimeOff,
  staffTimeOff,
  scanUnjustifiedAbsences,
  ensureLeaveTypes,
  addLeaveType,
  updateLeaveType,
} from "@/modules/time-off/actions";

export default async function AusenciasRrhh() {
  const s = await requireStaff();
  const types = await ensureLeaveTypes(s.tenantId!);
  const db = createAdminClient();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const [{ data: rows }, { data: people }] = await Promise.all([
    db
      .from("time_off")
      .select("id, kind, leave_type_id, starts_on, ends_on, status, note, certificate_path, employee_id, employees(first_name, last_name)")
      .eq("tenant_id", s.tenantId!)
      .order("starts_on", { ascending: false })
      .limit(80),
    db
      .from("employees")
      .select("id, first_name, last_name")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "active")
      .order("last_name"),
  ]);
  const byId = new Map(types.map((t) => [t.id, t]));
  const certs: Record<string, string> = {};
  for (const r of rows ?? []) {
    if (r.certificate_path) certs[r.id] = await signedUrl(r.certificate_path);
  }

  return (
    <Shell area="rrhh" title="Ausencias" session={s}>
      <p className="mb-4 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
        El empleado elige el tipo de licencia (vacaciones, enfermedad, día femenino, etc.) y puede adjuntar
        certificado. Acá autorizás y también podés editar el catálogo.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <form action={staffTimeOff} className="panel grid gap-2 p-5">
          <p className="text-sm font-medium">Cargar día / licencia</p>
          <select name="leave_type_id" className="field">
            {types.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select name="employee_id" className="field">
            <option value="">Empresa (solo día no laboral)</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.last_name}, {p.first_name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="starts_on" type="date" required className="field" />
            <input name="ends_on" type="date" className="field" />
          </div>
          <input name="note" placeholder="Motivo" className="field" />
          <input name="certificate" type="file" accept="image/*,application/pdf" className="text-sm" />
          <button className="btn btn-primary">Guardar</button>
        </form>
        <form action={scanUnjustifiedAbsences} className="panel grid gap-2 p-5">
          <p className="text-sm font-medium">Detectar faltas del mes</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Días hábiles sin fichaje, sin licencia autorizada y sin día no laboral.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input name="period_year" type="number" defaultValue={year} className="field" />
            <input name="period_month" type="number" defaultValue={month} className="field" />
          </div>
          <button className="btn btn-primary">Marcar faltas injustificadas</button>
        </form>
      </div>

      <h2 className="mt-8 text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
        Tipos de licencia (el empleado ve las que están activas y marcadas para pedir)
      </h2>
      <form action={addLeaveType} className="panel mt-2 grid gap-2 p-4 md:grid-cols-4">
        <input name="name" placeholder="Nueva licencia (ej. Día de estudio extra)" className="field md:col-span-2" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="employee_can_request" defaultChecked /> El empleado la puede pedir
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requires_certificate" /> Pide certificado
        </label>
        <button className="btn btn-primary md:col-span-4">Agregar tipo</button>
      </form>
      <ul className="panel mt-2 divide-y">
        {types.map((t) => (
          <li key={t.id} className="px-4 py-2">
            <form action={updateLeaveType} className="flex flex-wrap items-center gap-3 text-sm">
              <input type="hidden" name="id" value={t.id} />
              <input name="name" defaultValue={t.name} className="field max-w-md flex-1" />
              <label className="flex items-center gap-1">
                <input type="checkbox" name="employee_can_request" defaultChecked={t.employee_can_request} /> Pedible
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" name="requires_certificate" defaultChecked={t.requires_certificate} /> Certificado
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" name="active" defaultChecked={t.active} /> Activa
              </label>
              <button className="btn btn-ghost text-xs">Guardar</button>
            </form>
          </li>
        ))}
      </ul>

      <ul className="panel mt-6 divide-y">
        {(rows ?? []).map((r) => {
          const emp = r.employees as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
          const e = Array.isArray(emp) ? emp[0] : emp;
          const who = e ? `${e.last_name}, ${e.first_name}` : "Toda la empresa";
          const label = (r.leave_type_id && byId.get(r.leave_type_id)?.name) || TIME_OFF_KIND[r.kind] || r.kind;
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                {who} · {label} · {r.starts_on}
                {r.ends_on !== r.starts_on ? ` → ${r.ends_on}` : ""} · {TIME_OFF_STATUS[r.status] ?? r.status}
                {r.note ? ` · ${r.note}` : ""}
                {certs[r.id] ? (
                  <>
                    {" · "}
                    <a className="text-indigo-600" href={certs[r.id]} target="_blank" rel="noreferrer">
                      Certificado
                    </a>
                  </>
                ) : null}
              </span>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <form action={decideTimeOff}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button className="btn btn-primary text-xs">Autorizar</button>
                  </form>
                  <form action={decideTimeOff}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="btn btn-ghost text-xs">Rechazar</button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
