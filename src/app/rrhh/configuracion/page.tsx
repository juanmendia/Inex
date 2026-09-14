import { Shell } from "@/components/shell";
import { requireStaff } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveTenantSettings } from "@/modules/events/actions";
import { SucursalesPanel } from "./sucursales-panel";

export default async function ConfigPage() {
  const s = await requireStaff();
  const db = createAdminClient();
  const { data: tenant } = await db.from("tenants").select("name").eq("id", s.tenantId!).single();
  const { data: settings } = await db.from("tenant_settings").select("*").eq("tenant_id", s.tenantId!).maybeSingle();
  const { data: locations } = await db
    .from("work_locations")
    .select("id, name, latitude, longitude, radius_meters")
    .eq("tenant_id", s.tenantId!)
    .order("name");

  return (
    <Shell area="rrhh" title="Configuración" session={s}>
      <div className="mx-auto max-w-3xl space-y-6">
      <form action={saveTenantSettings} className="panel space-y-3 p-6">
        <label className="block text-sm">
          Nombre de la empresa
          <input name="name" defaultValue={tenant?.name} className="field mt-1" />
        </label>
        <label className="block text-sm">
          Razón social
          <input name="legal_name" defaultValue={settings?.legal_name ?? ""} className="field mt-1" />
        </label>
        <label className="block text-sm">
          CUIT
          <input name="cuit" defaultValue={settings?.cuit ?? ""} className="field mt-1" />
        </label>
        <label className="block text-sm">
          Horas mensuales para valor hora
          <input
            name="monthly_hours"
            type="number"
            defaultValue={settings?.monthly_hours ?? 176}
            className="field mt-1"
          />
        </label>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Valor hora = sueldo básico ÷ estas horas. Extra 150 % = × 1,5. Extra 200 % = × 2.
        </p>
        <label className="block text-sm">
          Color institucional
          <input name="primary_color" type="color" defaultValue={settings?.primary_color ?? "#163a5f"} className="ml-2" />
        </label>
        <input type="hidden" name="secondary_color" value={settings?.secondary_color ?? "#c9a227"} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="require_mobile_punch" defaultChecked={Boolean(settings?.require_mobile_punch)} />
          El empleado tiene que fichar desde el celular (GPS en la sede)
        </label>
        <button className="btn btn-primary">Guardar</button>
      </form>

      <SucursalesPanel locations={locations ?? []} />
      </div>
    </Shell>
  );
}
