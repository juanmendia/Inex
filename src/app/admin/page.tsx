import { Shell } from "@/components/shell";
import { requireSuper } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_STATUS } from "@/lib/labels";
import { sanitizePlatformAdmins, revokeTenantAccess, revokeSuperAdmin, toggleTenant } from "@/modules/tenants/actions";
import { CreateTenantForm, GrantAccessForm, InviteSuperForm, DeleteTenantButton, ResetTempPasswordForm } from "./people-forms";

export default async function AdminHome() {
  const s = await requireSuper();
  await sanitizePlatformAdmins();
  const db = createAdminClient();
  const [{ data: tenants }, { count: users }, { count: employees }, { data: adminRoles }] = await Promise.all([
    db.from("tenants").select("id, name, slug, status, created_at").order("created_at"),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("employees").select("id", { count: "exact", head: true }),
    db.from("user_roles").select("tenant_id, user_id").eq("role", "tenant_admin"),
  ]);
  const adminIds = [...new Set((adminRoles ?? []).map((r) => r.user_id))];
  const { data: adminProfiles } = adminIds.length
    ? await db.from("profiles").select("id, email, full_name").in("id", adminIds)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profileById = new Map((adminProfiles ?? []).map((p) => [p.id, p]));

  const listed = adminIds.length ? await db.auth.admin.listUsers({ page: 1, perPage: 1000 }) : null;
  const pendingPwd = new Set(
    (listed?.data?.users ?? []).filter((u) => u.app_metadata?.must_change_password).map((u) => u.id),
  );

  const superRows = (await db.from("user_roles").select("user_id").eq("role", "super_admin")).data ?? [];
  const superIds = new Set(superRows.map((r) => r.user_id));
  const { data: superProfiles } = superIds.size
    ? await db.from("profiles").select("id, email, full_name").in("id", [...superIds])
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const platformTeam = (superProfiles ?? []).map((p) => ({
    userId: p.id,
    email: p.email,
    label: p.full_name || p.email,
    me: p.id === s.userId,
  }));

  const peopleByTenant = new Map<string, { userId: string; label: string; email: string; pending: boolean }[]>();
  for (const row of adminRoles ?? []) {
    if (!row.tenant_id || superIds.has(row.user_id)) continue;
    const p = profileById.get(row.user_id);
    const list = peopleByTenant.get(row.tenant_id) ?? [];
    list.push({
      userId: row.user_id,
      email: p?.email ?? "",
      label: p?.full_name || p?.email || row.user_id,
      pending: pendingPwd.has(row.user_id),
    });
    peopleByTenant.set(row.tenant_id, list);
  }

  return (
    <Shell area="admin" title="Empresas" session={s}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-zinc-500">Empresas</p>
          <p className="text-2xl font-semibold">{tenants?.length ?? 0}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-zinc-500">Usuarios</p>
          <p className="text-2xl font-semibold">{users ?? 0}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-zinc-500">Empleados</p>
          <p className="text-2xl font-semibold">{employees ?? 0}</p>
        </div>
      </div>

      <InviteSuperForm />
      <ul className="panel mt-2 divide-y">
        {platformTeam.map((p) => (
          <li key={p.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span>
              <span className="font-medium">{p.label}</span>
              <span className="text-zinc-500"> · {p.email}</span>
              {p.me ? <span className="ml-2 text-[11px] uppercase tracking-wide text-[#c9a227]">vos</span> : null}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {p.email ? <ResetTempPasswordForm email={p.email} /> : null}
              {!p.me && platformTeam.length > 1 ? (
                <form action={revokeSuperAdmin}>
                  <input type="hidden" name="user_id" value={p.userId} />
                  <button className="btn btn-ghost text-xs">Quitar</button>
                </form>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <CreateTenantForm />

      <ul className="panel mt-4 divide-y">
        {(tenants ?? []).map((t) => {
          const people = peopleByTenant.get(t.id) ?? [];
          return (
            <li key={t.id} className="space-y-3 px-4 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-zinc-500">
                    {t.slug} · {TENANT_STATUS[t.status] ?? t.status}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <form action={toggleTenant}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={t.status} />
                    <button className="btn btn-ghost text-[#c9a227]">
                      {t.status === "active" ? "Suspender" : "Activar"}
                    </button>
                  </form>
                  <DeleteTenantButton id={t.id} name={t.name} />
                </span>
              </div>

              <p className="text-[11px] tracking-widest uppercase" style={{ color: "var(--muted)" }}>
                Administradores de RRHH
              </p>
              {people.length === 0 ? (
                <p className="text-xs text-zinc-500">Todavía no hay nadie. Agregá un correo abajo.</p>
              ) : (
                <ul className="space-y-2">
                  {people.map((p) => (
                    <li key={p.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <span>
                        <span className="font-medium">{p.label}</span>
                        {p.email ? <span className="text-zinc-500"> · {p.email}</span> : null}
                        {p.pending ? (
                          <span className="ml-2 text-[11px] uppercase tracking-wide text-[#c9a227]">
                            pendiente de contraseña
                          </span>
                        ) : null}
                      </span>
                      <span className="flex gap-2">
                        {p.email ? <ResetTempPasswordForm email={p.email} /> : null}
                        <form action={revokeTenantAccess}>
                          <input type="hidden" name="tenant_id" value={t.id} />
                          <input type="hidden" name="user_id" value={p.userId} />
                          <button className="btn btn-ghost text-xs">Quitar</button>
                        </form>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <GrantAccessForm tenantId={t.id} />
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}
