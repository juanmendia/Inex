"use client";

import { useActionState } from "react";
import { manualAttendance } from "@/modules/attendance/actions";

export function ManualAttendanceForm({
  employees,
}: {
  employees: { id: string; first_name: string; last_name: string; employee_number: string }[];
}) {
  const [message, action, pending] = useActionState(manualAttendance, null);
  return (
    <form action={action} className="panel mt-6 grid gap-3 p-5 md:grid-cols-4">
      <p className="text-sm font-medium md:col-span-4">Presente a mano</p>
      <p className="text-xs md:col-span-4" style={{ color: "var(--muted)" }}>
        Plan B: el celular falló, se olvidó de fichar o no pudo llegar al GPS. Cargás entrada y, si ya se fue,
        también la salida.
      </p>
      <select name="employee_id" required className="field md:col-span-2">
        <option value="">Empleado</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.employee_number} · {e.last_name}, {e.first_name}
          </option>
        ))}
      </select>
      <label className="text-xs">
        Entrada
        <input name="in_at" type="datetime-local" required className="field mt-1" />
      </label>
      <label className="text-xs">
        Salida (opcional)
        <input name="out_at" type="datetime-local" className="field mt-1" />
      </label>
      {message ? (
        <p className="text-sm md:col-span-4" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
      <button disabled={pending} className="btn btn-primary md:col-span-4">
        {pending ? "Guardando…" : "Cargar presente"}
      </button>
    </form>
  );
}
