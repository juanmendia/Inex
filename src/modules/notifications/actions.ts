"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";

export async function markNotificationRead(formData: FormData) {
  const s = await requireSession();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", s.userId);
  revalidatePath("/empleado");
  revalidatePath("/rrhh");
  revalidatePath("/admin");
}

export async function markAllNotificationsRead(_formData: FormData) {
  const s = await requireSession();
  const db = createAdminClient();
  await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", s.userId)
    .is("read_at", null);
  revalidatePath("/empleado");
  revalidatePath("/rrhh");
  revalidatePath("/admin");
}
