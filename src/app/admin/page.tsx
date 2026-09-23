import { Shell } from "@/components/shell";
import { requireSuper } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_STATUS } from "@/lib/labels";
import { sanitizePlatformAdmins, revokeTenantAccess, revokeSuperAdmin } from "@/modules/tenants/actions";
import { CreateTenantForm, GrantAccessForm, InviteSuperForm, DeleteTenantButton, ResetTempPasswordForm, TenantStatusForm } from "./people-forms";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function AdminHome() {
  const s = await requireSuper();
  await sanitizePlatformAdmins();
  const db = createAdminClient();
  const [{ data: tenants }, { count: users }, { data: empRows }, { data: adminRoles }, { data: settings }] =
    await Promise.all([
      db.from("tenants").select("id, name, slug, status, created_at, block_reason").order("created_at"),
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("employees").select("tenant_id, status"),
      db.from("user_roles").select("tenant_id, user_id").eq("role", "tenant_admin"),
      db.from("tenant_settings").select("tenant_id, cuit, legal_name"),
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

  const empByTenant = new Map<string, { total: number; active: number }>();
  for (const e of empRows ?? []) {
    const cur = empByTenant.get(e.tenant_id) ?? { total: 0, active: 0 };
    cur.total += 1;
    if (e.status === "active") cur.active += 1;
    empByTenant.set(e.tenant_id, cur);
  }
  const settingsByTenant = new Map((settings ?? []).map((x) => [x.tenant_id, x]));

  const list = tenants ?? [];
  const nActive = list.filter((t) => t.status === "active").length;
  const nSuspended = list.filter((t) => t.status === "suspended").length;
  const nCancelled = list.filter((t) => t.status === "cancelled").length;
  const empTotal = empRows?.length ?? 0;

  return (
    <Shell area="admin" title="Empresas" session={s}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="panel px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Empresas
          </p>
          <p className="text-2xl font-semibold">{list.length}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Activas
          </p>
          <p className="text-2xl font-semibold">{nActive}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Bloqueadas
          </p>
          <p className="text-2xl font-semibold">{nSuspended}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Bajas
          </p>
          <p className="text-2xl font-semibold">{nCancelled}</p>
        </div>
        <div className="panel px-5 py-4">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Empleados / usuarios
          </p>
          <p className="text-2xl font-semibold">
            {empTotal} <span className="text-base font-normal" style={{ color: "var(--muted)" }}>/ {users ?? 0}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
        <section className="panel min-w-0 flex-1 overflow-hidden">
          <div
            className="flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-end lg:justify-between"
            style={{ borderColor: "var(--line)" }}
          >
            <div>
              <h2 className="text-base font-semibold">Empresas</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Suspender corta RRHH y el portal del empleado (falta de pago, etc.).
              </p>
            </div>
            <CreateTenantForm />
          </div>
          <div
            className="hidden border-b px-6 py-2 text-xs lg:grid lg:grid-cols-[minmax(11rem,1.1fr)_5.5rem_minmax(14rem,1.6fr)_11.5rem] lg:gap-4"
            style={{ borderColor: "var(--line)", color: "var(--muted)" }}
          >
            <span>Empresa</span>
            <span>Plantilla</span>
            <span>RRHH</span>
            <span>Estado</span>
          </div>
          <ul>
            {list.map((t) => {
              const people = peopleByTenant.get(t.id) ?? [];
              const emps = empByTenant.get(t.id) ?? { total: 0, active: 0 };
              const st = settingsByTenant.get(t.id);
              const blocked = t.status !== "active";
              return (
                <li
                  key={t.id}
                  className="grid gap-4 border-b px-6 py-4 last:border-0 lg:grid-cols-[minmax(11rem,1.1fr)_5.5rem_minmax(14rem,1.6fr)_11.5rem]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {st?.legal_name && st.legal_name !== t.name ? `${st.legal_name} · ` : null}
                      {st?.cuit ? `CUIT ${st.cuit}` : "CUIT —"} · {t.slug}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                      Alta {fmtDate(t.created_at)}
                    </p>
                  </div>
                  <p className="text-xs">
                    {emps.active}
                    {emps.total !== emps.active ? (
                      <span style={{ color: "var(--muted)" }}> / {emps.total}</span>
                    ) : null}{" "}
                    activos
                  </p>
                  <div className="min-w-0">
                    {people.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        Nadie asignado
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {people.map((p) => (
                          <li key={p.userId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            <span className="min-w-0 break-words">
                              {p.label}
                              {p.email ? <span style={{ color: "var(--muted)" }}> · {p.email}</span> : null}
                              {p.pending ? (
                                <span className="ml-2 text-[11px]" style={{ color: "var(--accent)" }}>
                                  falta clave
                                </span>
                              ) : null}
                            </span>
                            <span className="flex shrink-0 gap-1">
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
                  </div>
                  <div className="text-xs">
                    <p className={blocked ? "font-medium text-red-700" : ""}>{TENANT_STATUS[t.status] ?? t.status}</p>
                    {t.block_reason ? (
                      <p className="mt-1" style={{ color: "var(--muted)" }}>
                        {t.block_reason}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-col items-start gap-2">
                      <TenantStatusForm id={t.id} status={t.status} reason={t.block_reason} />
                      <DeleteTenantButton id={t.id} name={t.name} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
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
