import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { toggleEmployee } from "@/modules/employees/actions";
import { EMPLOYEE_STATUS } from "@/lib/labels";
import { CreateEmployeeForm, ResetEmployeeKey } from "./create-form";

export default async function EmpleadosPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const [{ data: employees }, { data: branches }, { data: agreements }] = await Promise.all([
    db
      .from("employees")
      .select("id, first_name, last_name, dni, employee_number, email, status, hire_date, temp_password")
      .eq("tenant_id", s.tenantId!)
      .order("last_name"),
    db.from("work_locations").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
    db.from("collective_agreements").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
  ]);

  return (
    <Shell area="rrhh" title="Empleados" session={s}>
      <CreateEmployeeForm branches={branches ?? []} agreements={agreements ?? []} />
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-2">Legajo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">DNI</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Clave temporal</th>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(employees ?? []).map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2">{e.employee_number}</td>
                <td className="px-3 py-2">
                  {e.last_name}, {e.first_name}
                </td>
                <td className="px-3 py-2">{e.dni ?? "—"}</td>
                <td className="px-3 py-2">{e.email ?? "—"}</td>
                <td className="px-3 py-2">{EMPLOYEE_STATUS[e.status] ?? e.status}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {e.temp_password ? (
                    <span className="select-all">{e.temp_password}</span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Sin copia</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <a href={`/rrhh/empleados/${e.id}`} className="underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
                    Ficha
                  </a>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-end gap-1">
                    <ResetEmployeeKey id={e.id} />
                    {e.status === "active" ? (
                      <a href={`/rrhh/empleados/${e.id}?tab=baja`} className="text-sm text-red-800">
                        Dar de baja
                      </a>
                    ) : (
                      <form action={toggleEmployee}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="status" value={e.status} />
                        <button className="text-sm" style={{ color: "var(--accent)" }}>
                          Reactivar
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
