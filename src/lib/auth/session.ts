import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { homeForRoles, isStaff, ROLES_COOKIE, STAFF_ROLES, TENANT_COOKIE } from "@/lib/auth/roles";
import { RoleCode, type RoleCode as Role } from "@/types/enums";

export type TenantMembership = { id: string; name: string };

export type SessionContext = {
  userId: string;
  email: string;
  tenantId: string | null;
  roles: Role[];
  fullName: string | null;
  memberships: TenantMembership[];
};

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    admin.from("profiles").select("tenant_id, full_name, email, status").eq("id", user.id).maybeSingle(),
    admin.from("user_roles").select("role, tenant_id").eq("user_id", user.id),
  ]);

  if (profile?.status === "disabled") return null;

  const allRoles = [...new Set((roleRows ?? []).map((r) => r.role as Role))];
  const isSuper = allRoles.includes(RoleCode.SUPER_ADMIN);
  if (isSuper) {
    return {
      userId: user.id,
      email: profile?.email ?? user.email ?? "",
      tenantId: null,
      roles: [RoleCode.SUPER_ADMIN],
      fullName: profile?.full_name ?? null,
      memberships: [],
    };
  }

  const staffTenantIds = [
    ...new Set(
      (roleRows ?? [])
        .filter((r) => STAFF_ROLES.includes(r.role as Role) && r.tenant_id)
        .map((r) => r.tenant_id as string),
    ),
  ];

  const { data: tenantRows } = staffTenantIds.length
    ? await admin.from("tenants").select("id, name, status").in("id", staffTenantIds)
    : { data: [] as { id: string; name: string; status: string }[] };
  const activeRows = (tenantRows ?? []).filter((t) => t.status === "active");
  let memberships = activeRows.map((t) => ({ id: t.id, name: t.name }));
  const allowedIds = new Set(memberships.map((m) => m.id));

  const jar = await cookies();
  const wanted = jar.get(TENANT_COOKIE)?.value ?? null;

  let tenantId: string | null = null;
  if (wanted && allowedIds.has(wanted)) tenantId = wanted;
  else if (activeRows.length === 1) tenantId = activeRows[0]!.id;
  else if (allRoles.includes(RoleCode.EMPLOYEE)) tenantId = profile?.tenant_id ?? null;

  if (tenantId && !memberships.some((m) => m.id === tenantId)) {
    const { data: t } = await admin.from("tenants").select("id, name").eq("id", tenantId).maybeSingle();
    if (t) memberships = [...memberships, { id: t.id, name: t.name }];
  }

  const roles = [
    ...new Set(
      (roleRows ?? [])
        .filter((r) => !r.tenant_id || r.tenant_id === tenantId)
        .map((r) => r.role as Role),
    ),
  ];

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    tenantId,
    roles,
    fullName: profile?.full_name ?? null,
    memberships,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const s = await getSessionContext();
  if (!s) redirect("/login");
  return s;
}

export async function requireStaff(): Promise<SessionContext> {
  const s = await requireSession();
  if (s.roles.includes(RoleCode.SUPER_ADMIN) || !isStaff(s.roles) || !s.tenantId) {
    redirect(s.roles.includes(RoleCode.SUPER_ADMIN) ? "/admin" : homeForRoles(s.roles));
  }
  await assertTenantActive(s.tenantId);
  return s;
}

export async function requireEmployee(): Promise<SessionContext> {
  const s = await requireSession();
  if (!s.roles.includes(RoleCode.EMPLOYEE) || !s.tenantId) redirect(homeForRoles(s.roles));
  await assertTenantActive(s.tenantId);
  return s;
}

async function assertTenantActive(tenantId: string | null) {
  if (!tenantId) return;
  const admin = createAdminClient();
  const { data } = await admin.from("tenants").select("status").eq("id", tenantId).maybeSingle();
  if (data && data.status !== "active") redirect("/bloqueado");
}

export async function requireSuper(): Promise<SessionContext> {
  const s = await requireSession();
  if (!s.roles.includes(RoleCode.SUPER_ADMIN)) redirect(homeForRoles(s.roles));
  return s;
}

export async function writeRolesCookie(roles: string[]) {
  const jar = await cookies();
  jar.set(ROLES_COOKIE, JSON.stringify(roles), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function writeTenantCookie(tenantId: string | null) {
  const jar = await cookies();
  if (!tenantId) {
    jar.delete(TENANT_COOKIE);
    return;
  }
  jar.set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearRolesCookie() {
  const jar = await cookies();
  jar.delete(ROLES_COOKIE);
  jar.delete(TENANT_COOKIE);
}
