import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmployee, toggleEmployee } from "@/modules/employees/actions";
import { EMPLOYEE_STATUS } from "@/lib/labels";

export default async function EmpleadosPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const [{ data: employees }, { data: branches }] = await Promise.all([
    db
      .from("employees")
      .select("id, first_name, last_name, dni, employee_number, email, status, hire_date")
      .eq("tenant_id", s.tenantId!)
      .order("last_name"),
    db.from("work_locations").select("id, name").eq("tenant_id", s.tenantId!).order("name"),
  ]);

  return (
    <Shell area="rrhh" title="Empleados" session={s}>
      <form action={createEmployee} className="panel mb-6 grid gap-2 p-5 md:grid-cols-4">
        <input name="employee_number" required placeholder="Legajo" className="field" />
        <input name="first_name" required placeholder="Nombre" className="field" />
        <input name="last_name" required placeholder="Apellido" className="field" />
        <input name="dni" required placeholder="DNI (usuario de ingreso)" className="field" />
        <input name="email" type="email" required placeholder="Correo personal" className="field" />
        <input name="phone" placeholder="Teléfono" className="field" />
        <input name="birth_date" type="date" className="field" />
        <input name="hire_date" type="date" className="field" />
        <select name="work_location_id" className="field">
          <option value="">Ficha en cualquier sucursal</option>
          {(branches ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              Solo {b.name}
            </option>
          ))}
        </select>
        <p className="text-xs md:col-span-4" style={{ color: "var(--muted)" }}>
          El DNI es el usuario. La persona activa la cuenta en «Primera vez» y elige su contraseña. El
          recupero de clave llega al correo personal.
        </p>
        <button className="btn btn-primary md:col-span-4">Crear empleado y acceso</button>
      </form>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-2">Legajo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">DNI</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Estado</th>
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
                <td className="px-3 py-2">
                  <a href={`/rrhh/empleados/${e.id}`} className="underline-offset-2 hover:underline" style={{ color: "var(--accent)" }}>
                    Ficha
                  </a>
                </td>
                <td className="px-3 py-2">
                  <form action={toggleEmployee}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="status" value={e.status} />
                    <button className="text-sm" style={{ color: "var(--accent)" }}>
                      {e.status === "active" ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
