import { createAdminClient } from "@/lib/supabase/admin";
import { audit, notifyUsers, uploadPrivatePdfBytes } from "@/lib/files";
import { payslipPdf, type Payslip, type PayslipLine } from "@/lib/payslip-pdf";
import { buildPayslipLines } from "@/lib/payroll-concepts";

const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function named(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && typeof v === "object" && "name" in v ? String((v as { name: string }).name) : null;
}

export function isSacMonth(month: number) {
  return month === 6 || month === 12;
}

type Emp = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  dni: string | null;
  hire_date: string | null;
  base_salary: number | null;
  user_id: string | null;
  departments: unknown;
  positions: unknown;
  work_location_id: string | null;
  work_locations?: unknown;
};

function linesFor(kind: string, emp: Emp, extras: { concept: string; amount: number; hours: number | null }[], month: number): PayslipLine[] {
  return buildPayslipLines({ kind, base: Number(emp.base_salary ?? 0), month, extras });
}

function toPayslip(opts: {
  company: string;
  cuit?: string | null;
  kind: string;
  year: number;
  month: number;
  emp: Emp;
  extras: { concept: string; amount: number; hours: number | null }[];
  signature?: Payslip["signature"];
}): Payslip {
  const period = `${String(opts.month).padStart(2, "0")}/${opts.year}`;
  return {
    company: opts.company,
    cuit: opts.cuit,
    title: opts.kind === "aguinaldo" ? "RECIBO SAC / AGUINALDO" : "LIQUIDACION DE HABERES",
    period,
    monthName: MONTHS[opts.month - 1] ?? "",
    legajo: opts.emp.employee_number,
    name: `${opts.emp.last_name}, ${opts.emp.first_name}`,
    dni: opts.emp.dni,
    hireDate: opts.emp.hire_date,
    payDate: new Date(opts.year, opts.month, 0).toLocaleDateString("es-AR"),
    branch: named(opts.emp.work_locations),
    category: [named(opts.emp.positions), named(opts.emp.departments)].filter(Boolean).join(" / ") || null,
    lines: linesFor(opts.kind, opts.emp, opts.extras, opts.month),
    signature: opts.signature,
  };
}

async function savePdf(opts: {
  tenantId: string;
  userId: string | null;
  employeeId: string;
  year: number;
  month: number;
  kind: string;
  bytes: Buffer;
  existing?: { id: string; document_id: string; status: string } | null;
}) {
  const db = createAdminClient();
  const period = `${String(opts.month).padStart(2, "0")}/${opts.year}`;
  const title = opts.kind === "aguinaldo" ? `Recibo SAC ${period}` : `Recibo haberes ${period}`;
  const { fileId } = await uploadPrivatePdfBytes({
    tenantId: opts.tenantId,
    userId: opts.userId,
    folder: "receipts",
    bytes: opts.bytes,
    filename: `recibo-${opts.kind}-${opts.year}-${opts.month}.pdf`,
  });
  if (opts.existing && opts.existing.status === "pending") {
    const { data: versions } = await db
      .from("document_versions")
      .select("version")
      .eq("document_id", opts.existing.document_id)
      .order("version", { ascending: false })
      .limit(1);
    const next = (versions?.[0]?.version ?? 1) + 1;
    await db.from("document_versions").insert({
      document_id: opts.existing.document_id,
      tenant_id: opts.tenantId,
      file_id: fileId,
      version: next,
    });
    await db.from("documents").update({ current_file_id: fileId, title, status: "available" }).eq("id", opts.existing.document_id);
    await db.from("receipts").update({ published_at: new Date().toISOString() }).eq("id", opts.existing.id);
    return "replaced" as const;
  }
  const { data: doc, error: dErr } = await db
    .from("documents")
    .insert({
      tenant_id: opts.tenantId,
      employee_id: opts.employeeId,
      type: "receipt",
      title,
      status: "available",
      current_file_id: fileId,
    })
    .select("id")
    .single();
  if (dErr) throw new Error(dErr.message);
  await db.from("document_versions").insert({
    document_id: doc.id,
    tenant_id: opts.tenantId,
    file_id: fileId,
    version: 1,
  });
  const { error: rErr } = await db.from("receipts").insert({
    tenant_id: opts.tenantId,
    document_id: doc.id,
    employee_id: opts.employeeId,
    period_year: opts.year,
    period_month: opts.month,
    kind: opts.kind,
    status: "pending",
    published_at: new Date().toISOString(),
  });
  if (rErr) throw new Error(rErr.message);
  return "created" as const;
}

export async function generatePeriodReceipts(opts: {
  tenantId: string;
  userId: string | null;
  year: number;
  month: number;
  kind?: string;
  employeeId?: string;
}) {
  const requested = opts.kind || "haberes";
  const kinds = requested === "haberes" && isSacMonth(opts.month) ? ["haberes", "aguinaldo"] : [requested];
  const db = createAdminClient();
  let empQ = db
    .from("employees")
    .select(
      "id, first_name, last_name, employee_number, dni, hire_date, base_salary, user_id, work_location_id, department_id, position_id, departments(name), positions(name)",
    )
    .eq("tenant_id", opts.tenantId)
    .eq("status", "active");
  if (opts.employeeId) empQ = empQ.eq("id", opts.employeeId);

  const [{ data: tenant }, { data: settings }, { data: employees }, { data: novelties }, { data: existing }] =
    await Promise.all([
      db.from("tenants").select("name").eq("id", opts.tenantId).single(),
      db.from("tenant_settings").select("legal_name, cuit").eq("tenant_id", opts.tenantId).maybeSingle(),
      empQ,
      db
        .from("payroll_novelties")
        .select("employee_id, concept, amount, hours")
        .eq("tenant_id", opts.tenantId)
        .eq("period_year", opts.year)
        .eq("period_month", opts.month)
        .in("status", ["approved", "liquidated"]),
      db
        .from("receipts")
        .select("id, employee_id, kind, status, document_id")
        .eq("tenant_id", opts.tenantId)
        .eq("period_year", opts.year)
        .eq("period_month", opts.month),
    ]);

  const locIds = [...new Set((employees ?? []).map((e) => (e as { work_location_id?: string }).work_location_id).filter(Boolean))] as string[];
  const { data: locs } = locIds.length
    ? await db.from("work_locations").select("id, name").in("id", locIds)
    : { data: [] as { id: string; name: string }[] };
  const locMap = new Map((locs ?? []).map((l) => [l.id, l.name]));

  const company = settings?.legal_name || tenant?.name || "Empresa";
  let made = 0;

  for (const emp of (employees ?? []) as Emp[]) {
    const extras = (novelties ?? [])
      .filter((n) => n.employee_id === emp.id)
      .map((n) => ({ concept: String(n.concept), amount: Number(n.amount ?? 0), hours: n.hours == null ? null : Number(n.hours) }));
    for (const kind of kinds) {
      const found = (existing ?? []).find((r) => r.employee_id === emp.id && r.kind === kind);
      if (found && found.status !== "pending") continue;
      const bytes = payslipPdf(
        toPayslip({
          company,
          cuit: settings?.cuit,
          kind,
          year: opts.year,
          month: opts.month,
          emp: { ...emp, work_locations: emp.work_location_id ? { name: locMap.get(emp.work_location_id) ?? "" } : null },
          extras,
        }),
      );
      const result = await savePdf({
        tenantId: opts.tenantId,
        userId: opts.userId,
        employeeId: emp.id,
        year: opts.year,
        month: opts.month,
        kind,
        bytes,
        existing: found ?? null,
      });
      if (result === "created" && emp.user_id) {
        const title = kind === "aguinaldo" ? "Nuevo recibo de aguinaldo" : "Nuevo recibo disponible";
        await notifyUsers(opts.tenantId, [emp.user_id], title, `${String(opts.month).padStart(2, "0")}/${opts.year}`, "/empleado/recibos");
      }
      made++;
    }
  }

  if (opts.userId) {
    await audit({
      tenantId: opts.tenantId,
      userId: opts.userId,
      action: "publish",
      entityType: "receipt",
      metadata: { year: opts.year, month: opts.month, made },
    });
  }
  return made;
}

export async function stampSignedPayslip(opts: {
  tenantId: string;
  receiptId: string;
  signerName: string;
  at: string;
  ip?: string | null;
  conform: boolean;
}) {
  const db = createAdminClient();
  const { data: rec } = await db
    .from("receipts")
    .select("id, document_id, employee_id, period_year, period_month, kind")
    .eq("id", opts.receiptId)
    .eq("tenant_id", opts.tenantId)
    .single();
  if (!rec) return;
  const [{ data: tenant }, { data: settings }, { data: emp }, { data: novelties }] = await Promise.all([
    db.from("tenants").select("name").eq("id", opts.tenantId).single(),
    db.from("tenant_settings").select("legal_name, cuit").eq("tenant_id", opts.tenantId).maybeSingle(),
    db
      .from("employees")
      .select(
        "id, first_name, last_name, employee_number, dni, hire_date, base_salary, user_id, work_location_id, departments(name), positions(name)",
      )
      .eq("id", rec.employee_id)
      .single(),
    db
      .from("payroll_novelties")
      .select("concept, amount, hours")
      .eq("employee_id", rec.employee_id)
      .eq("period_year", rec.period_year)
      .eq("period_month", rec.period_month)
      .in("status", ["approved", "liquidated"]),
  ]);
  if (!emp) return;
  let branchName: string | null = null;
  const locId = (emp as { work_location_id?: string }).work_location_id;
  if (locId) {
    const { data: loc } = await db.from("work_locations").select("name").eq("id", locId).maybeSingle();
    branchName = loc?.name ?? null;
  }
  const extras = (novelties ?? []).map((n) => ({
    concept: String(n.concept),
    amount: Number(n.amount ?? 0),
    hours: n.hours == null ? null : Number(n.hours),
  }));
  const bytes = payslipPdf(
    toPayslip({
      company: settings?.legal_name || tenant?.name || "Empresa",
      cuit: settings?.cuit,
      kind: rec.kind,
      year: rec.period_year,
      month: rec.period_month,
      emp: { ...(emp as Emp), work_locations: branchName ? { name: branchName } : null },
      extras,
      signature: { name: opts.signerName, at: opts.at, ip: opts.ip, conform: opts.conform },
    }),
  );
  const { fileId } = await uploadPrivatePdfBytes({
    tenantId: opts.tenantId,
    userId: null,
    folder: "receipts",
    bytes,
    filename: `recibo-firmado.pdf`,
  });
  const { data: versions } = await db
    .from("document_versions")
    .select("version")
    .eq("document_id", rec.document_id)
    .order("version", { ascending: false })
    .limit(1);
  await db.from("document_versions").insert({
    document_id: rec.document_id,
    tenant_id: opts.tenantId,
    file_id: fileId,
    version: (versions?.[0]?.version ?? 1) + 1,
  });
  await db.from("documents").update({ current_file_id: fileId }).eq("id", rec.document_id);
}
