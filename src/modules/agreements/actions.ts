"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";

export async function saveAgreement(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  const id = String(formData.get("id") ?? "");
  const row = {
    tenant_id: s.tenantId!,
    name: String(formData.get("name") ?? "").trim(),
    monthly_hours: Number(formData.get("monthly_hours") || 0) || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  if (!row.name) throw new Error("Nombre del convenio obligatorio.");
  if (id) {
    const { error } = await db.from("collective_agreements").update(row).eq("id", id).eq("tenant_id", s.tenantId!);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("collective_agreements").insert(row);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/rrhh/convenios");
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
