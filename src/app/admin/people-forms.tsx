"use client";

import { useActionState } from "react";
import { createTenant, grantTenantAccess, inviteSuperAdmin, deleteTenant, resetTempPassword } from "@/modules/tenants/actions";

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

export function DeleteTenantButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteTenant}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar ${name}? Se borra la empresa, empleados, recibos y fichajes.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn-ghost text-xs text-red-700">
        Eliminar
      </button>
    </form>
  );
}
