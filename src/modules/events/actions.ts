"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";

export async function createEvent(formData: FormData) {
  const s = await requireStaff();
  const title = String(formData.get("title") ?? "").trim();
  const starts = String(formData.get("starts_at") ?? "");
  if (!title || !starts) throw new Error("Título y fecha son obligatorios.");
  const db = createAdminClient();
  const { error } = await db.from("events").insert({
    tenant_id: s.tenantId,
    title,
    description: String(formData.get("description") ?? "") || null,
    type: String(formData.get("type") ?? "internal"),
    starts_at: new Date(starts).toISOString(),
    location: String(formData.get("location") ?? "") || null,
    created_by: s.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/rrhh/eventos");
  revalidatePath("/empleado");
}

export async function saveTenantSettings(formData: FormData) {
  const s = await requireStaff();
  const db = createAdminClient();
  await db.from("tenants").update({ name: String(formData.get("name") ?? "").trim() }).eq("id", s.tenantId!);
  const row = {
    tenant_id: s.tenantId,
    legal_name: String(formData.get("legal_name") ?? "") || null,
    cuit: String(formData.get("cuit") ?? "") || null,
    recibo_sucursal: String(formData.get("recibo_sucursal") ?? "") || null,
    recibo_categoria: String(formData.get("recibo_categoria") ?? "") || null,
    primary_color: String(formData.get("primary_color") ?? "#163a5f"),
    secondary_color: String(formData.get("secondary_color") ?? "#c9a227"),
    monthly_hours: Number(formData.get("monthly_hours") || 176),
    require_mobile_punch: String(formData.get("require_mobile_punch") ?? "") === "on",
  };
  const { error } = await db.from("tenant_settings").upsert(row);
  if (error) {
    const { recibo_sucursal: _a, recibo_categoria: _b, ...base } = row;
    const e2 = await db.from("tenant_settings").upsert(base);
    if (e2.error) throw new Error(e2.error.message + " Corré 0021_recibo_empresa.sql.");
  }
  revalidatePath("/rrhh/configuracion");
  revalidatePath("/rrhh/recibos");
}
