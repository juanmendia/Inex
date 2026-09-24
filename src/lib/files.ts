import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionContext } from "@/lib/auth/session";

const BUCKET = "documents";

export async function ensureBucket() {
  const db = createAdminClient();
  const { data } = await db.storage.getBucket(BUCKET);
  if (!data) {
    await db.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
  }
}

export async function uploadPrivatePdf(opts: {
  tenantId: string;
  userId: string | null;
  folder: string;
  file: File;
}) {
  if (opts.file.type !== "application/pdf" && !opts.file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Solo se aceptan PDF.");
  }
  if (opts.file.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10 MB.");

  await ensureBucket();
  const db = createAdminClient();
  const ext = "pdf";
  const storagePath = `${opts.tenantId}/${opts.folder}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await opts.file.arrayBuffer());
  const up = await db.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (up.error) throw new Error(up.error.message);

  const { data: fileRow, error } = await db
    .from("files")
    .insert({
      tenant_id: opts.tenantId,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: opts.file.size,
      created_by: opts.userId || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { fileId: fileRow.id, storagePath };
}

export async function uploadPrivatePdfBytes(opts: {
  tenantId: string;
  userId: string | null;
  folder: string;
  bytes: Buffer;
  filename?: string;
}) {
  return uploadPrivatePdf({
    tenantId: opts.tenantId,
    userId: opts.userId ?? "",
    folder: opts.folder,
    file: new File([new Uint8Array(opts.bytes)], opts.filename ?? "recibo.pdf", { type: "application/pdf" }),
  });
}

export async function uploadPunchPhoto(opts: { tenantId: string; file: File }) {
  const type = opts.file.type || "image/jpeg";
  if (!type.startsWith("image/")) return { error: "La foto tiene que ser una imagen." };
  if (opts.file.size > 6 * 1024 * 1024) return { error: "La foto es muy pesada." };
  await ensureBucket();
  const db = createAdminClient();
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const storagePath = `${opts.tenantId}/punch/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await opts.file.arrayBuffer());
  const up = await db.storage.from(BUCKET).upload(storagePath, buf, { contentType: type, upsert: false });
  if (up.error) return { error: up.error.message };
  return { path: storagePath };
}

export async function uploadLeaveAttachment(opts: { tenantId: string; userId: string | null; file: File }) {
  const type = opts.file.type || "";
  const name = opts.file.name.toLowerCase();
  const okImg = type.startsWith("image/");
  const okPdf = type === "application/pdf" || name.endsWith(".pdf");
  if (!okImg && !okPdf) return { error: "El certificado tiene que ser foto o PDF." };
  if (opts.file.size > 8 * 1024 * 1024) return { error: "El archivo es muy pesado (máx. 8 MB)." };
  await ensureBucket();
  const db = createAdminClient();
  const ext = okPdf ? "pdf" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const storagePath = `${opts.tenantId}/licencias/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await opts.file.arrayBuffer());
  const up = await db.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: okPdf ? "application/pdf" : type || "image/jpeg",
    upsert: false,
  });
  if (up.error) return { error: up.error.message };
  return { path: storagePath };
}

export async function signedUrl(storagePath: string) {
  const db = createAdminClient();
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(storagePath, 120);
  if (error || !data) throw new Error(error?.message ?? "No se pudo firmar la URL");
  return data.signedUrl;
}

export async function signedUrlForDocument(documentId: string) {
  const db = createAdminClient();
  const { data: doc } = await db.from("documents").select("current_file_id").eq("id", documentId).single();
  if (!doc?.current_file_id) throw new Error("Archivo no encontrado");
  const { data: file } = await db.from("files").select("storage_path").eq("id", doc.current_file_id).single();
  if (!file) throw new Error("Archivo no encontrado");
  return signedUrl(file.storage_path);
}

export async function notifyUsers(tenantId: string, userIds: string[], title: string, body?: string, href?: string) {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;
  const db = createAdminClient();
  const rows = ids.map((user_id) => ({ tenant_id: tenantId, user_id, title, body: body ?? null, href: href ?? null }));
  const { error } = await db.from("notifications").insert(rows);
  if (error) {
    await db.from("notifications").insert(ids.map((user_id) => ({ tenant_id: tenantId, user_id, title, body: body ?? null })));
  }
}

export async function notifyStaff(tenantId: string, title: string, body?: string, href?: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("role", ["tenant_admin", "hr_admin", "hr_operator"]);
  const ids = [...new Set((data ?? []).map((r) => r.user_id))];
  await notifyUsers(tenantId, ids, title, body, href);
  return ids;
}

export async function getMyEmployee(session: SessionContext) {
  const db = createAdminClient();
  const { data } = await db
    .from("employees")
    .select("*")
    .eq("user_id", session.userId)
    .eq("tenant_id", session.tenantId!)
    .maybeSingle();
  return data;
}

export async function audit(opts: {
  tenantId: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  ua?: string | null;
}) {
  const db = createAdminClient();
  await db.from("audit_logs").insert({
    tenant_id: opts.tenantId,
    user_id: opts.userId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    metadata: opts.metadata ?? {},
    ip_address: opts.ip ?? null,
    user_agent: opts.ua ?? null,
  });
}

/** Texto para /rrhh/actividad: solo lo que RRHH hace a mano. */
export async function staffLog(
  s: { tenantId: string | null; userId: string },
  text: string,
  extra?: { action?: string; entityType?: string; entityId?: string },
) {
  await audit({
    tenantId: s.tenantId,
    userId: s.userId,
    action: extra?.action ?? "staff",
    entityType: extra?.entityType ?? "log",
    entityId: extra?.entityId,
    metadata: { text },
  });
}
