import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEmployee } from "@/modules/employees/actions";
import { applySalaryChange } from "@/modules/agreements/actions";

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

  const [{ data: receipts }, { data: tickets }, { data: agreements }, { data: raises }, { data: branches }] = await Promise.all([
    db.from("receipts").select("id, period_year, period_month, kind, status").eq("employee_id", id).order("period_year", { ascending: false }),
    db.from("hr_tickets").select("id, subject, status").eq("employee_id", id).order("created_at", { ascending: false }),
    db.from("collective_agreements").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
    db.from("salary_changes").select("id, previous_amount, new_amount, percent, effective_on, note").eq("employee_id", id).order("effective_on", { ascending: false }).limit(8),
    db.from("work_locations").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
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
  ] as const;

  return (
    <Shell area="rrhh" title={`${emp.last_name}, ${emp.first_name}`} session={s}>
      <Link href="/rrhh/empleados" className="text-sm text-indigo-600">
        ← Empleados
      </Link>
      <div className="mt-4 flex gap-2">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/rrhh/empleados/${id}?tab=${key}`}
            className={`rounded-full px-3 py-1 text-sm ${tab === key ? "bg-indigo-600 text-white" : "bg-zinc-100"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {(tab === "personal" || tab === "laboral") && (
        <form action={updateEmployee} className="mt-4 grid max-w-xl gap-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
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
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Guardar</button>
        </form>
      )}
      {tab === "laboral" ? (
        <form action={applySalaryChange} className="mt-4 grid max-w-xl gap-2 rounded-xl bg-white p-4 ring-1 ring-zinc-200">
          <p className="text-xs tracking-widest uppercase text-zinc-500">Sueldo y aumentos</p>
          <p className="text-sm">Básico actual: {emp.base_salary ?? 0}</p>
          <input type="hidden" name="employee_id" value={emp.id} />
          <input name="new_amount" type="number" step="0.01" placeholder="Nuevo sueldo" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="percent" type="number" step="0.01" placeholder="O aumento %" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="effective_on" type="date" className="rounded-lg border px-3 py-2 text-sm" />
          <input name="note" placeholder="Nota (paritaria, acuerdo, etc.)" className="rounded-lg border px-3 py-2 text-sm" />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Aplicar</button>
          <ul className="text-xs text-zinc-500">
            {(raises ?? []).map((r) => (
              <li key={r.id}>
                {r.effective_on}: {r.previous_amount} → {r.new_amount}
                {r.percent ? ` (${r.percent}%)` : ""} {r.note ?? ""}
              </li>
            ))}
          </ul>
        </form>
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
    </Shell>
  );
}
