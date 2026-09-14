"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { TYPICAL_AGREEMENTS } from "@/lib/agreements-catalog";
import { takeHome } from "@/lib/pay";

async function syncAgreementPay(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  agreementId: string,
  scale: number,
) {
  const { data: people } = await db
    .from("employees")
    .select("id, salary_addon")
    .eq("tenant_id", tenantId)
    .eq("agreement_id", agreementId);
  for (const p of people ?? []) {
    const addon = Number((p as { salary_addon?: number }).salary_addon ?? 0);
    await db.from("employees").update({ base_salary: takeHome(scale, addon) }).eq("id", p.id);
  }
}

export async function saveAgreement(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  const id = String(formData.get("id") ?? "");
  const row = {
    tenant_id: s.tenantId!,
    name: String(formData.get("name") ?? "").trim(),
    monthly_hours: Number(formData.get("monthly_hours") || 0) || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    scale_amount: Number(formData.get("scale_amount") || 0) || null,
    day_start: String(formData.get("day_start") ?? "") || null,
    day_end: String(formData.get("day_end") ?? "") || null,
    afternoon_start: String(formData.get("afternoon_start") ?? "") || null,
    afternoon_end: String(formData.get("afternoon_end") ?? "") || null,
    rate_weekday: Number(formData.get("rate_weekday") || 150) || 150,
    rate_saturday: Number(formData.get("rate_saturday") || 200) || 200,
    rate_sunday: Number(formData.get("rate_sunday") || 200) || 200,
    rate_holiday: Number(formData.get("rate_holiday") || 200) || 200,
    rate_night: Number(formData.get("rate_night") || 200) || 200,
  };
  if (!row.name) throw new Error("Nombre del convenio obligatorio.");
  if (id) {
    let { error } = await db.from("collective_agreements").update(row).eq("id", id).eq("tenant_id", s.tenantId!);
    if (error) {
      const {
        scale_amount: _s,
        day_start: _a,
        day_end: _b,
        afternoon_start: _c,
        afternoon_end: _d,
        rate_weekday: _w,
        rate_saturday: _sa,
        rate_sunday: _su,
        rate_holiday: _h,
        rate_night: _n,
        ...basic
      } = row;
      const retry = await db.from("collective_agreements").update(basic).eq("id", id).eq("tenant_id", s.tenantId!);
      if (retry.error) throw new Error(retry.error.message);
    } else if (row.scale_amount) {
      await syncAgreementPay(db, s.tenantId!, id, row.scale_amount);
    }
    revalidatePath("/rrhh/convenios");
    revalidatePath("/rrhh/empleados");
    revalidatePath("/rrhh/liquidacion");
    redirect("/rrhh/convenios");
  } else {
    const { error } = await db.from("collective_agreements").insert(row);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/rrhh/convenios");
  revalidatePath("/rrhh/empleados");
}

export async function addAgreement() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: existing } = await db.from("collective_agreements").select("name").eq("tenant_id", s.tenantId!);
  const have = new Set((existing ?? []).map((r) => r.name));
  let name = "Nuevo convenio";
  let n = 2;
  while (have.has(name)) {
    name = `Nuevo convenio ${n}`;
    n += 1;
  }
  const { data, error } = await db
    .from("collective_agreements")
    .insert({
      tenant_id: s.tenantId,
      name,
      monthly_hours: 176,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo agregar.");
  revalidatePath("/rrhh/convenios");
  revalidatePath("/rrhh/empleados");
  redirect(`/rrhh/convenios?edit=${data.id}`);
}

export async function addTypicalAgreement(formData: FormData) {
  const s = await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  const found = TYPICAL_AGREEMENTS.find((a) => a.name === name);
  if (!found) return;
  const db = createAdminClient();
  const { data, error } = await db
    .from("collective_agreements")
    .insert({
      tenant_id: s.tenantId,
      name: found.name,
      monthly_hours: found.monthly_hours,
      notes: found.notes,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.message.toLowerCase().includes("duplicate")) return;
    throw new Error(error?.message ?? "No se pudo agregar.");
  }
  revalidatePath("/rrhh/convenios");
  revalidatePath("/rrhh/empleados");
  redirect(`/rrhh/convenios?edit=${data.id}`);
}

export async function deleteAgreement(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db.from("employees").update({ agreement_id: null }).eq("agreement_id", id).eq("tenant_id", s.tenantId!);
  const { error } = await db.from("collective_agreements").delete().eq("id", id).eq("tenant_id", s.tenantId!);
  if (error) throw new Error(error.message);
  revalidatePath("/rrhh/convenios");
  revalidatePath("/rrhh/empleados");
}

export async function applyAgreementRaise(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: ag } = await db
    .from("collective_agreements")
    .select("id, scale_amount, name")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!ag) throw new Error("Convenio no encontrado.");
  const previous = Number(ag.scale_amount ?? 0);
  const percent = Number(formData.get("percent") || 0);
  const amount = Number(formData.get("new_amount") || 0);
  const next = percent ? Math.round(previous * (1 + percent / 100) * 100) / 100 : amount;
  if (next <= 0) throw new Error("Indicá el nuevo básico del convenio o un %.");
  const { error } = await db
    .from("collective_agreements")
    .update({ scale_amount: next })
    .eq("id", id)
    .eq("tenant_id", s.tenantId!);
  if (error) throw new Error("No se pudo guardar la escala. Corré 0010_convenio_escala.sql en Supabase.");
  await syncAgreementPay(db, s.tenantId!, id, next);
  const { data: people } = await db
    .from("employees")
    .select("id, salary_addon, base_salary")
    .eq("tenant_id", s.tenantId!)
    .eq("agreement_id", id);
  const on = String(formData.get("effective_on") || "") || new Date().toISOString().slice(0, 10);
  const note = String(formData.get("note") ?? "").trim() || `Aumento convenio ${ag.name}`;
  for (const p of people ?? []) {
    await db.from("salary_changes").insert({
      tenant_id: s.tenantId,
      employee_id: p.id,
      previous_amount: Number(p.base_salary ?? 0),
      new_amount: takeHome(next, Number((p as { salary_addon?: number }).salary_addon ?? 0)),
      percent: percent || null,
      effective_on: on,
      note,
    });
  }
  revalidatePath("/rrhh/convenios");
  revalidatePath("/rrhh/liquidacion");
  revalidatePath("/rrhh/empleados");
  redirect(`/rrhh/convenios?edit=${id}`);
}

export async function saveEmployeeAddon(formData: FormData) {
  const s = await requireStaff();
  const employeeId = String(formData.get("employee_id"));
  const addon = Number(formData.get("salary_addon") || 0);
  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("id, agreement_id, base_salary")
    .eq("id", employeeId)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!emp) throw new Error("Empleado no encontrado.");
  let scale = 0;
  if (emp.agreement_id) {
    const { data: ag } = await db.from("collective_agreements").select("scale_amount").eq("id", emp.agreement_id).maybeSingle();
    scale = Number(ag?.scale_amount ?? 0);
  }
  const next = scale > 0 ? takeHome(scale, addon) : addon;
  let { error } = await db
    .from("employees")
    .update({ salary_addon: addon, base_salary: next })
    .eq("id", employeeId)
    .eq("tenant_id", s.tenantId!);
  if (error) {
    const retry = await db.from("employees").update({ base_salary: next }).eq("id", employeeId).eq("tenant_id", s.tenantId!);
    if (retry.error) throw new Error(retry.error.message);
  }
  revalidatePath("/rrhh/liquidacion");
  revalidatePath(`/rrhh/empleados/${employeeId}`);
}

export async function applySalaryChange(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  const employeeId = String(formData.get("employee_id"));
  const { data: emp } = await db
    .from("employees")
    .select("base_salary")
    .eq("id", employeeId)
    .eq("tenant_id", s.tenantId!)
    .single();
  const previous = Number(emp?.base_salary ?? 0);
  const percent = Number(formData.get("percent") || 0);
  const amount = Number(formData.get("new_amount") || 0);
  const next = percent ? Math.round(previous * (1 + percent / 100) * 100) / 100 : amount;
  if (next <= 0) throw new Error("Indicá el nuevo sueldo o un porcentaje.");
  const { error } = await db
    .from("employees")
    .update({ base_salary: next })
    .eq("id", employeeId)
    .eq("tenant_id", s.tenantId!);
  if (error) throw new Error(error.message);
  await db.from("salary_changes").insert({
    tenant_id: s.tenantId,
    employee_id: employeeId,
    previous_amount: previous,
    new_amount: next,
    percent: percent || null,
    effective_on: String(formData.get("effective_on") || "") || new Date().toISOString().slice(0, 10),
    note: String(formData.get("note") ?? "").trim() || null,
  });
  revalidatePath("/rrhh/liquidacion");
  revalidatePath(`/rrhh/empleados/${employeeId}`);
}
