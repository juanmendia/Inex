import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEmployee, resetPunchDevice, validateFacePhoto, deleteFacePhoto } from "@/modules/employees/actions";
import { saveEmployeeAddon } from "@/modules/agreements/actions";
import { addNovelty, loadOvertimeFromAttendance, updateNovelty, deleteNovelty } from "@/modules/payroll/actions";
import { OffboardForm } from "../offboard-form";
import { signedUrl } from "@/lib/files";

export default async function FichaEmpleado({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const s = await requireStaff();
  const { id } = await params;
  const { tab = "personal" } = await searchParams;
  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("*, departments(name), positions(name)")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!emp) notFound();
  const facePath = (emp as { face_photo_path?: string | null }).face_photo_path;
  const faceOk = Boolean((emp as { face_photo_validated?: boolean }).face_photo_validated);
  let faceUrl: string | null = null;
  if (facePath) {
    try {
      faceUrl = await signedUrl(facePath);
    } catch {
      faceUrl = null;
    }
  }

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const [{ data: receipts }, { data: tickets }, { data: agreements }, { data: raises }, { data: branches }, { data: extras }] =
    await Promise.all([
    db.from("receipts").select("id, period_year, period_month, kind, status").eq("employee_id", id).order("period_year", { ascending: false }),
    db.from("hr_tickets").select("id, subject, status").eq("employee_id", id).order("created_at", { ascending: false }),
    db.from("collective_agreements").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
    db.from("salary_changes").select("id, previous_amount, new_amount, percent, effective_on, note").eq("employee_id", id).order("effective_on", { ascending: false }).limit(8),
    db.from("work_locations").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
    db
      .from("payroll_novelties")
      .select("id, concept, amount, hours, rate_percent, note, status")
      .eq("employee_id", id)
      .eq("period_year", year)
      .eq("period_month", month)
      .order("created_at", { ascending: false }),
  ]);

  const dept = emp.departments as { name: string } | { name: string }[] | null;
  const pos = emp.positions as { name: string } | { name: string }[] | null;
  const deptName = Array.isArray(dept) ? dept[0]?.name : dept?.name;
  const posName = Array.isArray(pos) ? pos[0]?.name : pos?.name;

  const tabs = [
    ["personal", "Personal"],
    ["laboral", "Laboral"],
    ["recibos", "Recibos"],
    ["consultas", "Consultas"],
    ["baja", "Baja"],
  ] as const;

  return (
    <Shell area="rrhh" title={`${emp.last_name}, ${emp.first_name}`} session={s}>
      <Link href="/rrhh/empleados" className="text-sm text-[#142236]">
        ← Empleados
      </Link>
      <div className="mt-4 flex gap-2">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/rrhh/empleados/${id}?tab=${key}`}
            className={`rounded-full px-3 py-1 text-sm ${tab === key ? "bg-[#142236] text-white" : "bg-zinc-100"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {(tab === "personal" || tab === "laboral") && (
        <form action={updateEmployee} className="panel mt-4 grid gap-3 p-5 md:grid-cols-2">
          <input type="hidden" name="id" value={emp.id} />
          {tab === "personal" ? (
            <>
              <input name="first_name" defaultValue={emp.first_name} className="rounded-lg border px-3 py-2 text-sm" />
              <input name="last_name" defaultValue={emp.last_name} className="rounded-lg border px-3 py-2 text-sm" />
              <input name="dni" defaultValue={emp.dni ?? ""} placeholder="DNI" className="rounded-lg border px-3 py-2 text-sm" />
              <input name="email" defaultValue={emp.email ?? ""} className="rounded-lg border px-3 py-2 text-sm" />
              <input name="phone" defaultValue={emp.phone ?? ""} placeholder="Teléfono" className="rounded-lg border px-3 py-2 text-sm" />
              <input name="birth_date" type="date" defaultValue={emp.birth_date ?? ""} className="rounded-lg border px-3 py-2 text-sm" />
              <input type="hidden" name="agreement_id" value={emp.agreement_id ?? ""} />
              <input type="hidden" name="employee_number" value={emp.employee_number} />
              <input type="hidden" name="hire_date" value={emp.hire_date ?? ""} />
              <input type="hidden" name="department" value={deptName ?? ""} />
              <input type="hidden" name="position" value={posName ?? ""} />
              <input type="hidden" name="work_location_id" value={emp.work_location_id ?? ""} />
            </>
          ) : (
            <>
              <input name="employee_number" defaultValue={emp.employee_number} className="rounded-lg border px-3 py-2 text-sm" />
              <input name="department" defaultValue={deptName ?? ""} placeholder="Sector" className="rounded-lg border px-3 py-2 text-sm" />
              <input name="position" defaultValue={posName ?? ""} placeholder="Puesto" className="rounded-lg border px-3 py-2 text-sm" />
              <input name="hire_date" type="date" defaultValue={emp.hire_date ?? ""} className="rounded-lg border px-3 py-2 text-sm" />
              <select name="work_location_id" defaultValue={emp.work_location_id ?? ""} className="rounded-lg border px-3 py-2 text-sm">
                <option value="">Puede fichar en cualquier sucursal</option>
                {(branches ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    Solo {b.name}
                  </option>
                ))}
              </select>
              <select name="agreement_id" defaultValue={emp.agreement_id ?? ""} className="rounded-lg border px-3 py-2 text-sm">
                <option value="">Sin convenio</option>
                {(agreements ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input type="hidden" name="first_name" value={emp.first_name} />
              <input type="hidden" name="last_name" value={emp.last_name} />
              <input type="hidden" name="dni" value={emp.dni ?? ""} />
              <input type="hidden" name="email" value={emp.email ?? ""} />
              <input type="hidden" name="phone" value={emp.phone ?? ""} />
              <input type="hidden" name="birth_date" value={emp.birth_date ?? ""} />
            </>
          )}
          <button className="btn btn-primary md:col-span-2">Guardar</button>
        </form>
      )}
      {tab === "laboral" ? (
        <form action={resetPunchDevice} className="panel mt-3 p-5 text-sm">
          <input type="hidden" name="id" value={emp.id} />
          <p>
            {emp.punch_device_id
              ? "Celular de fichaje vinculado. Si no puede fichar desde el suyo, desvinculá y que ficha de nuevo: ese teléfono queda atado a él."
              : "No hay celular atado. El próximo fichaje válido queda vinculado a ese teléfono."}
          </p>
          <button className="btn btn-ghost mt-2">Desvincular / arrancar de cero</button>
        </form>
      ) : null}
      {tab === "laboral" ? (
        <div className="panel mt-3 p-5 text-sm">
          <p className="text-xs tracking-widest uppercase" style={{ color: "var(--muted)" }}>
            Foto de referencia (reconocimiento)
          </p>
          {faceUrl ? (
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={faceUrl} alt="Foto de referencia" className="h-28 w-28 rounded-xl object-cover" />
              <div>
                <p className="font-medium">{faceOk ? "Validada por RRHH" : "Pendiente de validar"}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Cada fichaje compara la cara nueva con esta (modelo gratuito en el celular). Si no es la persona, borrala y tiene que enrolarse de nuevo.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!faceOk ? (
                    <form action={validateFacePhoto}>
                      <input type="hidden" name="id" value={emp.id} />
                      <button className="btn btn-primary">Validar</button>
                    </form>
                  ) : null}
                  <form action={deleteFacePhoto}>
                    <input type="hidden" name="id" value={emp.id} />
                    <button className="btn btn-ghost">Eliminar foto</button>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2" style={{ color: "var(--muted)" }}>
              Todavía no hay foto de referencia. La primera vez que fiche, el sistema se la pide.
            </p>
          )}
        </div>
      ) : null}
      {tab === "laboral" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form action={saveEmployeeAddon} className="panel grid gap-2 p-5">
            <p className="text-xs tracking-widest uppercase text-zinc-500">Plus fijo mensual</p>
            <p className="text-sm">
              Básico convenio + plus = {emp.base_salary ?? 0}. Los aumentos del CCT están en Convenios.
            </p>
            <input type="hidden" name="employee_id" value={emp.id} />
            <input
              name="salary_addon"
              type="number"
              step="0.01"
              defaultValue={(emp as { salary_addon?: number }).salary_addon ?? 0}
              placeholder="Plus / adicional fijo"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <button className="btn btn-primary">Guardar plus</button>
          </form>

          <div className="panel p-5">
            <p className="text-xs tracking-widest uppercase text-zinc-500">Horas extras del mes</p>
            <p className="mt-1 text-sm text-zinc-600">
              Se arman solas con el fichaje y los % del convenio (sábado, domingo, feriado, noche). Después las
              podés corregir.
            </p>
            <form action={loadOvertimeFromAttendance} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="employee_id" value={emp.id} />
              <input type="hidden" name="period_year" value={year} />
              <input type="hidden" name="period_month" value={month} />
              <button className="btn btn-primary">Armar extras con fichajes</button>
            </form>
            <ul className="mt-3 divide-y text-sm">
              {(extras ?? [])
                .filter((n) => n.hours != null)
                .map((n) => (
                  <li key={n.id} className="py-2">
                    <p>
                      {n.concept} · {n.hours} h · {n.amount}
                    </p>
                    <form action={updateNovelty} className="mt-1 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={n.id} />
                      <input name="hours" type="number" step="0.25" defaultValue={n.hours ?? ""} className="field max-w-24" />
                      <select name="rate_percent" defaultValue={n.rate_percent ?? 150} className="field max-w-28">
                        <option value="150">150%</option>
                        <option value="200">200%</option>
                        <option value="100">100%</option>
                      </select>
                      <button className="btn btn-ghost text-xs">Recalcular</button>
                    </form>
                    <form action={deleteNovelty}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="text-xs text-red-800">Quitar</button>
                    </form>
                  </li>
                ))}
            </ul>
          </div>

          <div className="panel p-5">
            <p className="text-xs tracking-widest uppercase text-zinc-500">Otros adicionales del mes</p>
            <form action={addNovelty} className="mt-2 grid gap-2 sm:grid-cols-3">
              <input type="hidden" name="kind" value="other" />
              <input type="hidden" name="employee_id" value={emp.id} />
              <input type="hidden" name="period_year" value={year} />
              <input type="hidden" name="period_month" value={month} />
              <select name="concept" className="field">
                <option value="Premio">Premio</option>
                <option value="Viático">Viático</option>
                <option value="Presentismo">Presentismo</option>
                <option value="Antigüedad">Antigüedad extra</option>
                <option value="Otro">Otro</option>
              </select>
              <input name="amount" type="number" step="0.01" placeholder="Importe" className="field" required />
              <input name="note" placeholder="Detalle (opcional)" className="field" />
              <button className="btn btn-primary sm:col-span-3">Agregar adicional</button>
            </form>
            <ul className="mt-3 divide-y text-sm">
              {(extras ?? [])
                .filter((n) => n.hours == null)
                .map((n) => (
                  <li key={n.id} className="flex items-center justify-between py-2">
                    <span>
                      {n.concept} · {n.amount}
                    </span>
                    <form action={deleteNovelty}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="text-xs text-red-800">Quitar</button>
                    </form>
                  </li>
                ))}
            </ul>
          </div>

          <ul className="text-xs text-zinc-500 lg:col-span-2">
            {(raises ?? []).map((r) => (
              <li key={r.id}>
                {r.effective_on}: {r.previous_amount} → {r.new_amount}
                {r.percent ? ` (${r.percent}%)` : ""} {r.note ?? ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tab === "recibos" && (
        <ul className="mt-4 divide-y rounded-xl bg-white ring-1 ring-zinc-200">
          {(receipts ?? []).map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm">
              <Link href={`/rrhh/recibos?id=${r.id}`}>
                {r.kind} {r.period_month}/{r.period_year} · {r.status}
              </Link>
            </li>
          ))}
          {!receipts?.length ? <li className="px-4 py-3 text-sm text-zinc-500">Sin recibos.</li> : null}
        </ul>
      )}
      {tab === "consultas" && (
        <ul className="mt-4 divide-y rounded-xl bg-white ring-1 ring-zinc-200">
          {(tickets ?? []).map((t) => (
            <li key={t.id} className="px-4 py-3 text-sm">
              <Link href={`/rrhh/consultas?id=${t.id}`}>
                {t.subject} · {t.status}
              </Link>
            </li>
          ))}
          {!tickets?.length ? <li className="px-4 py-3 text-sm text-zinc-500">Sin consultas.</li> : null}
        </ul>
      )}
      {tab === "baja" &&
        (emp.status === "active" ? (
          <OffboardForm employeeId={emp.id} name={`${emp.first_name} ${emp.last_name}`} />
        ) : (
          <p className="mt-4 text-sm text-zinc-600">
            Esta persona ya está de baja
            {emp.terminated_at ? ` desde ${emp.terminated_at}` : ""}.
            {emp.termination_reason ? ` Motivo: ${emp.termination_reason}.` : ""} Los recibos siguen en la
            ficha. Para volver a darle acceso, usá Reactivar en la lista de empleados.
          </p>
        ))}
    </Shell>
  );
}
