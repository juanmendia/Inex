"use server";

import { requireEmployee } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployee } from "@/lib/files";

export async function updateMyProfile(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha de empleado.");
  const db = createAdminClient();
  const { error } = await db
    .from("employees")
    .update({
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
    })
    .eq("id", me.id)
    .eq("tenant_id", s.tenantId!);
  if (error) throw new Error(error.message);
  await db
    .from("profiles")
    .update({
      email: String(formData.get("email") ?? s.email).trim(),
    })
    .eq("id", s.userId);
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/empleado/perfil");
}
