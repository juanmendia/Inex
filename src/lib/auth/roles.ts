import { RoleCode } from "@/types/enums";

export const ROLES_COOKIE = "inex_roles";
export const TENANT_COOKIE = "inex_tenant";

export const STAFF_ROLES: RoleCode[] = [
  RoleCode.TENANT_ADMIN,
  RoleCode.HR_ADMIN,
  RoleCode.HR_OPERATOR,
];

export function parseRoles(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function isStaff(roles: string[]): boolean {
  return roles.some((r) => STAFF_ROLES.includes(r as RoleCode));
}

export function homeForRoles(roles: string[]): string {
  if (roles.includes(RoleCode.SUPER_ADMIN)) return "/admin";
  if (isStaff(roles)) return "/rrhh";
  if (roles.includes(RoleCode.EMPLOYEE)) return "/empleado";
  return "/login";
}

export function canAccessPath(path: string, roles: string[]): boolean {
  if (path.startsWith("/admin")) return roles.includes(RoleCode.SUPER_ADMIN);
  if (path.startsWith("/rrhh")) return isStaff(roles) && !roles.includes(RoleCode.SUPER_ADMIN);
  if (path.startsWith("/empleado")) return roles.includes(RoleCode.EMPLOYEE);
  return true;
}
