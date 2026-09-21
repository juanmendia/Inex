"use client";

import { useActionState } from "react";
import { declareViaticDay, cancelViaticDay } from "@/modules/attendance/actions";

function PayViaFields() {
  return (
    <div className="grid gap-1 text-xs">
      <label className="flex items-center gap-2">
        <input type="radio" name="pay_via" value="recibo" defaultChecked />
        En el recibo del mes
      </label>
      <label className="flex items-center gap-2">
        <input type="radio" name="pay_via" value="cash" />
        Pago aparte (día siguiente / efectivo)
      </label>
    </div>
  );
}

export type MyViatic = {
  day: string;
  pay_via: string | null;
  paid_at: string | null;
  status: string | null;
  note: string | null;
};

const ST: Record<string, string> = {
  pending: "Esperando a RRHH",
  approved: "Autorizado",
  rejected: "No autorizado",
};

export function ViaticForm({
  defaultDay,
  employeeId,
  upcoming = [],
}: {
  defaultDay: string;
  employeeId?: string;
  upcoming?: MyViatic[];
}) {
  const [message, action, pending] = useActionState(declareViaticDay, null);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2 rounded-xl bg-zinc-50 p-4 text-sm">
        {employeeId ? <input type="hidden" name="employee_id" value={employeeId} /> : null}
        <p className="font-medium">¿Salís de viático?</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Pedilo antes de irte. Podés cargar hoy o un día próximo (ej. el 23). RRHH autoriza según caja.
        </p>
        <label className="block text-xs">
          Día
          <input name="day" type="date" required defaultValue={defaultDay} min={defaultDay} className="field mt-1" />
        </label>
        <PayViaFields />
        <input name="note" placeholder="Destino o nota (opcional)" className="field" />
        <button disabled={pending} className="btn btn-primary">
          {pending ? "…" : "Pedir viático"}
        </button>
        {message ? (
          <p className="text-xs" style={{ color: "var(--accent)" }}>
            {message}
          </p>
        ) : null}
      </form>
      {upcoming.length ? (
        <ul className="space-y-2 text-sm">
          {upcoming.map((v) => (
            <li key={v.day} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-2">
              <p>
                <span className="font-medium">{v.day}</span>
                <span className="ml-2 text-xs text-sky-800">
                  {ST[v.status ?? ""] ?? v.status}
                  {v.paid_at ? " · cobrado" : v.pay_via === "cash" ? " · pago aparte" : " · recibo"}
                </span>
              </p>
              {v.status === "pending" || v.status === "rejected" ? (
                <form action={cancelViaticDay}>
                  {employeeId ? <input type="hidden" name="employee_id" value={employeeId} /> : null}
                  <input type="hidden" name="day" value={v.day} />
                  <button className="btn btn-ghost text-xs">
                    {v.status === "pending" ? "Cancelar" : "Quitar"}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function StaffViaticForm({
  employees,
}: {
  employees: { id: string; first_name: string; last_name: string }[];
}) {
  const [message, action, pending] = useActionState(declareViaticDay, null);
  return (
    <form action={action} className="panel mt-4 grid gap-3 p-5 md:grid-cols-4">
      <p className="text-sm font-medium md:col-span-4">Día de viático</p>
      <p className="text-xs md:col-span-4" style={{ color: "var(--muted)" }}>
        Comisión / viaje. Al cargarlo acá queda autorizado. Si no hay caja, rechazá el pedido del empleado.
      </p>
      <select name="employee_id" required className="field md:col-span-2">
        <option value="">Empleado</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.last_name}, {e.first_name}
          </option>
        ))}
      </select>
      <input name="day" type="date" required className="field" />
      <input name="note" placeholder="Nota" className="field" />
      <div className="md:col-span-4">
        <PayViaFields />
      </div>
      <button disabled={pending} className="btn btn-primary md:col-span-4">
        {pending ? "…" : "Cargar viático"}
      </button>
      {message ? (
        <p className="text-sm md:col-span-4" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
