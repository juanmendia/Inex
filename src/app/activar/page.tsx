"use client";

import { useActionState } from "react";
import { activateAccount } from "@/modules/auth/actions";

export default function ActivarPage() {
  const [error, action, pending] = useActionState(activateAccount, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e4d9c7] bg-[#fffcf7] p-8">
        <h1 className="text-2xl font-semibold text-[#1c1914]">Activar cuenta</h1>
        <p className="mt-2 text-sm text-[#6f675c]">
          RRHH ya cargó tu ficha. Ingresá el DNI, el correo personal que te registraron y definí tu
          contraseña. La próxima vez entras solo con DNI y esa clave.
        </p>
        <form action={action} className="mt-6 space-y-3">
          <input name="dni" required placeholder="DNI" className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5" />
          <input name="email" type="email" required placeholder="Correo personal" className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5" />
          <input name="password" type="password" required placeholder="Nueva contraseña (mín. 8)" className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5" />
          <input name="confirm" type="password" required placeholder="Repetí la contraseña" className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5" />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button disabled={pending} className="w-full rounded-xl bg-[#142236] py-3 text-sm text-white">
            {pending ? "Activando…" : "Crear contraseña e ingresar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <a href="/login" className="text-[#142236]">
            Volver
          </a>
        </p>
      </div>
    </main>
  );
}
