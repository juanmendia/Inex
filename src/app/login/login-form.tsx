"use client";

import { useActionState } from "react";
import { login } from "@/modules/auth/actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block text-left text-sm text-[#3d3830]">
        Usuario
        <input
          name="user"
          autoComplete="username"
          required
          placeholder="DNI o correo"
          className="mt-1 w-full rounded-xl border border-[#e4d9c7] bg-white px-3 py-2.5 text-[#1c1914] outline-none focus:border-[#1f5c56]"
        />
      </label>
      <p className="text-xs text-[#6f675c]">Plataforma y RRHH, con correo. El empleado, con su DNI.</p>
      <label className="block text-left text-sm text-[#3d3830]">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-[#e4d9c7] bg-white px-3 py-2.5 text-[#1c1914] outline-none focus:border-[#1f5c56]"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#1f5c56] py-3 text-sm font-medium text-[#f7f1e4] disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
