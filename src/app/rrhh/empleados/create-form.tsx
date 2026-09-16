"use client";

import { useActionState, useState } from "react";
import { createEmployee, resetEmployeePassword } from "@/modules/employees/actions";
import { DialogSheet, Overlay } from "@/components/overlay";

type Branch = { id: string; name: string };
type Agreement = { id: string; name: string };

function parseOk(raw: string | null) {
  if (!raw?.startsWith("OK|")) return null;
  const [, dni, pass, mail] = raw.split("|");
  return { dni, pass, mailed: mail === "mail" };
}

function AccessCard({
  dni,
  pass,
  mailed,
  onClose,
}: {
  dni: string;
  pass: string;
  mailed?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#142236]/30 bg-[#e8f0ff] p-4 text-sm">
      <p className="font-medium">Usuario y clave temporal</p>
      <p className="mt-3">
        Usuario (DNI): <span className="select-all font-mono text-base">{dni}</span>
      </p>
      <p className="mt-1">
        Clave temporal: <span className="select-all font-mono text-base">{pass}</span>
      </p>
      <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
        {mailed
          ? "Se mandó al correo personal del empleado. "
          : "El mail no salió (falta configurar envío). Queda copiada acá y en la lista hasta que el empleado la cambie. "}
        Entra en Inex con DNI y esa clave. La cambia al primer ingreso.
      </p>
      {onClose ? (
        <button type="button" className="btn btn-ghost mt-2 text-xs" onClick={onClose}>
          Listo, ya la copié
        </button>
      ) : null}
    </div>
  );
}

export function CreateEmployeeForm({
  branches,
  agreements,
}: {
  branches: Branch[];
  agreements: Agreement[];
}) {
  const [error, action, pending] = useActionState(createEmployee, null);
  const access = parseOk(error);
  const fail = error && !access ? error : null;

  return (
    <form action={action} className="panel mb-6 grid gap-2 p-5 md:grid-cols-4">
      <p className="text-sm font-medium md:col-span-4">Nuevo empleado de esta empresa</p>
      <input name="employee_number" required placeholder="Legajo" className="field" />
      <input name="first_name" required placeholder="Nombre" className="field" />
      <input name="last_name" required placeholder="Apellido" className="field" />
      <input name="dni" required placeholder="DNI (usuario de ingreso)" className="field" />
      <input name="email" type="email" required placeholder="Correo personal" className="field" />
      <input name="phone" placeholder="Teléfono" className="field" />
      <label className="text-xs" style={{ color: "var(--muted)" }}>
        Fecha de nacimiento
        <input name="birth_date" type="date" className="field mt-1" />
      </label>
      <label className="text-xs" style={{ color: "var(--muted)" }}>
        Fecha de ingreso a la empresa
        <input name="hire_date" type="date" className="field mt-1" />
      </label>
      <label className="text-xs md:col-span-2" style={{ color: "var(--muted)" }}>
        Sucursal donde ficha
        <select name="work_location_id" className="field mt-1">
          <option value="">Cualquier sucursal</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              Solo {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs md:col-span-2" style={{ color: "var(--muted)" }}>
        Convenio
        <select name="agreement_id" className="field mt-1">
          <option value="">Sin convenio</option>
          {agreements.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs md:col-span-4" style={{ color: "var(--muted)" }}>
        Al crear se manda el acceso al correo del empleado y la clave queda en esta lista hasta que la cambie.
        {agreements.length === 0 ? (
          <>
            {" "}
            Todavía no hay convenios: cargá el listado típico en{" "}
            <a href="/rrhh/convenios" className="underline">
              Convenios
            </a>
            .
          </>
        ) : null}
        Sucursales en{" "}
        <a href="/rrhh/configuracion" className="underline">
          Configuración
        </a>
        .
      </p>
      {fail ? <p className="text-sm text-red-700 md:col-span-4">{fail}</p> : null}
      {access ? (
        <div className="md:col-span-4">
          <AccessCard dni={access.dni} pass={access.pass} mailed={access.mailed} />
        </div>
      ) : null}
      <button disabled={pending} className="btn btn-primary md:col-span-4">
        {pending ? "Creando…" : "Crear empleado y acceso"}
      </button>
    </form>
  );
}

export function ResetEmployeeKey({ id }: { id: string }) {
  const [message, action, pending] = useActionState(resetEmployeePassword, null);
  const [open, setOpen] = useState(true);
  const access = parseOk(message);
  const fail = message && !access ? message : null;

  return (
    <div className="flex flex-col items-end">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button disabled={pending} className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>
          {pending ? "…" : "Nueva clave temporal"}
        </button>
      </form>
      {fail ? <p className="text-[11px] text-red-700">{fail}</p> : null}
      {access && open ? (
        <Overlay onClose={() => setOpen(false)}>
          <DialogSheet>
            <AccessCard
              dni={access.dni}
              pass={access.pass}
              mailed={access.mailed}
              onClose={() => setOpen(false)}
            />
          </DialogSheet>
        </Overlay>
      ) : null}
    </div>
  );
}
