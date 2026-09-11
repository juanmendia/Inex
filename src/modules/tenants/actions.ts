"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession, requireSuper, writeRolesCookie, writeTenantCookie } from "@/lib/auth/session";
import { RoleCode } from "@/types/enums";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "empresa"
  );
}

function easyPassword() {
  return `Inex${1000 + Math.floor(Math.random() * 9000)}Aa`;
}

async function setConfirmedPassword(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  password: string,
  app_metadata: Record<string, unknown>,
) {
  const { error } = await db.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    app_metadata,
  });
  if (error) throw new Error(error.message);
}

function roleError(error: { message?: string; code?: string } | null) {
  const msg = error?.message ?? "";
  if (msg.includes("user_roles_pkey") || msg.includes("(user_id, role)")) {
    return "Esta persona ya administra otra empresa. Corré en Supabase la migración 0004_empresas_convenios.sql para poder dar acceso a varias empresas.";
  }
  return msg || "No se pudo guardar el acceso.";
}

async function isPlatformUser(db: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await db
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", RoleCode.SUPER_ADMIN)
    .maybeSingle();
  return Boolean(data);
}

async function detachPlatformFromCompanies(db: ReturnType<typeof createAdminClient>) {
  const { data } = await db.from("user_roles").select("user_id").eq("role", RoleCode.SUPER_ADMIN);
  const ids = [...new Set((data ?? []).map((r) => r.user_id))];
  if (ids.length) {
    await db.from("user_roles").delete().in("user_id", ids).eq("role", RoleCode.TENANT_ADMIN);
  }
}
async function grantAdmin(db: ReturnType<typeof createAdminClient>, userId: string, tenantId: string) {
  if (await isPlatformUser(db, userId)) {
    throw new Error("La cuenta de plataforma no se asigna a empresas. Usá otro correo para el administrador de RRHH.");
  }
  const { data: existing, error: readErr } = await db
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", RoleCode.TENANT_ADMIN)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (readErr) throw new Error(roleError(readErr));
  if (!existing) {
    const { error } = await db
      .from("user_roles")
      .insert({ user_id: userId, role: RoleCode.TENANT_ADMIN, tenant_id: tenantId });
    if (error) throw new Error(roleError(error));
  }
  await db.from("profiles").update({ tenant_id: tenantId }).eq("id", userId).is("tenant_id", null);
}

async function findOrCreateAdmin(
  db: ReturnType<typeof createAdminClient>,
  email: string,
  fullName: string,
  tenantId: string,
) {
  const { data: listed } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = listed.users.find((u) => u.email?.toLowerCase() === email);
  if (found && (await isPlatformUser(db, found.id))) {
    throw new Error("Ese correo es de la consola de plataforma. El administrador de la empresa tiene que ser otra persona, con otro correo.");
  }
  if (found) {
    await db.from("profiles").upsert({
      id: found.id,
      email,
      full_name: fullName || found.user_metadata?.full_name || email,
      status: "active",
    });
    await grantAdmin(db, found.id, tenantId);
    if (!found.last_sign_in_at || found.app_metadata?.must_change_password) {
      const pass = easyPassword();
      await setConfirmedPassword(db, found.id, pass, {
        ...found.app_metadata,
        roles: [RoleCode.TENANT_ADMIN],
        must_change_password: true,
      });
      return {
        message: `${email} entra con clave temporal ${pass}. Obligatorio cambiarla en el primer ingreso.`,
      };
    }
    return {
      message: `Acceso guardado. ${email} entra con su correo y la contraseña que ya tiene.`,
    };
  }

  const pass = easyPassword();
  const created = await db.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { roles: [RoleCode.TENANT_ADMIN], must_change_password: true },
  });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "No se pudo crear el usuario.");
  const userId = created.data.user.id;
  await db.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName || email,
    tenant_id: tenantId,
    status: "active",
  });
  await grantAdmin(db, userId, tenantId);
  return {
    message: `Listo. ${email} entra con esa cuenta y clave temporal ${pass}. Obligatorio cambiarla en el primer ingreso.`,
  };
}

export async function createTenant(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireSuper();
  const name = String(formData.get("name") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "")
    .trim()
    .toLowerCase();
  const adminName = String(formData.get("admin_name") ?? "").trim();
  if (!name) return "Nombre obligatorio.";
  if (!adminEmail) return "Indicá el correo del administrador de RRHH de esta empresa.";

  const db = createAdminClient();
  await detachPlatformFromCompanies(db);
  let slug = slugify(name);
  const { data: clash } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
  const { data, error } = await db.from("tenants").insert({ name, slug, status: "active" }).select("id").single();
  if (error) return error.message;
  await db.from("tenant_settings").insert({ tenant_id: data.id, legal_name: name });

  try {
    const r = await findOrCreateAdmin(db, adminEmail, adminName, data.id);
    revalidatePath("/admin");
    return r.message;
  } catch (e) {
    revalidatePath("/admin");
    return e instanceof Error ? e.message : "La empresa se creó, pero falló el acceso de RRHH.";
  }
}

export async function grantTenantAccess(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireSuper();
  const tenantId = String(formData.get("tenant_id"));
  const email = String(formData.get("admin_email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("admin_name") ?? "").trim();
  if (!tenantId || !email) return "Correo obligatorio.";
  const db = createAdminClient();
  await detachPlatformFromCompanies(db);
  try {
    const r = await findOrCreateAdmin(db, email, name, tenantId);
    revalidatePath("/admin");
    return r.message;
  } catch (e) {
    return e instanceof Error ? e.message : "No se pudo dar acceso.";
  }
}

export async function inviteSuperAdmin(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireSuper();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("name") ?? "").trim();
  if (!email) return "Correo obligatorio.";

  const db = createAdminClient();
  const { data: listed } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = listed.users.find((u) => u.email?.toLowerCase() === email);

  const pass = easyPassword();
  let userId = found?.id;
  if (found) {
    const { data: other } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", found.id)
      .neq("role", RoleCode.SUPER_ADMIN);
    if ((other ?? []).length) {
      return "Ese correo ya opera una empresa o es empleado. La consola de plataforma usa otro correo, no mezclado.";
    }
    if (await isPlatformUser(db, found.id)) return "Esa persona ya es superadmin.";
  } else {
    const created = await db.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { roles: [RoleCode.SUPER_ADMIN], must_change_password: true },
    });
    if (created.error || !created.data.user) return created.error?.message ?? "No se pudo crear el usuario.";
    userId = created.data.user.id;
  }

  await db.from("profiles").upsert({
    id: userId!,
    email,
    full_name: fullName || found?.user_metadata?.full_name || email,
    tenant_id: null,
    status: "active",
  });
  const { data: has } = await db
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId!)
    .eq("role", RoleCode.SUPER_ADMIN)
    .maybeSingle();
  if (!has) {
    const { error } = await db.from("user_roles").insert({
      user_id: userId!,
      role: RoleCode.SUPER_ADMIN,
      tenant_id: null,
    });
    if (error) return roleError(error);
  }
  await setConfirmedPassword(db, userId!, pass, {
    ...(found?.app_metadata ?? {}),
    roles: [RoleCode.SUPER_ADMIN],
    must_change_password: true,
  });
  revalidatePath("/admin");
  return `Superadmin listo. ${email} entra con clave temporal ${pass} y la cambia al primer ingreso.`;
}

export async function revokeSuperAdmin(formData: FormData) {
  const s = await requireSuper();
  const userId = String(formData.get("user_id"));
  if (userId === s.userId) return;
  const db = createAdminClient();
  const { data: supers } = await db.from("user_roles").select("user_id").eq("role", RoleCode.SUPER_ADMIN);
  if ((supers ?? []).length <= 1) return;
  await db.from("user_roles").delete().eq("user_id", userId).eq("role", RoleCode.SUPER_ADMIN);
  revalidatePath("/admin");
}

export async function sanitizePlatformAdmins() {
  await requireSuper();
  await detachPlatformFromCompanies(createAdminClient());
}

export async function resetTempPassword(_prev: string | null, formData: FormData): Promise<string | null> {
  await requireSuper();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return "Falta el correo.";
  const db = createAdminClient();
  const { data: listed } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = listed.users.find((u) => u.email?.toLowerCase() === email);
  if (!found) return "No hay usuario con ese correo.";
  if (email.endsWith("@inex.demo")) {
    try {
      await setConfirmedPassword(db, found.id, "InexDemo123!", {
        ...found.app_metadata,
        must_change_password: false,
      });
    } catch (e) {
      return e instanceof Error ? e.message : "No se pudo guardar la clave.";
    }
    revalidatePath("/admin");
    return "Cuenta demo: clave InexDemo123! (no se rota).";
  }
  const pass = easyPassword();
  try {
    await setConfirmedPassword(db, found.id, pass, {
      ...found.app_metadata,
      must_change_password: true,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "No se pudo guardar la clave.";
  }
  revalidatePath("/admin");
  return `Clave temporal: ${pass} — ${email} la cambia al primer ingreso.`;
}

export async function revokeTenantAccess(formData: FormData) {
  try {
    await requireSuper();
    const tenantId = String(formData.get("tenant_id"));
    const userId = String(formData.get("user_id"));
    const db = createAdminClient();
    const { error } = await db
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", RoleCode.TENANT_ADMIN)
      .eq("tenant_id", tenantId);
    if (error) {
      await db.from("user_roles").delete().eq("user_id", userId).eq("role", RoleCode.TENANT_ADMIN);
    }
    revalidatePath("/admin");
  } catch {
    revalidatePath("/admin");
  }
}

export async function enterTenant(formData: FormData) {
  const s = await requireSession();
  if (s.roles.includes(RoleCode.SUPER_ADMIN)) redirect("/admin");
  const tenantId = String(formData.get("tenant_id"));
  if (!tenantId || !s.memberships.some((m) => m.id === tenantId)) return;
  await writeTenantCookie(tenantId);
  const db = createAdminClient();
  await db.from("profiles").update({ tenant_id: tenantId }).eq("id", s.userId);
  await writeRolesCookie([...new Set([...s.roles.filter((r) => r !== RoleCode.SUPER_ADMIN), RoleCode.TENANT_ADMIN])]);
  redirect("/rrhh");
}

export async function deleteTenant(formData: FormData) {
  await requireSuper();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = createAdminClient();
  const { data: roleUsers } = await db.from("user_roles").select("user_id").eq("tenant_id", id);
  const { data: empUsers } = await db.from("employees").select("user_id").eq("tenant_id", id);
  const maybeOrphans = [
    ...new Set(
      [...(roleUsers ?? []), ...(empUsers ?? [])]
        .map((r) => r.user_id)
        .filter(Boolean) as string[],
    ),
  ];

  await db.from("user_roles").delete().eq("tenant_id", id);
  await db.from("profiles").update({ tenant_id: null }).eq("tenant_id", id);
  await db.from("employees").update({ work_location_id: null, agreement_id: null }).eq("tenant_id", id);
  const { error } = await db.from("tenants").delete().eq("id", id);
  if (error) {
    revalidatePath("/admin");
    return;
  }

  for (const userId of maybeOrphans) {
    const { data: leftover } = await db.from("user_roles").select("role").eq("user_id", userId);
    if ((leftover ?? []).some((r) => r.role === RoleCode.SUPER_ADMIN)) continue;
    if ((leftover ?? []).length) continue;
    await db.auth.admin.deleteUser(userId);
  }
  revalidatePath("/admin");
}

export async function toggleTenant(formData: FormData) {
  try {
    await requireSuper();
    const id = String(formData.get("id"));
    const status = String(formData.get("status")) === "active" ? "suspended" : "active";
    const db = createAdminClient();
    await db.from("tenants").update({ status }).eq("id", id);
    revalidatePath("/admin");
  } catch {
    revalidatePath("/admin");
  }
}
