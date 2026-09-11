"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEmployee, requireStaff } from "@/lib/auth/session";
import { audit, getMyEmployee, signedUrlForDocument, uploadPrivatePdf } from "@/lib/files";

export async function publishReceipt(formData: FormData) {
  const s = await requireStaff();
  const employeeId = String(formData.get("employee_id") ?? "");
  const year = Number(formData.get("period_year"));
  const month = Number(formData.get("period_month"));
  const kind = String(formData.get("kind") ?? "haberes");
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new Error("Subí un PDF.");
  if (!employeeId || !year || !month) throw new Error("Completá empleado y período.");

  const db = createAdminClient();
  const { data: emp } = await db
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!emp) throw new Error("Empleado inválido.");

  for (const file of files) {
  const { fileId } = await uploadPrivatePdf({
    tenantId: s.tenantId!,
    userId: s.userId,
    folder: "receipts",
    file,
  });

  const title = `Recibo ${kind} ${String(month).padStart(2, "0")}/${year}`;
  const { data: doc, error: dErr } = await db
    .from("documents")
    .insert({
      tenant_id: s.tenantId,
      employee_id: employeeId,
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
    tenant_id: s.tenantId,
    file_id: fileId,
    version: 1,
  });

  const { error: rErr } = await db.from("receipts").insert({
    tenant_id: s.tenantId,
    document_id: doc.id,
    employee_id: employeeId,
    period_year: year,
    period_month: month,
    kind,
    status: "pending",
    published_at: new Date().toISOString(),
  });
  if (rErr) throw new Error(rErr.message);

  const { data: empRow } = await db.from("employees").select("user_id").eq("id", employeeId).single();
  if (empRow?.user_id) {
    await db.from("notifications").insert({
      tenant_id: s.tenantId,
      user_id: empRow.user_id,
      title: "Nuevo recibo disponible",
      body: title,
    });
  }

  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: "publish",
    entityType: "receipt",
    entityId: doc.id,
  });
  }
  revalidatePath("/rrhh/recibos");
  revalidatePath("/empleado/recibos");
}

export async function getReceiptPdfUrl(receiptId: string) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha de empleado");
  const db = createAdminClient();
  const { data: rec } = await db
    .from("receipts")
    .select("id, employee_id, document_id")
    .eq("id", receiptId)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!rec || rec.employee_id !== me.id) throw new Error("No autorizado");
  return signedUrlForDocument(rec.document_id);
}

export async function getReceiptPdfUrlHr(receiptId: string) {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: rec } = await db
    .from("receipts")
    .select("document_id")
    .eq("id", receiptId)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!rec) throw new Error("Archivo no encontrado");
  return signedUrlForDocument(rec.document_id);
}

export async function signReceipt(receiptId: string, action: "conform" | "non_conform", reason?: string) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) return "Sin ficha de empleado.";
  if (action === "non_conform" && !reason?.trim()) return "Indicá el motivo.";

  const db = createAdminClient();
  const { data: rec } = await db
    .from("receipts")
    .select("id, status, employee_id, document_id")
    .eq("id", receiptId)
    .eq("tenant_id", s.tenantId!)
    .maybeSingle();
  if (!rec || rec.employee_id !== me.id) return "Recibo inválido.";
  if (rec.status !== "pending") return "Este recibo ya fue firmado.";

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? null;
  const ua = h.get("user-agent");
  const status = action === "conform" ? "signed" : "non_conforming";

  await db.from("receipt_signatures").insert({
    tenant_id: s.tenantId,
    receipt_id: rec.id,
    employee_id: me.id,
    action,
    reason: reason?.trim() ?? null,
    ip_address: ip,
    user_agent: ua,
  });
  await db.from("receipts").update({ status }).eq("id", rec.id);
  await db
    .from("documents")
    .update({ status: action === "conform" ? "signed" : "non_conforming" })
    .eq("id", rec.document_id);

  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: action === "conform" ? "sign" : "sign_non_conform",
    entityType: "receipt",
    entityId: rec.id,
    ip,
    ua,
    metadata: { reason: reason ?? null },
  });

  if (action === "non_conform") {
    const { data: hrs } = await db
      .from("profiles")
      .select("id")
      .eq("tenant_id", s.tenantId!);
    if (hrs?.length) {
      await db.from("notifications").insert(
        hrs.map((p) => ({
          tenant_id: s.tenantId,
          user_id: p.id,
          title: "Firma no conforme",
          body: reason,
        })),
      );
    }
  }

  revalidatePath("/empleado/recibos");
  revalidatePath("/rrhh/recibos");
}
