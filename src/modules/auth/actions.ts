"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { homeForRoles, STAFF_ROLES } from "@/lib/auth/roles";
import { clearRolesCookie, writeRolesCookie, writeTenantCookie } from "@/lib/auth/session";
import { requestOrigin } from "@/lib/origin";

function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

async function emailFromIdentifier(identifier: string) {
  const admin = createAdminClient();
  if (identifier.includes("@")) return identifier.toLowerCase();
  const dni = onlyDigits(identifier);
  if (!dni) return null;
  const { data } = await admin.from("employees").select("email, user_id").eq("dni", dni).maybeSingle();
  if (data?.email) return data.email.toLowerCase();
  if (data?.user_id) {
    const { data: p } = await admin.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
    return p?.email?.toLowerCase() ?? null;
  }
  return null;
}

async function finishLogin(userId: string) {
  const admin = createAdminClient();
  const { data: roleRows } = await admin.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  let roles = [...new Set((roleRows ?? []).map((r) => r.role as string))];
  if (roles.includes("super_admin")) roles = ["super_admin"];
  if (roles.length === 0) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { error: "Tu usuario no tiene un rol asignado." as const };
  }
  const staffTenants = roles.includes("super_admin")
    ? []
    : [
        ...new Set(
          (roleRows ?? [])
            .filter((r) => STAFF_ROLES.includes(r.role as (typeof STAFF_ROLES)[number]) && r.tenant_id)
            .map((r) => r.tenant_id as string),
        ),
      ];
  if (staffTenants.length === 1) await writeTenantCookie(staffTenants[0]!);
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const must = Boolean(user.user?.app_metadata?.must_change_password);
  await writeRolesCookie(roles);
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...user.user?.app_metadata, roles, must_change_password: must },
  });
  if (must) redirect("/login/clave");
  redirect(homeForRoles(roles));
}

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const identifier = String(formData.get("user") ?? formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return "Completá usuario y contraseña.";

  const email = await emailFromIdentifier(identifier);
  if (!email) return "Usuario o contraseña incorrectos.";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return "Usuario o contraseña incorrectos.";
  const result = await finishLogin(data.user.id);
  return result.error;
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearRolesCookie();
  redirect("/login");
}

export async function activateAccount(_prev: string | null, formData: FormData): Promise<string | null> {
  const dni = onlyDigits(String(formData.get("dni") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!dni || !email || !password) return "Completá DNI, correo y contraseña.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password !== confirm) return "Las contraseñas no coinciden.";

  const admin = createAdminClient();
  const { data: emp } = await admin
    .from("employees")
    .select("id, user_id, email, status")
    .eq("dni", dni)
    .maybeSingle();
  if (!emp?.user_id) return "No encontramos un acceso con ese DNI. Pedile a RRHH que te dé de alta.";
  if (emp.status !== "active") return "Tu ficha no está activa.";
  if ((emp.email ?? "").toLowerCase() !== email) return "El correo no coincide con el registrado por RRHH.";

  const { error } = await admin.auth.admin.updateUserById(emp.user_id, {
    password,
    app_metadata: { roles: ["employee"], must_change_password: false, dni },
  });
  if (error) return "No se pudo activar la cuenta. Probá de nuevo.";

  const supabase = await createClient();
  const { data, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr || !data.user) return "Cuenta activada. Ingresá con tu DNI y la clave que definiste.";
  await writeRolesCookie(["employee"]);
  redirect("/empleado");
}

export async function setPasswordFirstTime(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password !== confirm) return "Las contraseñas no coinciden.";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sesión vencida. Volvé a ingresar.";
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return "No se pudo guardar la contraseña.";
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, must_change_password: false },
  });
  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role as string);
  redirect(homeForRoles(roles));
}

export async function requestPasswordReset(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const identifier = String(formData.get("user") ?? formData.get("email") ?? "").trim();
  if (!identifier) return "Ingresá tu DNI o correo personal.";
  const email = await emailFromIdentifier(identifier);
  if (!email) {
    return "Si los datos son correctos, vas a recibir un enlace en tu correo personal.";
  }
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/login/nueva-clave`,
  });
  if (error) return "No se pudo enviar el correo. Probá de nuevo.";
  return "Si los datos coinciden, te enviamos un enlace a tu correo personal.";
}

export async function completeRecovery(_prev: string | null, formData: FormData): Promise<string | null> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password !== confirm) return "Las contraseñas no coinciden.";
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return "El enlace venció o es inválido. Pedí uno nuevo.";
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, must_change_password: false },
    });
  }
  redirect("/login");
}
