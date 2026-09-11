"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { requireStaff } from "@/lib/auth/session";
import { audit, getMyEmployee, notifyUsers, signedUrlForDocument, uploadPrivatePdf } from "@/lib/files";

export async function publishDocument(formData: FormData) {
  const s = await requireStaff();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "other");
  const employeeId = String(formData.get("employee_id") ?? "") || null;
  const file = formData.get("file");
  if (!title) throw new Error("El título es obligatorio.");
  if (!(file instanceof File) || file.size === 0) throw new Error("Subí un PDF.");

  const { fileId } = await uploadPrivatePdf({
    tenantId: s.tenantId!,
    userId: s.userId,
    folder: "docs",
    file,
  });
  const db = createAdminClient();
  const { data: doc, error } = await db
    .from("documents")
    .insert({
      tenant_id: s.tenantId,
      employee_id: employeeId,
      type,
      title,
      status: "available",
      current_file_id: fileId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await db.from("document_versions").insert({
    document_id: doc.id,
    tenant_id: s.tenantId,
    file_id: fileId,
    version: 1,
  });
  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: "publish",
    entityType: "document",
    entityId: doc.id,
  });

  if (employeeId) {
    const { data: emp } = await db.from("employees").select("user_id").eq("id", employeeId).single();
    if (emp?.user_id) await notifyUsers(s.tenantId!, [emp.user_id], "Nuevo documento", title);
  } else {
    const { data: profiles } = await db.from("profiles").select("id").eq("tenant_id", s.tenantId!);
    await notifyUsers(s.tenantId!, (profiles ?? []).map((p) => p.id), "Nuevo documento", title);
  }
  revalidatePath("/rrhh/documentos");
  revalidatePath("/empleado/documentos");
}

export async function getDocumentUrl(documentId: string) {
  const s = await getSessionContext();
  if (!s?.tenantId) throw new Error("No autorizado");
  const db = createAdminClient();
  const { data: doc } = await db
    .from("documents")
    .select("id, employee_id, tenant_id")
    .eq("id", documentId)
    .eq("tenant_id", s.tenantId)
    .maybeSingle();
  if (!doc) throw new Error("No autorizado");
  if (!isStaff(s.roles)) {
    const me = await getMyEmployee(s);
    if (doc.employee_id && doc.employee_id !== me?.id) throw new Error("No autorizado");
  }
  return signedUrlForDocument(doc.id);
}
