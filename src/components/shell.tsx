import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/modules/auth/actions";
import { enterTenant } from "@/modules/tenants/actions";
import type { SessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Bell } from "@/components/bell";

const NAV = {
  empleado: [
    ["Inicio", "/empleado"],
    ["Recibos", "/empleado/recibos"],
    ["Documentos", "/empleado/documentos"],
    ["Consultas", "/empleado/consultas"],
    ["Calendario", "/empleado/calendario"],
    ["Fichaje", "/empleado/fichaje"],
    ["Comunicaciones", "/empleado/comunicaciones"],
    ["Perfil", "/empleado/perfil"],
  ],
  rrhh: [
    ["Inicio", "/rrhh"],
    ["Empleados", "/rrhh/empleados"],
    ["Convenios", "/rrhh/convenios"],
    ["Recibos", "/rrhh/recibos"],
    ["Documentos", "/rrhh/documentos"],
    ["Consultas", "/rrhh/consultas"],
    ["Asistencia", "/rrhh/asistencia"],
    ["Liquidación", "/rrhh/liquidacion"],
    ["Eventos", "/rrhh/eventos"],
    ["Comunicaciones", "/rrhh/comunicaciones"],
    ["Actividad", "/rrhh/actividad"],
    ["Reportes", "/rrhh/reportes"],
    ["Configuración", "/rrhh/configuracion"],
  ],
  admin: [["Empresas", "/admin"]],
} as const;

const META = {
  admin: { kicker: "Consola plataforma", brand: "INEX" },
  rrhh: { kicker: "Recursos humanos", brand: "INEX RRHH" },
  empleado: { kicker: "Mi espacio", brand: "INEX" },
};

export async function Shell({
  area,
  title,
  session,
  children,
}: {
  area: keyof typeof NAV;
  title: string;
  session: SessionContext;
  children: ReactNode;
}) {
  const db = createAdminClient();
  const [{ data: notes }, { data: settings }] = await Promise.all([
    db
      .from("notifications")
      .select("id, title, body, read_at, created_at")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(12),
    session.tenantId
      ? db.from("tenant_settings").select("primary_color").eq("tenant_id", session.tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const theme = area === "admin" ? "shell-admin" : area === "rrhh" ? "shell-rrhh" : "shell-empleado";
  const accent = area === "rrhh" && settings?.primary_color ? settings.primary_color : undefined;
  const meta = META[area];

  return (
    <div className={`flex ${theme}`} style={accent ? ({ ["--accent"]: accent } as CSSProperties) : undefined}>
      <aside
        className="hidden w-60 shrink-0 md:flex md:flex-col"
        style={{ background: "var(--aside)", color: "#f4efe4" }}
      >
        <div className="px-6 py-7">
          <p className="text-[10px] tracking-[0.28em] uppercase" style={{ color: "var(--accent)" }}>
            {meta.brand}
          </p>
          <p className="mt-2 text-xs opacity-70">{meta.kicker}</p>
          {area === "rrhh" && session.memberships.length > 1 ? (
            <form action={enterTenant} className="mt-3 space-y-1">
              <select name="tenant_id" defaultValue={session.tenantId ?? ""} className="w-full rounded-md bg-white/10 px-2 py-1 text-xs">
                {session.memberships.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button className="text-[10px] uppercase tracking-wide text-white/60">Cambiar empresa</button>
            </form>
          ) : area === "rrhh" && session.memberships[0] ? (
            <p className="mt-3 text-xs text-white/55">{session.memberships[0].name}</p>
          ) : null}
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV[area].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="aside-link block rounded-lg px-3 py-2 text-[13px] tracking-wide text-white/80"
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="px-6 py-5 text-[11px] text-white/40">Acceso restringido al rol</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between px-5 py-4 md:px-8"
          style={{ background: "var(--header)", borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <p className="text-[11px] tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              {meta.kicker}
            </p>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: "var(--muted)" }}>
            <Bell items={notes ?? []} />
            <span className="hidden max-w-[180px] truncate sm:inline">{session.fullName || session.email}</span>
            <form action={logout}>
              <button className="btn btn-ghost text-sm">Salir</button>
            </form>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto px-3 py-2 md:hidden" style={{ background: "var(--header)" }}>
          {NAV[area].map(([label, href]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1 text-xs panel">
              {label}
            </Link>
          ))}
        </div>
        <main className="p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
