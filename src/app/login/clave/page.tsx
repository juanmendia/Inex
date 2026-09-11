"use client";

import { useActionState } from "react";
import { setPasswordFirstTime } from "@/modules/auth/actions";

export default function ClaveObligatoriaPage() {
  const [error, action, pending] = useActionState(setPasswordFirstTime, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e4d9c7] bg-[#fffcf7] p-8">
        <h1 className="text-2xl font-semibold">Cambiá tu contraseña</h1>
        <p className="mt-2 text-sm text-[#6f675c]">Por seguridad tenés que definir una clave propia antes de continuar.</p>
        <form action={action} className="mt-6 space-y-3">
          <input name="password" type="password" required placeholder="Nueva contraseña (mín. 8)" className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5" />
          <input name="confirm" type="password" required placeholder="Repetí la contraseña" className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5" />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button disabled={pending} className="w-full rounded-xl bg-[#1f5c56] py-3 text-sm text-[#f7f1e4]">
            Guardar e ingresar
          </button>
        </form>
      </div>
    </main>
  );
}
