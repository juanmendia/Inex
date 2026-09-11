"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/files";

export async function createEmployee(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  const row = {
    tenant_id: s.tenantId!,
    employee_number: String(formData.get("employee_number") ?? "").trim(),
    first_name: String(formData.get("first_name") ?? "").trim(),
    last_name: String(formData.get("last_name") ?? "").trim(),
    dni: String(formData.get("dni") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    birth_date: String(formData.get("birth_date") ?? "") || null,
    hire_date: String(formData.get("hire_date") ?? "") || null,
    work_location_id: String(formData.get("work_location_id") ?? "") || null,
    status: "active" as const,
  };
  if (!row.employee_number || !row.first_name || !row.last_name) {
    throw new Error("Legajo, nombre y apellido son obligatorios.");
  }
  if (!row.dni) throw new Error("El DNI es el usuario de ingreso. Es obligatorio.");
  if (!row.email) throw new Error("El correo personal es obligatorio: ahí recibe el recupero de clave.");

  const dni = row.dni.replace(/\D/g, "");
  row.dni = dni;
  const email = row.email.toLowerCase();
  row.email = email;

  const { data: dniTaken } = await db.from("employees").select("id").eq("dni", dni).maybeSingle();
  if (dniTaken) throw new Error("Ese DNI ya tiene una ficha. El usuario de ingreso debe ser único.");

  const temp = `Tmp.${crypto.randomUUID().slice(0, 10)}aA1`;
  const created = await db.auth.admin.createUser({
    email,
    password: temp,
    email_confirm: true,
    user_metadata: { full_name: `${row.first_name} ${row.last_name}`, dni },
    app_metadata: { roles: ["employee"], must_change_password: true, dni },
  });
  if (created.error || !created.data.user) {
    throw new Error("No se pudo crear el acceso. ¿El correo ya está usado en otra cuenta?");
  }
  const userId = created.data.user.id;
  await db
    .from("profiles")
    .upsert({ id: userId, email, full_name: `${row.first_name} ${row.last_name}`, tenant_id: s.tenantId, status: "active" });
  await db.from("user_roles").insert({ user_id: userId, role: "employee", tenant_id: s.tenantId });

  const { error } = await db.from("employees").insert({ ...row, user_id: userId });
  if (error) {
    await db.auth.admin.deleteUser(userId);
    throw new Error(error.message);
  }
  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: "create",
    entityType: "employee",
  });
  revalidatePath("/rrhh/empleados");
  revalidatePath("/rrhh");
}

async function upsertNamed(
  db: ReturnType<typeof createAdminClient>,
  table: "departments" | "positions",
  tenantId: string,
  name: string,
) {
  const n = name.trim();
  if (!n) return null;
  const { data: existing } = await db.from(table).select("id").eq("tenant_id", tenantId).eq("name", n).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await db.from(table).insert({ tenant_id: tenantId, name: n }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateEmployee(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const department_id = await upsertNamed(db, "departments", s.tenantId!, String(formData.get("department") ?? ""));
  const position_id = await upsertNamed(db, "positions", s.tenantId!, String(formData.get("position") ?? ""));
  const { error } = await db
    .from("employees")
    .update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      dni: String(formData.get("dni") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      birth_date: String(formData.get("birth_date") ?? "") || null,
      hire_date: String(formData.get("hire_date") ?? "") || null,
      employee_number: String(formData.get("employee_number") ?? "").trim(),
      agreement_id: String(formData.get("agreement_id") ?? "") || null,
      work_location_id: String(formData.get("work_location_id") ?? "") || null,
      department_id,
      position_id,
    })
    .eq("id", id)
    .eq("tenant_id", s.tenantId!);
  if (error) throw new Error(error.message);
  await audit({ tenantId: s.tenantId, userId: s.userId, action: "update", entityType: "employee", entityId: id });
  revalidatePath(`/rrhh/empleados/${id}`);
  revalidatePath("/rrhh/empleados");
}

export async function toggleEmployee(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) === "active" ? "inactive" : "active";
  const db = createAdminClient();
  const { error } = await db.from("employees").update({ status }).eq("id", id).eq("tenant_id", s.tenantId!);
  if (error) throw new Error(error.message);
  revalidatePath("/rrhh/empleados");
}
