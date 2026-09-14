"use client";

import { useActionState } from "react";
import { generateReceipts } from "@/modules/receipts/actions";

export function GenerateReceiptsForm({
  employees,
  year,
  month,
}: {
  employees: { id: string; first_name: string; last_name: string; employee_number: string }[];
  year: number;
  month: number;
}) {
  const [message, action, pending] = useActionState(generateReceipts, null);
  return (
    <form action={action} className="panel mb-6 grid gap-2 p-5 md:grid-cols-5">
      <p className="text-sm md:col-span-5" style={{ color: "var(--muted)" }}>
        Se arma el PDF de liquidación (básico + novedades). En junio y diciembre también sale el aguinaldo (SAC) aparte.
        Si el recibo todavía no está firmado, se regenera.
      </p>
      <select name="employee_id" className="field">
        <option value="">Todos los activos</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.employee_number} · {e.last_name}, {e.first_name}
          </option>
        ))}
      </select>
      <input name="period_year" type="number" defaultValue={year} className="field" />
      <input name="period_month" type="number" min={1} max={12} defaultValue={month} className="field" />
      <input name="kind" defaultValue="haberes" className="field" />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Generando…" : "Generar recibos"}
      </button>
      {message ? <p className="text-sm md:col-span-5">{message}</p> : null}
    </form>
  );
}
