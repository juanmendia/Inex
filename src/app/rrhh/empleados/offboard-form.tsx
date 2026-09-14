"use client";

import { useActionState } from "react";
import { offboardEmployee } from "@/modules/employees/actions";

export function OffboardForm({
  employeeId,
  name,
}: {
  employeeId: string;
  name: string;
}) {
  const [message, action, pending] = useActionState(offboardEmployee, null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-4 max-w-xl space-y-3 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
      <input type="hidden" name="id" value={employeeId} />
      <p className="text-sm text-zinc-600">
        No se borra a {name}: quedan ficha, recibos y fichajes. Se corta el ingreso al portal y deja de
        entrar en la liquidación mensual. Los importes de egreso son opcionales y los carga RRHH (no hay
        cálculo automático de indemnización).
      </p>
      <label className="block text-sm">
        Fecha de egreso
        <input name="terminated_at" type="date" required defaultValue={today} className="mt-1 w-full rounded-lg border px-3 py-2" />
      </label>
      <input name="reason" placeholder="Motivo (renuncia, despido, fin de contrato…)" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <p className="text-xs tracking-widest uppercase text-zinc-500">Liquidación final (opcional, importes)</p>
      <input name="days_pay" type="number" step="0.01" min="0" placeholder="Sueldo proporcional / días del mes" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <input name="sac" type="number" step="0.01" min="0" placeholder="SAC proporcional" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <input name="vacation" type="number" step="0.01" min="0" placeholder="Vacaciones no gozadas" className="w-full rounded-lg border px-3 py-2 text-sm" />
      <input name="severance" type="number" step="0.01" min="0" placeholder="Indemnización u otros" className="w-full rounded-lg border px-3 py-2 text-sm" />
      {message ? <p className="text-sm text-[#1f5c56]">{message}</p> : null}
      <button disabled={pending} className="rounded-lg bg-red-800 px-4 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Procesando…" : "Confirmar baja"}
      </button>
    </form>
  );
}
