import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logout } from "@/modules/auth/actions";
import { TENANT_STATUS } from "@/lib/labels";
import { RoleCode } from "@/types/enums";

export default async function BloqueadoPage() {
  const s = await getSessionContext();
  if (!s) redirect("/login");
  if (s.roles.includes(RoleCode.SUPER_ADMIN)) redirect("/admin");

  const db = createAdminClient();
  const { data: t } = s.tenantId
    ? await db.from("tenants").select("name, status, block_reason").eq("id", s.tenantId).maybeSingle()
    : { data: null };
  if (t?.status === "active") redirect("/rrhh");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8edf3] p-8">
      <div className="w-full max-w-md rounded-2xl border border-[#d5dee8] bg-white p-8 text-center shadow-[0_24px_80px_rgba(8,21,37,0.08)]">
        <h1 className="text-xl font-semibold text-[#081525]">Empresa bloqueada</h1>
        <p className="mt-3 text-sm text-[#5b6b80]">
          {t?.name ? `${t.name} está ${TENANT_STATUS[t.status] ?? t.status}.` : "Tu empresa no está activa."}{" "}
          {t?.block_reason ? `Motivo: ${t.block_reason}.` : "Consultá a Inex."}
        </p>
        <p className="mt-2 text-xs text-[#5b6b80]">RRHH y el portal de empleados quedan cerrados hasta reactivar el servicio.</p>
        <form action={logout} className="mt-6">
          <button className="btn btn-primary">Salir</button>
        </form>
      </div>
    </main>
  );
}
