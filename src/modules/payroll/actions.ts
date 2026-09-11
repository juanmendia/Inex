"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/files";

import { hourValue, overtimeAmount, overtimeLabel } from "@/lib/labels";

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
  revalidatePath("/rrhh/liquidacion");
}
