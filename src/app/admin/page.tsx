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
      <div className="flex gap-3">
        <div className="panel min-w-0 flex-1 px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Empresas
          </p>
          <p className="text-2xl font-semibold">{tenants?.length ?? 0}</p>
        </div>
        <div className="panel min-w-0 flex-1 px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Usuarios
          </p>
          <p className="text-2xl font-semibold">{users ?? 0}</p>
        </div>
        <div className="panel min-w-0 flex-1 px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Empleados
          </p>
          <p className="text-2xl font-semibold">{employees ?? 0}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
        <section className="panel min-w-0 flex-1 overflow-hidden">
          <div
            className="flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-end lg:justify-between"
            style={{ borderColor: "var(--line)" }}
          >
            <h2 className="text-base font-semibold">Empresas</h2>
            <CreateTenantForm />
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
                <th className="px-6 py-2 font-medium">Nombre</th>
                <th className="px-6 py-2 font-medium">RRHH</th>
                <th className="px-6 py-2 font-medium">Estado</th>
                <th className="px-6 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(tenants ?? []).map((t) => {
                const people = peopleByTenant.get(t.id) ?? [];
                return (
                  <tr key={t.id} className="border-b align-top last:border-0" style={{ borderColor: "var(--line)" }}>
                    <td className="px-6 py-4 font-medium">{t.name}</td>
                    <td className="px-6 py-4">
                      {people.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--muted)" }}>
                          Nadie asignado
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {people.map((p) => (
                            <li key={p.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>
                                {p.label}
                                {p.email ? <span style={{ color: "var(--muted)" }}> · {p.email}</span> : null}
                                {p.pending ? (
                                  <span className="ml-2 text-[11px]" style={{ color: "var(--accent)" }}>
                                    falta clave
                                  </span>
                                ) : null}
                              </span>
                              <span className="flex gap-1">
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
                      <div className="mt-2">
                        <GrantAccessForm tenantId={t.id} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: "var(--muted)" }}>
                      {TENANT_STATUS[t.status] ?? t.status}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <form action={toggleTenant}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value={t.status} />
                          <button className="btn btn-ghost text-xs">
                            {t.status === "active" ? "Suspender" : "Activar"}
                          </button>
                        </form>
                        <DeleteTenantButton id={t.id} name={t.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="panel w-full shrink-0 overflow-hidden xl:w-80">
          <div className="border-b px-5 py-4" style={{ borderColor: "var(--line)" }}>
            <h2 className="text-sm font-semibold">Plataforma</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Superadmins. No entran a RRHH.
            </p>
            <div className="mt-3">
              <InviteSuperForm />
            </div>
          </div>
          <ul>
            {platformTeam.map((p) => (
              <li
                key={p.userId}
                className="border-b px-5 py-3 text-sm last:border-0"
                style={{ borderColor: "var(--line)" }}
              >
                <p className="font-medium">
                  {p.label}
                  {p.me ? (
                    <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--accent)" }}>
                      vos
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                  {p.email}
                </p>
                <div className="mt-1 flex gap-1">
                  {p.email ? <ResetTempPasswordForm email={p.email} /> : null}
                  {!p.me && platformTeam.length > 1 ? (
                    <form action={revokeSuperAdmin}>
                      <input type="hidden" name="user_id" value={p.userId} />
                      <button className="btn btn-ghost text-xs">Quitar</button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
