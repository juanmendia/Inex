"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/roles";
import { getMyEmployee } from "@/lib/files";
import { requireEmployee } from "@/lib/auth/session";

export async function createTicket(formData: FormData) {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);
  if (!me) throw new Error("Sin ficha de empleado.");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  if (!subject || !body) throw new Error("Completá asunto y mensaje.");
  const db = createAdminClient();
  const { data, error } = await db
    .from("hr_tickets")
    .insert({
      tenant_id: s.tenantId,
      employee_id: me.id,
      category,
      subject,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await db.from("hr_ticket_messages").insert({
    tenant_id: s.tenantId,
    ticket_id: data.id,
    author_id: s.userId,
    body,
  });
  revalidatePath("/empleado/consultas");
  revalidatePath("/rrhh/consultas");
}

export async function addTicketMessage(formData: FormData) {
  const s = await getSessionContext();
  if (!s?.tenantId) redirect("/login");
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) throw new Error("Escribí un mensaje.");
  const db = createAdminClient();
  const { data: ticket } = await db
    .from("hr_tickets")
    .select("id, employee_id")
    .eq("id", ticketId)
    .eq("tenant_id", s.tenantId)
    .maybeSingle();
  if (!ticket) throw new Error("Consulta inválida.");
  if (!isStaff(s.roles)) {
    const me = await getMyEmployee(s);
    if (!me || me.id !== ticket.employee_id) throw new Error("No autorizado.");
  }
  await db.from("hr_ticket_messages").insert({
    tenant_id: s.tenantId,
    ticket_id: ticketId,
    author_id: s.userId,
    body,
  });
  if (isStaff(s.roles)) {
    await db.from("hr_tickets").update({ status: "answered" }).eq("id", ticketId);
  }
  revalidatePath("/empleado/consultas");
  revalidatePath("/rrhh/consultas");
}
