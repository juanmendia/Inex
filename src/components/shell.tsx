import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { logout } from "@/modules/auth/actions";
import { enterTenant } from "@/modules/tenants/actions";
import type { SessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { Bell } from "@/components/bell";
import { MobileNav } from "@/components/mobile-nav";

const NAV = {
  empleado: [
    ["Inicio", "/empleado"],
    ["Recibos", "/empleado/recibos"],
    ["Documentos", "/empleado/documentos"],
    ["Consultas", "/empleado/consultas"],
    ["Calendario", "/empleado/calendario"],
    ["Vacaciones", "/empleado/vacaciones"],
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
    ["Ausencias", "/rrhh/ausencias"],
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
  const notesQ = await db
    .from("notifications")
    .select("id, title, body, read_at, created_at, href")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(12);
  const notes = notesQ.error
    ? (
        await db
          .from("notifications")
          .select("id, title, body, read_at, created_at")
          .eq("user_id", session.userId)
          .order("created_at", { ascending: false })
          .limit(12)
      ).data
    : notesQ.data;
  const { data: settings } = session.tenantId
    ? await db.from("tenant_settings").select("primary_color").eq("tenant_id", session.tenantId).maybeSingle()
    : { data: null };

  const theme = area === "admin" ? "shell-admin" : area === "rrhh" ? "shell-rrhh" : "shell-empleado";
  const accent = area === "rrhh" && settings?.primary_color ? settings.primary_color : undefined;
  const meta = META[area];
  const company =
    area === "admin"
      ? "Inex"
      : session.memberships.find((m) => m.id === session.tenantId)?.name ??
        session.memberships[0]?.name ??
        "Inex";
  const program = area === "admin" ? "Plataforma" : area === "rrhh" ? "Inex RRHH" : "Inex";

  return (
    <div className={`flex min-h-screen overflow-x-hidden ${theme}`} style={accent ? ({ ["--accent"]: accent } as CSSProperties) : undefined}>
      <aside
        className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto md:flex"
        style={{ background: "var(--aside)", color: "#f4efe4" }}
      >
        <div className="px-6 py-7">
          <p className="text-[15px] font-medium leading-snug">{company}</p>
          <p className="mt-1 text-[11px] tracking-wide text-white/50">{program}</p>
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
        <p className="px-5 py-4 text-[10px] leading-snug text-white/35">Solo tu rol</p>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col" style={{ background: "var(--bg)" }}>
        <header
          className="flex items-center justify-between gap-3 px-3 py-3 md:px-8 md:py-4"
          style={{ background: "var(--header)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav items={NAV[area]} company={company} program={program} />
            <div className="min-w-0">
              <p className="hidden text-[11px] tracking-widest uppercase md:block" style={{ color: "var(--muted)" }}>
                {company} · {program}
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
            <Bell items={notes ?? []} />
            <span className="hidden max-w-[180px] truncate sm:inline">{session.fullName || session.email}</span>
            <form action={logout} className="hidden md:block">
              <button className="btn btn-ghost text-sm">Salir</button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
