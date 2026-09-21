"use client";

import { useActionState, useState } from "react";
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
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0">
      <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>
        Pedir viático
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <form
            action={action}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 text-left text-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {employeeId ? <input type="hidden" name="employee_id" value={employeeId} /> : null}
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">¿Salís de viático?</p>
              <button type="button" className="btn btn-ghost text-xs" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Elegí el día (hoy o uno próximo). No vale hasta que RRHH lo autorice.
            </p>
            <label className="block text-xs">
              Día
              <input name="day" type="date" required defaultValue={defaultDay} min={defaultDay} className="field mt-1" />
            </label>
            <PayViaFields />
            <input name="note" placeholder="Destino o nota (opcional)" className="field" />
            <button disabled={pending} className="btn btn-primary w-full">
              {pending ? "…" : "Enviar a RRHH"}
            </button>
            {message ? (
              <p className="text-xs" style={{ color: "var(--accent)" }}>
                {message}
              </p>
            ) : null}
            {upcoming.length ? (
              <ul className="space-y-2 border-t pt-3">
                {upcoming.map((v) => (
                  <li key={v.day} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      {v.day} · {ST[v.status ?? ""] ?? v.status}
                    </span>
                    {v.status === "pending" || v.status === "rejected" ? (
                      <form action={cancelViaticDay}>
                        {employeeId ? <input type="hidden" name="employee_id" value={employeeId} /> : null}
                        <input type="hidden" name="day" value={v.day} />
                        <button className="btn btn-ghost text-xs">Cancelar</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
        </div>
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
        Comisión / viaje. Queda pendiente hasta que lo autorices abajo (caja).
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
        {pending ? "…" : "Cargar pedido"}
      </button>
      {message ? (
        <p className="text-sm md:col-span-4" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
