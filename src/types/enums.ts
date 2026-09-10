export const RoleCode = {
  SUPER_ADMIN: "super_admin",
  TENANT_ADMIN: "tenant_admin",
  HR_ADMIN: "hr_admin",
  HR_OPERATOR: "hr_operator",
  EMPLOYEE: "employee",
} as const;
export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

export const ReceiptStatus = {
  PENDING: "pending",
  SIGNED: "signed",
  NON_CONFORMING: "non_conforming",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;
export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];

export const TicketStatus = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  ANSWERED: "answered",
  CLOSED: "closed",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const EmployeeStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const DocumentType = {
  RECEIPT: "receipt",
  CONTRACT: "contract",
  CERTIFICATE: "certificate",
  POLICY: "policy",
  NOTICE: "notice",
  OTHER: "other",
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];
