"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/files";

import { hourValue, overtimeAmount, overtimeLabel } from "@/lib/labels";
import { overtimeFromPunches } from "@/lib/overtime-from-punches";
import { generatePeriodReceipts } from "@/lib/generate-receipts";

export async function addNovelty(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  const employeeId = String(formData.get("employee_id"));
  const hours = Number(formData.get("hours") || 0);
  const ratePercent = Number(formData.get("rate_percent") || 150);
  const kind = String(formData.get("kind") ?? "extra");

  if (kind === "extra") {
    if (hours <= 0) throw new Error("Indicá la cantidad de horas.");
    const { data: emp } = await db
      .from("employees")
      .select("base_salary, agreement_id")
      .eq("id", employeeId)
      .single();
    const { data: settings } = await db
      .from("tenant_settings")
      .select("monthly_hours")
      .eq("tenant_id", s.tenantId!)
      .maybeSingle();
    let monthly = Number(settings?.monthly_hours ?? 176);
    if (emp?.agreement_id) {
      const { data: ag } = await db
        .from("collective_agreements")
        .select("monthly_hours")
        .eq("id", emp.agreement_id)
        .maybeSingle();
      if (ag?.monthly_hours) monthly = Number(ag.monthly_hours);
    }
    const vh = hourValue(Number(emp?.base_salary ?? 0), monthly);
    if (vh <= 0) throw new Error("Definí el sueldo básico del empleado para calcular el valor hora.");
    const amount = overtimeAmount({ hourValue: vh, hours, ratePercent });
    const concept = overtimeLabel(ratePercent);
    const note = `${hours} h × valor hora ${vh} × ${ratePercent}%`;
    const { error } = await db.from("payroll_novelties").insert({
      tenant_id: s.tenantId,
      employee_id: employeeId,
      period_year: Number(formData.get("period_year")),
      period_month: Number(formData.get("period_month")),
      concept,
      amount,
      hours,
      rate_percent: ratePercent,
      status: "approved",
      note,
    });
    if (error) {
      const retry = await db.from("payroll_novelties").insert({
        tenant_id: s.tenantId,
        employee_id: employeeId,
        period_year: Number(formData.get("period_year")),
        period_month: Number(formData.get("period_month")),
        concept,
        amount,
        status: "approved",
        note,
      });
      if (retry.error) throw new Error("No se pudo guardar. Corré 0002 y 0003 en el editor SQL.");
    }
  } else {
    const amount = Number(formData.get("amount") || 0);
    const concept = String(formData.get("concept") ?? "").trim() || "Adicional";
    const { error } = await db.from("payroll_novelties").insert({
      tenant_id: s.tenantId,
      employee_id: employeeId,
      period_year: Number(formData.get("period_year")),
      period_month: Number(formData.get("period_month")),
      concept,
      amount,
      status: "approved",
      note: String(formData.get("note") ?? "") || null,
    });
    if (error) throw new Error("No se pudo guardar la novedad.");
  }
  revalidatePath("/rrhh/liquidacion");
  revalidatePath(`/rrhh/empleados/${employeeId}`);
}

export async function loadOvertimeFromAttendance(formData: FormData) {
  const s = await requireStaff();
  const year = Number(formData.get("period_year"));
  const month = Number(formData.get("period_month"));
  const only = String(formData.get("employee_id") ?? "").trim();
  const db = createAdminClient();
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month, 1).toISOString();
  let empQ = db
    .from("employees")
    .select("id, agreement_id, base_salary")
    .eq("tenant_id", s.tenantId!)
    .eq("status", "active");
  if (only) empQ = empQ.eq("id", only);
  const { data: employees } = await empQ;
  const { data: agreements } = await db
    .from("collective_agreements")
    .select(
      "id, monthly_hours, day_start, day_end, afternoon_start, afternoon_end, scale_amount, rate_weekday, rate_saturday, rate_sunday, rate_holiday, rate_night",
    )
    .eq("tenant_id", s.tenantId!);
  const agMap = new Map((agreements ?? []).map((a) => [a.id, a]));
  let del = db
    .from("payroll_novelties")
    .delete()
    .eq("tenant_id", s.tenantId!)
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("status", "approved")
    .like("note", "auto-fichaje%");
  if (only) del = del.eq("employee_id", only);
  await del;

  for (const emp of employees ?? []) {
    const { data: punches } = await db
      .from("attendance_records")
      .select("recorded_at, punch_type, method")
      .eq("employee_id", emp.id)
      .gte("recorded_at", from)
      .lt("recorded_at", to)
      .order("recorded_at");
    const ag = emp.agreement_id ? agMap.get(emp.agreement_id) : undefined;
    const buckets = overtimeFromPunches(punches ?? [], {
      dayStart: (ag as { day_start?: string } | undefined)?.day_start,
      dayEnd: (ag as { day_end?: string } | undefined)?.day_end,
      afternoonStart: (ag as { afternoon_start?: string } | undefined)?.afternoon_start,
      afternoonEnd: (ag as { afternoon_end?: string } | undefined)?.afternoon_end,
      rateWeekday: (ag as { rate_weekday?: number } | undefined)?.rate_weekday,
      rateSaturday: (ag as { rate_saturday?: number } | undefined)?.rate_saturday,
      rateSunday: (ag as { rate_sunday?: number } | undefined)?.rate_sunday,
      rateHoliday: (ag as { rate_holiday?: number } | undefined)?.rate_holiday,
      rateNight: (ag as { rate_night?: number } | undefined)?.rate_night,
    });
    const monthly = Number(ag?.monthly_hours ?? 176);
    const vh = hourValue(Number(emp.base_salary ?? 0), monthly);
    for (const { hours, rate } of buckets) {
      if (hours <= 0 || vh <= 0) continue;
      const amount = overtimeAmount({ hourValue: vh, hours, ratePercent: rate });
      await db.from("payroll_novelties").insert({
        tenant_id: s.tenantId,
        employee_id: emp.id,
        period_year: year,
        period_month: month,
        concept: overtimeLabel(rate),
        amount,
        hours,
        rate_percent: rate,
        status: "approved",
        note: `auto-fichaje · ${hours} h × ${vh} × ${rate}%`,
      });
    }
  }
  revalidatePath("/rrhh/liquidacion");
  if (only) revalidatePath(`/rrhh/empleados/${only}`);
}

export async function updateNovelty(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const hours = Number(formData.get("hours") || 0);
  const ratePercent = Number(formData.get("rate_percent") || 0);
  const amountIn = Number(formData.get("amount") || 0);
  const db = createAdminClient();
  const { data: n } = await db
    .from("payroll_novelties")
    .select("id, employee_id, hours, rate_percent, amount")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!n) throw new Error("Novedad no encontrada.");
  let amount = amountIn;
  if (hours > 0 && ratePercent > 0) {
    const { data: emp } = await db.from("employees").select("base_salary, agreement_id").eq("id", n.employee_id).maybeSingle();
    let monthly = 176;
    if (emp?.agreement_id) {
      const { data: ag } = await db.from("collective_agreements").select("monthly_hours").eq("id", emp.agreement_id).maybeSingle();
      if (ag?.monthly_hours) monthly = Number(ag.monthly_hours);
    }
    const vh = hourValue(Number(emp?.base_salary ?? 0), monthly);
    amount = overtimeAmount({ hourValue: vh, hours, ratePercent });
  }
  await db
    .from("payroll_novelties")
    .update({ hours: hours || n.hours, rate_percent: ratePercent || n.rate_percent, amount })
    .eq("id", id)
    .eq("tenant_id", s.tenantId!);
  revalidatePath("/rrhh/liquidacion");
  revalidatePath(`/rrhh/empleados/${n.employee_id}`);
}

export async function deleteNovelty(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: n } = await db
    .from("payroll_novelties")
    .select("employee_id")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  await db.from("payroll_novelties").delete().eq("id", id).eq("tenant_id", s.tenantId!);
  revalidatePath("/rrhh/liquidacion");
  if (n?.employee_id) revalidatePath(`/rrhh/empleados/${n.employee_id}`);
}

export async function setBaseSalary(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  const { error } = await db
    .from("employees")
    .update({ base_salary: Number(formData.get("base_salary") || 0) })
    .eq("id", String(formData.get("employee_id")))
    .eq("tenant_id", s.tenantId!);
  if (error) throw new Error("No se pudo guardar el básico. Corré la migración 0002 en el editor SQL.");
  revalidatePath("/rrhh/liquidacion");
}

export async function runPayroll(formData: FormData) {
  const s = await requireStaff();
  const year = Number(formData.get("period_year"));
  const month = Number(formData.get("period_month"));
  const db = createAdminClient();

  const insert = await db
    .from("payroll_runs")
    .insert({
      tenant_id: s.tenantId,
      period_year: year,
      period_month: month,
      status: "closed",
      kind: "monthly",
      closed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const run =
    insert.data ??
    (
      await db
        .from("payroll_runs")
        .insert({ tenant_id: s.tenantId, period_year: year, period_month: month, status: "closed" })
        .select("id")
        .single()
    ).data;
  if (!run) throw new Error((insert.error?.message ?? "No se creó la liquidación") + " ¿Corriste 0002?");

  const { data: employees } = await db
    .from("employees")
    .select("id, first_name, last_name, base_salary, user_id")
    .eq("tenant_id", s.tenantId!)
    .eq("status", "active");

  const { data: novelties } = await db
    .from("payroll_novelties")
    .select("*")
    .eq("tenant_id", s.tenantId!)
    .eq("period_year", year)
    .eq("period_month", month)
    .eq("status", "approved");

  for (const emp of employees ?? []) {
    const base = Number(emp.base_salary ?? 0);
    const extra = (novelties ?? [])
      .filter((n) => n.employee_id === emp.id)
      .reduce((acc, n) => acc + Number(n.amount ?? 0), 0);
    const neto = base + extra;
    await db.from("payroll_items").insert([
      { tenant_id: s.tenantId, payroll_run_id: run.id, employee_id: emp.id, concept: "Sueldo básico", amount: base },
      { tenant_id: s.tenantId, payroll_run_id: run.id, employee_id: emp.id, concept: "Novedades", amount: extra },
      { tenant_id: s.tenantId, payroll_run_id: run.id, employee_id: emp.id, concept: "Neto", amount: neto },
    ]);
  }

  await db
    .from("payroll_novelties")
    .update({ status: "liquidated" })
    .eq("tenant_id", s.tenantId!)
    .eq("period_year", year)
    .eq("period_month", month);

  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: "publish",
    entityType: "payroll_run",
    entityId: run.id,
  });
  try {
    await generatePeriodReceipts({ tenantId: s.tenantId!, userId: s.userId, year, month });
  } catch {
    /* ponytail: liquidación ya cerró; RRHH puede generar recibos a mano */
  }
  revalidatePath("/rrhh/liquidacion");
  revalidatePath("/rrhh/recibos");
  revalidatePath("/empleado/recibos");
}
