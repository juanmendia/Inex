"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { audit, notifyUsers } from "@/lib/files";

export async function publishAnnouncement(formData: FormData) {
  const s = await requireStaff();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) throw new Error("Título y contenido son obligatorios.");
  const db = createAdminClient();
  const { error } = await db.from("announcements").insert({
    tenant_id: s.tenantId,
    title,
    body,
    published_at: new Date().toISOString(),
    created_by: s.userId,
  });
  if (error) throw new Error(error.message);
  const { data: profiles } = await db.from("profiles").select("id").eq("tenant_id", s.tenantId!);
  await notifyUsers(s.tenantId!, (profiles ?? []).map((p) => p.id), "Nueva comunicación", title);
  await audit({ tenantId: s.tenantId, userId: s.userId, action: "publish", entityType: "announcement" });
  revalidatePath("/rrhh/comunicaciones");
  revalidatePath("/empleado/comunicaciones");
}
