"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/modules/auth/actions";

export default function RecuperarPage() {
  const [message, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e4d9c7] bg-[#fffcf7] p-8">
        <h1 className="text-2xl font-semibold text-[#1c1914]">Crear o recuperar contraseña</h1>
        <p className="mt-2 text-sm text-[#6f675c]">
          Si te invitaron a administrar una empresa, o olvidaste la clave: ingresá tu correo. El empleado
          puede usar el DNI. Te llega un enlace para definir la contraseña.
        </p>
        <form action={action} className="mt-6 space-y-4">
          <input
            name="user"
            required
            placeholder="DNI o correo personal"
            className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5"
          />
          {message ? <p className="text-sm text-[#142236]">{message}</p> : null}
          <button disabled={pending} className="w-full rounded-xl bg-[#142236] py-3 text-sm text-white">
            Enviar enlace
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          <a href="/login" className="text-[#142236]">
            Volver al ingreso
          </a>
        </p>
      </div>
    </main>
  );
}
