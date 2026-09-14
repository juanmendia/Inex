import { requestOrigin } from "@/lib/origin";

export async function sendEmployeeAccessEmail(opts: {
  to: string;
  name: string;
  dni: string;
  pass: string;
  company: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Inex <onboarding@resend.dev>";
  if (!key) return { ok: false as const, reason: "no_mailer" };
  const origin = await requestOrigin();
  const text = `Hola ${opts.name},

${opts.company} te dio acceso a Inex (fichaje, recibos y documentos).

Usuario (tu DNI): ${opts.dni}
Clave temporal: ${opts.pass}

Entrá en ${origin}/login con el DNI y esa clave. Te va a pedir cambiarla.
Todos los días fichás en Fichaje.

Si no pediste esto, avisale a RRHH.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: `Tu acceso a Inex · ${opts.company}`,
      text,
    }),
  });
  if (!res.ok) return { ok: false as const, reason: "send_fail" };
  return { ok: true as const };
}
