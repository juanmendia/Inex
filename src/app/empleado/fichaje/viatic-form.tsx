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

export function ViaticForm({
  day,
  employeeId,
  already,
  payVia,
  paid,
}: {
  day: string;
  employeeId?: string;
  already?: boolean;
  payVia?: string;
  paid?: boolean;
}) {
  const [message, action, pending] = useActionState(declareViaticDay, null);
  if (already) {
    return (
      <form action={cancelViaticDay} className="mt-4 rounded-xl bg-sky-50 p-4 text-sm">
        {employeeId ? <input type="hidden" name="employee_id" value={employeeId} /> : null}
        <input type="hidden" name="day" value={day} />
        <p className="font-medium text-sky-950">Hoy estás de viático.</p>
        <p className="mt-1 text-xs text-sky-800">
          {paid
            ? "Ya está cobrado: no entra al recibo."
            : payVia === "cash"
              ? "Lo cobrás aparte, no va al recibo. RRHH lo tilda cuando te lo entrega."
              : "Va en el recibo del mes, salvo que RRHH lo marque como ya pagado."}
        </p>
        {!paid ? <button className="btn btn-ghost mt-2 text-xs">Quitar</button> : null}
      </form>
    );
  }
  return (
    <form action={action} className="mt-4 space-y-2 rounded-xl bg-zinc-50 p-4 text-sm">
      {employeeId ? <input type="hidden" name="employee_id" value={employeeId} /> : null}
      <input type="hidden" name="day" value={day} />
      <p className="font-medium">¿Salís de viático?</p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Cargalo antes de irte. Elegí si lo cobrás en el recibo o al día siguiente.
      </p>
      <PayViaFields />
      <input name="note" placeholder="Destino o nota (opcional)" className="field" />
      <button disabled={pending} className="btn btn-primary">
        {pending ? "…" : "Marcar viático"}
      </button>
      {message ? (
        <p className="text-xs" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
    </form>
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
        Comisión / viaje. Recibo del mes, o pago aparte. Si ya se pagó, tildalo en Liquidación y sale del recibo.
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
