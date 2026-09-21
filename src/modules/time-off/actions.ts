"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee, requireStaff } from "@/lib/auth/session";
import { getMyEmployee, notifyStaff, notifyUsers, uploadLeaveAttachment } from "@/lib/files";
import { isArHoliday, buenosAiresDate } from "@/lib/ar-holidays";
import { datesInRange, isWeekday, coversDay, readPortion } from "@/lib/time-off";
import { LEAVE_CATALOG } from "@/lib/leave-catalog";
import { roundMoney } from "@/lib/labels";

export type LeaveTypeRow = {
  id: string;
  code: string;
  name: string;
  employee_can_request: boolean;
  requires_certificate: boolean;
  active: boolean;
  sort: number;
};

export async function ensureLeaveTypes(tenantId: string): Promise<LeaveTypeRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("leave_types")
    .select("id, code, name, employee_can_request, requires_certificate, active, sort")
    .eq("tenant_id", tenantId)
    .order("sort");
  if (error) throw new Error("Corré 0015_leave_types.sql en el editor SQL de Supabase.");
  await db.from("leave_types").update({ active: false, employee_can_request: false }).eq("tenant_id", tenantId).eq("code", "viatic");
  const have = new Set((data ?? []).map((t) => t.code));
  const missing = LEAVE_CATALOG.filter((t) => !have.has(t.code)).map((t) => ({ tenant_id: tenantId, ...t }));
  let list = (data ?? []).filter((t) => t.code !== "viatic");
  if (missing.length) {
    const ins = await db
      .from("leave_types")
      .insert(missing)
      .select("id, code, name, employee_can_request, requires_certificate, active, sort");
    if (ins.error) throw new Error("Corré 0015_leave_types.sql en el editor SQL de Supabase.");
    list = [...list, ...(ins.data ?? [])];
  }
  return list as LeaveTypeRow[];
}

async function certFromForm(tenantId: string, userId: string, formData: FormData) {
  const file = formData.get("certificate");
  if (!(file instanceof File) || file.size === 0) return null;
  const up = await uploadLeaveAttachment({ tenantId, userId, file });
  if (up.error) throw new Error(up.error);
  return up.path ?? null;
}

function touch() {
  revalidatePath("/empleado/vacaciones");
  revalidatePath("/rrhh/ausencias");
  revalidatePath("/rrhh/liquidacion");
}

export async function requestTimeOff(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha.");
  const starts = String(formData.get("starts_on") ?? "");
  const ends = String(formData.get("ends_on") ?? "") || starts;
  if (!starts) throw new Error("Indicá desde cuándo.");
  if (ends < starts) throw new Error("La fecha hasta no puede ser anterior.");
  const types = await ensureLeaveTypes(s.tenantId!);
  const typeId = String(formData.get("leave_type_id") ?? "");
  const lt = types.find((t) => t.id === typeId && t.active && t.employee_can_request);
  if (!lt) throw new Error("Elegí el tipo de licencia.");
  const cert = await certFromForm(s.tenantId!, s.userId, formData);
  if (lt.requires_certificate && !cert) throw new Error("Esta licencia pide certificado (foto o PDF).");
  const db = createAdminClient();
  const { error } = await db.from("time_off").insert({
    tenant_id: s.tenantId,
    employee_id: me.id,
    kind: lt.code,
    leave_type_id: lt.id,
    starts_on: starts,
    ends_on: ends,
    portion: readPortion(formData, starts, ends),
    status: "pending",
    note: String(formData.get("note") ?? "").trim() || null,
    certificate_path: cert,
    created_by: s.userId,
  });
  if (error) {
    const again = await db.from("time_off").insert({
      tenant_id: s.tenantId,
      employee_id: me.id,
      kind: lt.code,
      leave_type_id: lt.id,
      starts_on: starts,
      ends_on: ends,
      status: "pending",
      note: String(formData.get("note") ?? "").trim() || null,
      certificate_path: cert,
      created_by: s.userId,
    });
    if (again.error) throw new Error("No se pudo pedir. Corré 0013, 0015 y 0020 en Supabase.");
  }
  await notifyStaff(s.tenantId!, "Pedido de licencia", `${me.first_name} ${me.last_name}: ${lt.name} ${starts} → ${ends}`, "/rrhh/ausencias");
  touch();
}

export async function updateMyTimeOff(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha.");
  const id = String(formData.get("id"));
  const starts = String(formData.get("starts_on") ?? "");
  const ends = String(formData.get("ends_on") ?? "") || starts;
  const db = createAdminClient();
  const { data: row } = await db
    .from("time_off")
    .select("id, status, employee_id")
    .eq("id", id)
    .eq("employee_id", me.id)
    .maybeSingle();
  if (!row || row.status !== "pending") throw new Error("Solo podés cambiar un pedido pendiente.");
  const types = await ensureLeaveTypes(s.tenantId!);
  const typeId = String(formData.get("leave_type_id") ?? "");
  const lt = types.find((t) => t.id === typeId && t.active && t.employee_can_request);
  if (!lt) throw new Error("Elegí el tipo de licencia.");
  const cert = await certFromForm(s.tenantId!, s.userId, formData);
  const { error } = await db
    .from("time_off")
    .update({
      starts_on: starts,
      ends_on: ends,
      note: String(formData.get("note") ?? "").trim() || null,
      kind: lt.code,
      leave_type_id: lt.id,
      portion: readPortion(formData, starts, ends),
      ...(cert ? { certificate_path: cert } : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  touch();
}

export async function cancelMyTimeOff(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha.");
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: row } = await db.from("time_off").select("status").eq("id", id).eq("employee_id", me.id).maybeSingle();
  if (!row || (row.status !== "pending" && row.status !== "approved")) {
    throw new Error("No se puede cancelar.");
  }
  if (row.status === "approved") {
    await db.from("time_off").update({ status: "cancelled" }).eq("id", id);
  } else {
    await db.from("time_off").delete().eq("id", id);
  }
  touch();
}

export async function decideTimeOff(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  const db = createAdminClient();
  const { data: row } = await db
    .from("time_off")
    .select("employee_id, kind, starts_on, ends_on")
    .eq("id", id)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  await db
    .from("time_off")
    .update({ status, decided_by: s.userId })
    .eq("id", id)
    .eq("tenant_id", s.tenantId!);
  if (row?.employee_id) {
    const { data: emp } = await db.from("employees").select("user_id").eq("id", row.employee_id).maybeSingle();
    if (emp?.user_id) {
      await notifyUsers(
        s.tenantId!,
        [emp.user_id],
        status === "approved" ? "Pedido autorizado" : "Pedido rechazado",
        `${row.kind} ${row.starts_on} → ${row.ends_on}`,
        "/empleado/vacaciones",
      );
    }
  }
  touch();
}

export async function staffTimeOff(formData: FormData) {
  const s = await requireStaff();
  const starts = String(formData.get("starts_on") ?? "");
  const ends = String(formData.get("ends_on") ?? "") || starts;
  const kind = String(formData.get("kind") ?? "company_off");
  const typeId = String(formData.get("leave_type_id") ?? "");
  const types = await ensureLeaveTypes(s.tenantId!);
  const lt = typeId ? types.find((t) => t.id === typeId) : types.find((t) => t.code === kind);
  const code = lt?.code ?? kind;
  if (!starts) throw new Error("Indicá la fecha.");
  const employeeId = String(formData.get("employee_id") ?? "") || null;
  if (code !== "company_off" && !employeeId) throw new Error("Elegí un empleado.");
  const cert = await certFromForm(s.tenantId!, s.userId, formData);
  const db = createAdminClient();
  const { error } = await db.from("time_off").insert({
    tenant_id: s.tenantId,
    employee_id: code === "company_off" ? null : employeeId,
    kind: code,
    leave_type_id: lt?.id ?? null,
    starts_on: starts,
    ends_on: ends,
    portion: readPortion(formData, starts, ends),
    status: "approved",
    note: String(formData.get("note") ?? "").trim() || null,
    certificate_path: cert,
    created_by: s.userId,
    decided_by: s.userId,
  });
  if (error) {
    const again = await db.from("time_off").insert({
      tenant_id: s.tenantId,
      employee_id: code === "company_off" ? null : employeeId,
      kind: code,
      leave_type_id: lt?.id ?? null,
      starts_on: starts,
      ends_on: ends,
      status: "approved",
      note: String(formData.get("note") ?? "").trim() || null,
      certificate_path: cert,
      created_by: s.userId,
      decided_by: s.userId,
    });
    if (again.error) throw new Error("No se pudo guardar. Corré 0013 y 0020 en Supabase.");
  }
  touch();
}

export async function scanUnjustifiedAbsences(formData: FormData) {
  const s = await requireStaff();
  const year = Number(formData.get("period_year"));
  const month = Number(formData.get("period_month"));
  const db = createAdminClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = endDate.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const days = datesInRange(start, end).filter((d) => d < today && isWeekday(d) && !isArHoliday(d));

  const [{ data: people }, { data: offs }, { data: punches }, { data: viatics }] = await Promise.all([
    db.from("employees").select("id, base_salary").eq("tenant_id", s.tenantId!).eq("status", "active"),
    db
      .from("time_off")
      .select("employee_id, kind, starts_on, ends_on, status")
      .eq("tenant_id", s.tenantId!)
      .eq("status", "approved"),
    db
      .from("attendance_records")
      .select("employee_id, recorded_at")
      .eq("tenant_id", s.tenantId!)
      .gte("recorded_at", `${start}T00:00:00`)
      .lt("recorded_at", new Date(year, month, 1).toISOString()),
    db.from("viatic_days").select("employee_id, day").eq("tenant_id", s.tenantId!).gte("day", start).lte("day", end),
  ]);

  const punched = new Set(
    (punches ?? []).map((p) => `${p.employee_id}|${buenosAiresDate(p.recorded_at)}`),
  );
  const covered = (offs ?? []).filter((o) => o.status === "approved");

  for (const emp of people ?? []) {
    const dayPay = roundMoney(Number(emp.base_salary ?? 0) / 30);
    for (const day of days) {
      if (punched.has(`${emp.id}|${day}`)) continue;
      if ((viatics ?? []).some((v) => v.employee_id === emp.id && String(v.day).slice(0, 10) === day)) continue;
      const ok = covered.some((o) => {
        if (!coversDay(o, day)) return false;
        if (o.kind === "company_off" && !o.employee_id) return true;
        return o.employee_id === emp.id && o.kind !== "unjustified";
      });
      if (ok) continue;
      const already = covered.some(
        (o) => o.employee_id === emp.id && o.kind === "unjustified" && coversDay(o, day),
      );
      if (already) continue;
      await db.from("time_off").insert({
        tenant_id: s.tenantId,
        employee_id: emp.id,
        kind: "unjustified",
        starts_on: day,
        ends_on: day,
        status: "approved",
        note: "Detectada: día hábil sin fichaje ni justificación",
        created_by: s.userId,
      });
      if (dayPay > 0) {
        await db.from("payroll_novelties").insert({
          tenant_id: s.tenantId,
          employee_id: emp.id,
          period_year: year,
          period_month: month,
          concept: "Falta injustificada",
          amount: -dayPay,
          status: "approved",
          note: day,
        });
      }
    }
  }
  touch();
  revalidatePath("/rrhh/empleados");
}

export async function addLeaveType(formData: FormData) {
  const s = await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Indicá el nombre.");
  await ensureLeaveTypes(s.tenantId!);
  const db = createAdminClient();
  const code = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || `lic_${Date.now()}`;
  const { error } = await db.from("leave_types").insert({
    tenant_id: s.tenantId,
    code: `${code}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    employee_can_request: formData.get("employee_can_request") === "on",
    requires_certificate: formData.get("requires_certificate") === "on",
    active: true,
    sort: 500,
  });
  if (error) throw new Error("No se pudo agregar. ¿Corriste 0015_leave_types.sql?");
  touch();
}

export async function updateLeaveType(formData: FormData) {
  const s = await requireStaff();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { error } = await db
    .from("leave_types")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      employee_can_request: formData.get("employee_can_request") === "on",
      requires_certificate: formData.get("requires_certificate") === "on",
      active: formData.get("active") === "on",
    })
    .eq("id", id)
    .eq("tenant_id", s.tenantId!);
  if (error) throw new Error(error.message);
  touch();
}
