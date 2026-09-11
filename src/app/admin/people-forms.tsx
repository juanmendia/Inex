"use client";

import { useActionState } from "react";
import { createTenant, grantTenantAccess, inviteSuperAdmin, deleteTenant, resetTempPassword } from "@/modules/tenants/actions";

export function CreateTenantForm() {
  const [message, action, pending] = useActionState(createTenant, null);
  return (
    <form action={action} className="panel mt-6 grid gap-2 p-5 md:grid-cols-2">
      <p className="text-xs tracking-widest uppercase md:col-span-2" style={{ color: "var(--muted)" }}>
        Nueva empresa
      </p>
      <input name="name" required placeholder="Nombre de la empresa" className="field md:col-span-2" />
      <input name="admin_email" type="email" required placeholder="Correo del administrador de RRHH" className="field" />
      <input name="admin_name" placeholder="Nombre de esa persona" className="field" />
      <p className="text-xs md:col-span-2" style={{ color: "var(--muted)" }}>
        Se crea la empresa y una clave temporal fácil (tipo Inex4821!). Copiála y pasásela al de RRHH: entra
        con su correo, cambia la clave al primer ingreso y arma empleados. No se manda mail.
      </p>
      {message ? <p className="text-sm md:col-span-2" style={{ color: "var(--accent)" }}>{message}</p> : null}
      <button disabled={pending} className="btn btn-primary md:col-span-2">
        {pending ? "Creando…" : "Crear empresa"}
      </button>
    </form>
  );
}

export function InviteSuperForm() {
  const [message, action, pending] = useActionState(inviteSuperAdmin, null);
  return (
    <form action={action} className="panel mt-6 grid gap-2 p-5 md:grid-cols-2">
      <p className="text-xs tracking-widest uppercase md:col-span-2" style={{ color: "var(--muted)" }}>
        Superadmins de la plataforma
      </p>
      <input name="email" type="email" required placeholder="Correo (el tuyo real u otra persona)" className="field" />
      <input name="name" placeholder="Nombre" className="field" />
      <p className="text-xs md:col-span-2" style={{ color: "var(--muted)" }}>
        Esta cuenta solo ve empresas y da accesos de RRHH. Clave temporal en pantalla; la cambia al entrar.
      </p>
      {message ? (
        <p className="max-w-3xl break-all text-sm md:col-span-2" style={{ color: "var(--accent)" }}>
          {message}
        </p>
      ) : null}
      <button disabled={pending} className="btn btn-primary md:col-span-2">
        {pending ? "Invitando…" : "Agregar superadmin"}
      </button>
    </form>
  );
}

export function GrantAccessForm({ tenantId }: { tenantId: string }) {
  const [message, action, pending] = useActionState(grantTenantAccess, null);
  return (
    <form action={action} className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input name="admin_email" type="email" required placeholder="Otro administrador (correo)" className="field max-w-xs" />
        <input name="admin_name" placeholder="Nombre" className="field max-w-[12rem]" />
        <button disabled={pending} className="btn btn-ghost">
          {pending ? "Guardando…" : "Agregar administrador"}
        </button>
      </div>
      {message ? (
        <p className="max-w-3xl break-all text-xs" style={{ color: "var(--accent)" }}>
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
        {pending ? "…" : "Nueva clave temporal"}
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
      <button type="submit" className="btn btn-ghost text-xs text-red-400">
        Eliminar
      </button>
    </form>
  );
}
