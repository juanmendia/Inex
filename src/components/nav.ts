export type NavItem = { label: string; href: string };
export type NavSection = { title?: string; items: NavItem[] };

export const NAV = {
  empleado: [
    { items: [{ label: "Inicio", href: "/empleado" }] },
    {
      title: "Mis papeles",
      items: [
        { label: "Recibos", href: "/empleado/recibos" },
        { label: "Documentos", href: "/empleado/documentos" },
      ],
    },
    {
      title: "Pedidos",
      items: [
        { label: "Consultas", href: "/empleado/consultas" },
        { label: "Vacaciones", href: "/empleado/vacaciones" },
      ],
    },
    {
      title: "Día a día",
      items: [
        { label: "Fichaje", href: "/empleado/fichaje" },
        { label: "Calendario", href: "/empleado/calendario" },
        { label: "Comunicaciones", href: "/empleado/comunicaciones" },
      ],
    },
    { title: "Cuenta", items: [{ label: "Perfil", href: "/empleado/perfil" }] },
  ],
  rrhh: [
    { items: [{ label: "Inicio", href: "/rrhh" }] },
    {
      title: "Personas",
      items: [
        { label: "Empleados", href: "/rrhh/empleados" },
        { label: "Consultas", href: "/rrhh/consultas" },
        { label: "Comunicaciones", href: "/rrhh/comunicaciones" },
      ],
    },
    {
      title: "Tiempo",
      items: [
        { label: "Asistencia", href: "/rrhh/asistencia" },
        { label: "Ausencias", href: "/rrhh/ausencias" },
        { label: "Eventos", href: "/rrhh/eventos" },
      ],
    },
    {
      title: "Sueldos",
      items: [
        { label: "Recibos", href: "/rrhh/recibos" },
        { label: "Liquidación", href: "/rrhh/liquidacion" },
      ],
    },
    {
      title: "Empresa",
      items: [
        { label: "Convenios", href: "/rrhh/convenios" },
        { label: "Documentos", href: "/rrhh/documentos" },
        { label: "Configuración", href: "/rrhh/configuracion" },
      ],
    },
    {
      title: "Control",
      items: [
        { label: "Actividad", href: "/rrhh/actividad" },
        { label: "Reportes", href: "/rrhh/reportes" },
      ],
    },
  ],
  admin: [{ items: [{ label: "Empresas", href: "/admin" }] }],
} as const satisfies Record<string, NavSection[]>;

export type NavArea = keyof typeof NAV;

export function pathIsActive(href: string, pathname: string) {
  if (href === "/rrhh" || href === "/empleado" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function sectionIsActive(section: NavSection, pathname: string) {
  return section.items.some((item) => pathIsActive(item.href, pathname));
}
