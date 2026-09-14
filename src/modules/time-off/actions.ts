"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee, requireStaff } from "@/lib/auth/session";
import { getMyEmployee, notifyStaff, notifyUsers } from "@/lib/files";
import { isArHoliday, buenosAiresDate } from "@/lib/ar-holidays";
import { datesInRange, isWeekday, coversDay } from "@/lib/time-off";
import { roundMoney } from "@/lib/labels";

function touch() {
  revalidatePath("/empleado/vacaciones");
  revalidatePath("/rrhh/ausencias");
  revalidatePath("/rrhh/liquidacion");
}

export async function requestTimeOff(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha.");
  const starts = String(formData.get("starts_on") ?? "");
  const ends = String(formData.get("ends_on") ?? "") || starts;
  if (!starts) throw new Error("Indicá desde cuándo.");
  if (ends < starts) throw new Error("La fecha hasta no puede ser anterior.");
  const kind = String(formData.get("kind") ?? "vacation");
  if (kind === "company_off" || kind === "unjustified") throw new Error("Eso lo carga RRHH.");
  const db = createAdminClient();
  const { error } = await db.from("time_off").insert({
    tenant_id: s.tenantId,
    employee_id: me.id,
    kind,
    starts_on: starts,
    ends_on: ends,
    status: "pending",
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: s.userId,
  });
  if (error) throw new Error("No se pudo pedir. Corré 0013_time_off.sql en Supabase.");
  await notifyStaff(
    s.tenantId!,
    kind === "vacation" ? "Pedido de vacaciones" : "Pedido de licencia",
    `${me.first_name} ${me.last_name}: ${starts} → ${ends}`,
    "/rrhh/ausencias",
  );
  touch();
}

export async function updateMyTimeOff(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha.");
  const id = String(formData.get("id"));
  const starts = String(formData.get("starts_on") ?? "");
  const ends = String(formData.get("ends_on") ?? "") || starts;
  const db = createAdminClient();
  const { data: row } = await db
    .from("time_off")
    .select("id, status, employee_id")
    .eq("id", id)
    .eq("employee_id", me.id)
    .maybeSingle();
  if (!row || row.status !== "pending") throw new Error("Solo podés cambiar un pedido pendiente.");
  const { error } = await db
    .from("time_off")
    .update({
      starts_on: starts,
      ends_on: ends,
      note: String(formData.get("note") ?? "").trim() || null,
      kind: String(formData.get("kind") ?? "vacation"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  touch();
}

export async function cancelMyTimeOff(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha.");
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: row } = await db.from("time_off").select("status").eq("id", id).eq("employee_id", me.id).maybeSingle();
  if (!row || (row.status !== "pending" && row.status !== "approved")) {
    throw new Error("No se puede cancelar.");
  }
  if (row.status === "approved") {
    await db.from("time_off").update({ status: "cancelled" }).eq("id", id);
  } else {
    await db.from("time_off").delete().eq("id", id);
  }
  touch();
}

export async function decideTimeOff(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const db = createAdminClient();
  const { data: row } = await db
    .from("time_off")
    .select("employee_id, kind, starts_on, ends_on")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  await db
    .from("time_off")
    .update({ status, decided_by: s.userId })
    .eq("id", id)
    .eq("tenant_id", s.tenantId!);
  if (row?.employee_id) {
    const { data: emp } = await db.from("employees").select("user_id").eq("id", row.employee_id).maybeSingle();
    if (emp?.user_id) {
      await notifyUsers(
        s.tenantId!,
        [emp.user_id],
        status === "approved" ? "Pedido autorizado" : "Pedido rechazado",
        `${row.kind} ${row.starts_on} → ${row.ends_on}`,
        "/empleado/vacaciones",
      );
    }
  }
  touch();
}

export async function staffTimeOff(formData: FormData) {
  const s = await requireStaff();
  const starts = String(formData.get("starts_on") ?? "");
  const ends = String(formData.get("ends_on") ?? "") || starts;
  const kind = String(formData.get("kind") ?? "company_off");
  if (!starts) throw new Error("Indicá la fecha.");
  const employeeId = String(formData.get("employee_id") ?? "") || null;
  if (kind !== "company_off" && !employeeId) throw new Error("Elegí un empleado.");
  const db = createAdminClient();
  const { error } = await db.from("time_off").insert({
    tenant_id: s.tenantId,
    employee_id: kind === "company_off" ? null : employeeId,
    kind,
    starts_on: starts,
    ends_on: ends,
    status: "approved",
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: s.userId,
    decided_by: s.userId,
  });
  if (error) throw new Error("No se pudo guardar. Corré 0013_time_off.sql.");
  touch();
}

export async function scanUnjustifiedAbsences(formData: FormData) {
  const s = await requireStaff();
  const year = Number(formData.get("period_year"));
  const month = Number(formData.get("period_month"));
  const db = createAdminClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = endDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const days = datesInRange(start, end).filter((d) => d < today && isWeekday(d) && !isArHoliday(d));

  const [{ data: people }, { data: offs }, { data: punches }] = await Promise.all([
    db.from("employees").select("id, base_salary").eq("tenant_id", s.tenantId!).eq("status", "active"),
    db
      .from("time_off")
      .select("employee_id, kind, starts_on, ends_on, status")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "approved"),
    db
      .from("attendance_records")
      .select("employee_id, recorded_at")
      .eq("tenant_id", s.tenantId!)
      .gte("recorded_at", `${start}T00:00:00`)
      .lt("recorded_at", new Date(year, month, 1).toISOString()),
  ]);

  const punched = new Set(
    (punches ?? []).map((p) => `${p.employee_id}|${buenosAiresDate(p.recorded_at)}`),
  );
  const covered = (offs ?? []).filter((o) => o.status === "approved");

  for (const emp of people ?? []) {
    const dayPay = roundMoney(Number(emp.base_salary ?? 0) / 30);
    for (const day of days) {
      if (punched.has(`${emp.id}|${day}`)) continue;
      const ok = covered.some((o) => {
        if (!coversDay(o, day)) return false;
        if (o.kind === "company_off" && !o.employee_id) return true;
        return o.employee_id === emp.id && o.kind !== "unjustified";
      });
      if (ok) continue;
      const already = covered.some(
        (o) => o.employee_id === emp.id && o.kind === "unjustified" && coversDay(o, day),
      );
      if (already) continue;
      await db.from("time_off").insert({
        tenant_id: s.tenantId,
        employee_id: emp.id,
        kind: "unjustified",
        starts_on: day,
        ends_on: day,
        status: "approved",
        note: "Detectada: día hábil sin fichaje ni justificación",
        created_by: s.userId,
      });
      if (dayPay > 0) {
        await db.from("payroll_novelties").insert({
          tenant_id: s.tenantId,
          employee_id: emp.id,
          period_year: year,
          period_month: month,
          concept: "Falta injustificada",
          amount: -dayPay,
          status: "approved",
          note: day,
        });
      }
    }
  }
  touch();
  revalidatePath("/rrhh/empleados");
}
