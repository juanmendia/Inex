import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { StaffViaticForm } from "@/app/empleado/fichaje/viatic-form";
import { decideViatic, setViaticPaid, cancelViaticDay } from "@/modules/attendance/actions";

const LABEL: Record<string, string> = {
  pending: "Pendiente de autorización",
  approved: "Autorizado",
  rejected: "No autorizado",
};

export default async function ViaticosRrhh() {
  const s = await requireStaff();
  const db = createAdminClient();
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: people }, { data: rows }] = await Promise.all([
    db.from("employees").select("id, first_name, last_name").eq("tenant_id", s.tenantId!).eq("status", "active").order("last_name"),
    db
      .from("viatic_days")
      .select("id, employee_id, day, note, pay_via, paid_at, status")
      .eq("tenant_id", s.tenantId!)
      .gte("day", start)
      .order("day", { ascending: false }),
  ]);
  const nameOf = (id: string) => {
    const p = (people ?? []).find((e) => e.id === id);
    return p ? `${p.last_name}, ${p.first_name}` : "Empleado";
  };
  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const rest = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <Shell area="rrhh" title="Viáticos" session={s}>
      <p className="mb-4 max-w-2xl text-sm" style={{ color: "var(--muted)" }}>
        Acá autorizás la salida (si hay plata en caja), cargás un viático vos, o lo rechazás. No es una
        ausencia: el pedido del empleado llega a esta pantalla.
      </p>
      <StaffViaticForm employees={people ?? []} />

      {pending.length ? (
        <section className="panel mt-6 divide-y overflow-hidden">
          <h2 className="px-5 py-3 text-sm font-semibold">Pendientes de autorización</h2>
          {pending.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {nameOf(v.employee_id)} · {String(v.day).slice(0, 10)}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {v.pay_via === "cash" ? "Quiere cobro aparte" : "Quiere recibo"}
                  {v.note ? ` · ${v.note}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <form action={decideViatic}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="btn btn-primary text-xs">Autorizar</button>
                </form>
                <form action={decideViatic}>
                  <input type="hidden" name="id" value={v.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="btn btn-ghost text-xs">No hay caja</button>
                </form>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <p className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          No hay pedidos pendientes.
        </p>
      )}

      <ul className="panel mt-6 divide-y">
        {rest.map((v) => {
          const paid = Boolean(v.paid_at);
          const ok = v.status === "approved";
          return (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {nameOf(v.employee_id)} · {String(v.day).slice(0, 10)}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {LABEL[v.status] ?? v.status}
                  {ok ? (paid ? " · ya pagado (fuera del recibo)" : v.pay_via === "cash" ? " · pago aparte" : " · en el recibo") : ""}
                  {v.note ? ` · ${v.note}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                {ok ? (
                  <form action={setViaticPaid}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="paid" value={paid ? "0" : "1"} />
                    <button className="btn btn-ghost text-xs">{paid ? "Destildar pago" : "Ya pagado"}</button>
                  </form>
                ) : null}
                <form action={cancelViaticDay}>
                  <input type="hidden" name="employee_id" value={v.employee_id} />
                  <input type="hidden" name="day" value={String(v.day).slice(0, 10)} />
                  <button className="btn btn-ghost text-xs">Quitar</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
