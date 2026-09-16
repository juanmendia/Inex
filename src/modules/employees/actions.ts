"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/files";
import { sendEmployeeAccessEmail } from "@/lib/mail";
import { takeHome } from "@/lib/pay";

export async function createEmployee(_prev: string | null, formData: FormData): Promise<string | null> {
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
    agreement_id: String(formData.get("agreement_id") ?? "") || null,
    status: "active" as const,
  };
  if (!row.employee_number || !row.first_name || !row.last_name) {
    return "Legajo, nombre y apellido son obligatorios.";
  }
  if (!row.dni) return "El DNI es el usuario de ingreso. Es obligatorio.";
  if (!row.email) return "El correo personal es obligatorio: ahí recibe el recupero de clave.";

  const dni = row.dni.replace(/\D/g, "");
  row.dni = dni;
  const email = row.email.toLowerCase();
  row.email = email;

  const { data: dniTaken } = await db
    .from("employees")
    .select("id, tenant_id")
    .eq("dni", dni)
    .maybeSingle();
  if (dniTaken) {
    if (dniTaken.tenant_id === s.tenantId) {
      return "Ese DNI ya está en esta empresa. Mirá la lista de abajo.";
    }
    return "Ese DNI ya es usuario en otra empresa de Inex. El DNI es el login y no se puede repetir.";
  }

  const pass = `Inex${1000 + Math.floor(Math.random() * 9000)}Aa`;
  const created = await db.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    user_metadata: { full_name: `${row.first_name} ${row.last_name}`, dni },
    app_metadata: { roles: ["employee"], must_change_password: true, dni },
  });
  if (created.error || !created.data.user) {
    return "No se pudo crear el acceso. ¿El correo ya está usado en otra cuenta?";
  }
  const userId = created.data.user.id;
  await db
    .from("profiles")
    .upsert({ id: userId, email, full_name: `${row.first_name} ${row.last_name}`, tenant_id: s.tenantId, status: "active" });
  await db.from("user_roles").insert({ user_id: userId, role: "employee", tenant_id: s.tenantId });

  const { data, error } = await db.from("employees").insert({ ...row, user_id: userId, temp_password: pass }).select("id").single();
  let empId = data?.id as string | undefined;
  if (error || !data) {
    const retry = await db.from("employees").insert({ ...row, user_id: userId }).select("id").single();
    if (retry.error || !retry.data) {
      await db.auth.admin.deleteUser(userId);
      return (error ?? retry.error)?.message ?? "No se pudo guardar la ficha.";
    }
    empId = retry.data.id;
    await rememberTemp(db, retry.data.id, pass);
  } else {
    await rememberTemp(db, data.id, pass);
  }
  const agreementId = String(formData.get("agreement_id") ?? "") || null;
  if (agreementId && empId) {
    const { data: ag } = await db.from("collective_agreements").select("scale_amount").eq("id", agreementId).maybeSingle();
    if (ag?.scale_amount) {
      await db.from("employees").update({ base_salary: takeHome(Number(ag.scale_amount), 0) }).eq("id", empId);
    }
  }
  const mail = await sendEmployeeAccessEmail({
    to: email,
    name: `${row.first_name} ${row.last_name}`,
    dni,
    pass,
    company: await companyName(db, s.tenantId!),
  });
  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: "create",
    entityType: "employee",
  });
  revalidatePath("/rrhh/empleados");
  revalidatePath("/rrhh");
  return `OK|${dni}|${pass}|${mail.ok ? "mail" : mail.reason}`;
}

async function rememberTemp(
  db: ReturnType<typeof createAdminClient>,
  employeeId: string,
  pass: string,
) {
  const { error } = await db.from("employees").update({ temp_password: pass }).eq("id", employeeId);
  if (error) {
    // ponytail: falta 0008_temp_password.sql; la clave igual se muestra en pantalla.
  }
}

async function companyName(db: ReturnType<typeof createAdminClient>, tenantId: string) {
  const { data } = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  return data?.name ?? "tu empresa";
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
  const agreementId = String(formData.get("agreement_id") ?? "") || null;
  if (agreementId) {
    const { data: ag } = await db.from("collective_agreements").select("scale_amount").eq("id", agreementId).maybeSingle();
    const { data: emp } = await db.from("employees").select("salary_addon").eq("id", id).maybeSingle();
    if (ag?.scale_amount) {
      await db
        .from("employees")
        .update({
          base_salary: takeHome(Number(ag.scale_amount), Number((emp as { salary_addon?: number } | null)?.salary_addon ?? 0)),
        })
        .eq("id", id);
    }
  }
  await audit({ tenantId: s.tenantId, userId: s.userId, action: "update", entityType: "employee", entityId: id });
  revalidatePath(`/rrhh/empleados/${id}`);
  revalidatePath("/rrhh/empleados");
}

export async function toggleEmployee(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) === "active" ? "inactive" : "active";
  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("user_id")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  const patch: Record<string, unknown> = { status };
  if (status === "active") {
    patch.terminated_at = null;
    patch.termination_reason = null;
  }
  let { error } = await db.from("employees").update(patch).eq("id", id).eq("tenant_id", s.tenantId!);
  if (error) {
    const retry = await db.from("employees").update({ status }).eq("id", id).eq("tenant_id", s.tenantId!);
    if (retry.error) throw new Error(retry.error.message);
  }
  await setPortal(db, emp?.user_id ?? null, status === "active");
  revalidatePath("/rrhh/empleados");
  revalidatePath(`/rrhh/empleados/${id}`);
}

async function setPortal(db: ReturnType<typeof createAdminClient>, userId: string | null, enabled: boolean) {
  if (!userId) return;
  await db.from("profiles").update({ status: enabled ? "active" : "disabled" }).eq("id", userId);
  await db.auth.admin.updateUserById(userId, { ban_duration: enabled ? "none" : "876000h" });
}

export async function resetPunchDevice(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db.from("employees").update({ punch_device_id: null }).eq("id", id).eq("tenant_id", s.tenantId!);
  revalidatePath(`/rrhh/empleados/${id}`);
  revalidatePath("/rrhh/empleados");
}

export async function validateFacePhoto(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db.from("employees").update({ face_photo_validated: true }).eq("id", id).eq("tenant_id", s.tenantId!);
  revalidatePath(`/rrhh/empleados/${id}`);
}

export async function deleteFacePhoto(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db.from("employees").update({ face_photo_path: null, face_photo_validated: false, face_descriptor: null }).eq("id", id).eq("tenant_id", s.tenantId!);
  revalidatePath(`/rrhh/empleados/${id}`);
  revalidatePath("/empleado");
}

export async function offboardEmployee(_prev: string | null, formData: FormData): Promise<string | null> {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const terminatedAt = String(formData.get("terminated_at") ?? "") || new Date().toISOString().slice(0, 10);
  const reason = String(formData.get("reason") ?? "").trim();
  const concepts = [
    ["Días del mes / sueldo proporcional", Number(formData.get("days_pay") || 0)],
    ["SAC proporcional", Number(formData.get("sac") || 0)],
    ["Vacaciones no gozadas", Number(formData.get("vacation") || 0)],
    ["Indemnización / otros", Number(formData.get("severance") || 0)],
  ].filter(([, n]) => Number(n) > 0) as [string, number][];

  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("id, user_id, first_name, last_name, base_salary")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!emp) return "No encontramos la ficha.";

  const when = new Date(terminatedAt);
  const year = when.getFullYear();
  const month = when.getMonth() + 1;

  if (concepts.length) {
    const insert = await db
      .from("payroll_runs")
      .insert({
        tenant_id: s.tenantId,
        period_year: year,
        period_month: month,
        status: "closed",
        kind: "final",
        closed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const runId = insert.data?.id;
    if (runId) {
      const neto = concepts.reduce((acc, [, n]) => acc + n, 0);
      await db.from("payroll_items").insert([
        ...concepts.map(([concept, amount]) => ({
          tenant_id: s.tenantId,
          payroll_run_id: runId,
          employee_id: emp.id,
          concept,
          amount,
        })),
        { tenant_id: s.tenantId, payroll_run_id: runId, employee_id: emp.id, concept: "Neto liquidación final", amount: neto },
      ]);
    }
  }

  const patch: Record<string, unknown> = {
    status: "inactive",
    terminated_at: terminatedAt,
    termination_reason: reason || null,
  };
  const { error } = await db.from("employees").update(patch).eq("id", id).eq("tenant_id", s.tenantId!);
  if (error) {
    const retry = await db.from("employees").update({ status: "inactive" }).eq("id", id).eq("tenant_id", s.tenantId!);
    if (retry.error) return retry.error.message + " ¿Corriste 0007_baja.sql?";
  }
  await setPortal(db, emp.user_id ?? null, false);
  await audit({ tenantId: s.tenantId, userId: s.userId, action: "update", entityType: "employee", entityId: id });
  revalidatePath("/rrhh/empleados");
  revalidatePath(`/rrhh/empleados/${id}`);
  revalidatePath("/rrhh/liquidacion");
  return concepts.length
    ? "Baja hecha: ya no entra al portal. Quedó la liquidación final en Liquidación."
    : "Baja hecha: ya no entra al portal. La ficha y los recibos se conservan.";
}

export async function resetEmployeePassword(_prev: string | null, formData: FormData): Promise<string | null> {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("user_id, dni, email, first_name, last_name")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!emp?.user_id) return "Esa ficha no tiene acceso.";
  const pass = `Inex${1000 + Math.floor(Math.random() * 9000)}Aa`;
  const { error } = await db.auth.admin.updateUserById(emp.user_id, {
    password: pass,
    email_confirm: true,
    app_metadata: { roles: ["employee"], must_change_password: true, dni: emp.dni },
  });
  if (error) return error.message;
  await rememberTemp(db, id, pass);
  const mail = emp.email
    ? await sendEmployeeAccessEmail({
        to: emp.email,
        name: `${emp.first_name} ${emp.last_name}`,
        dni: emp.dni ?? "",
        pass,
        company: await companyName(db, s.tenantId!),
      })
    : { ok: false as const, reason: "no_mailer" };
  revalidatePath("/rrhh/empleados");
  return `OK|${emp.dni ?? ""}|${pass}|${mail.ok ? "mail" : mail.reason}`;
}
