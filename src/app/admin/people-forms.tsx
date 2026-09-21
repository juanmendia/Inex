"use client";

import { useActionState } from "react";
import { createTenant, grantTenantAccess, inviteSuperAdmin, deleteTenant, resetTempPassword, setTenantStatus } from "@/modules/tenants/actions";
import { ConfirmForm } from "@/components/confirm-dialog";

export function CreateTenantForm() {
  const [message, action, pending] = useActionState(createTenant, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="name" required placeholder="Nombre de la empresa" className="field field-sm" />
      <input name="admin_email" type="email" required placeholder="Correo de RRHH" className="field field-sm" />
      <input name="admin_name" placeholder="Nombre" className="field field-sm" />
      <button disabled={pending} className="btn btn-primary">
        {pending ? "Creando…" : "Crear"}
      </button>
      {message ? <p className="basis-full text-sm" style={{ color: "var(--accent)" }}>{message}</p> : null}
    </form>
  );
}

export function InviteSuperForm() {
  const [message, action, pending] = useActionState(inviteSuperAdmin, null);
  return (
    <form action={action} className="space-y-2">
      <input name="email" type="email" required placeholder="Correo" className="field" />
      <input name="name" placeholder="Nombre" className="field" />
      <button disabled={pending} className="btn btn-primary">
        {pending ? "…" : "Agregar"}
      </button>
      {message ? (
        <p className="text-sm break-all" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function GrantAccessForm({ tenantId }: { tenantId: string }) {
  const [message, action, pending] = useActionState(grantTenantAccess, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input name="admin_email" type="email" required placeholder="Correo" className="field field-sm" />
        <input name="admin_name" placeholder="Nombre" className="field field-sm" />
        <button disabled={pending} className="btn btn-primary">
          {pending ? "…" : "Agregar"}
        </button>
      </div>
      {message ? (
        <p className="text-xs break-all" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function ResetTempPasswordForm({ email }: { email: string }) {
  const [message, action, pending] = useActionState(resetTempPassword, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="email" value={email} />
      <button disabled={pending} className="btn btn-ghost text-xs">
        {pending ? "…" : "Nueva clave"}
      </button>
      {message ? (
        <span className="max-w-xs text-right text-[11px]" style={{ color: "var(--accent)" }}>
          {message}
        </span>
      ) : null}
    </form>
  );
}

export function TenantStatusForm({
  id,
  status,
  reason,
}: {
  id: string;
  status: string;
  reason: string | null;
}) {
  if (status !== "active") {
    return (
      <form action={setTenantStatus} className="flex flex-col items-end gap-1">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="next_status" value="active" />
        {reason ? (
          <p className="max-w-[12rem] text-right text-[11px]" style={{ color: "var(--muted)" }}>
            {reason}
          </p>
        ) : null}
        <button className="btn btn-primary text-xs">Activar</button>
      </form>
    );
  }
  return (
    <form action={setTenantStatus} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <select name="next_status" className="field field-sm w-36">
        <option value="suspended">Suspender</option>
        <option value="cancelled">Dar de baja</option>
      </select>
      <select name="block_reason" className="field field-sm w-36">
        <option value="Falta de pago">Falta de pago</option>
        <option value="Contrato vencido">Contrato vencido</option>
        <option value="Baja a pedido">Baja a pedido</option>
        <option value="Otro">Otro</option>
      </select>
      <button className="btn btn-ghost text-xs">Aplicar</button>
    </form>
  );
}

export function DeleteTenantButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmForm
      action={deleteTenant}
      title={`¿Eliminar ${name}?`}
      body="Se borra la empresa, empleados, recibos y fichajes."
      confirm="Eliminar"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-ghost text-xs text-red-700">
        Eliminar
      </button>
    </ConfirmForm>
  );
}
