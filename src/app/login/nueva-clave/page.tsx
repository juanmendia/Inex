"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function NuevaClavePage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    async function boot() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error: ex } = await supabase.auth.exchangeCodeForSession(code);
        if (ex) setError("El enlace venció o ya se usó. Pedí uno nuevo desde la consola.");
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        done = true;
        setReady(true);
      }
    }

    boot();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        done = true;
        setReady(true);
      }
    });
    const t = window.setTimeout(() => {
      if (!done) {
        setError("No se pudo validar el enlace. Abrilo de nuevo en esta misma computadora, o pedí uno nuevo.");
      }
    }, 4000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: upd } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (upd) {
      setError("El enlace venció o es inválido. Pedí uno nuevo.");
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e4d9c7] bg-[#fffcf7] p-8">
        <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-[#6f675c]">
          Definí tu clave. Después ingresás con tu correo (superadmin o RRHH) o con tu DNI si sos empleado.
        </p>
        {ready ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Nueva contraseña"
              className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5"
            />
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              placeholder="Repetí la contraseña"
              className="w-full rounded-xl border border-[#e4d9c7] px-3 py-2.5"
            />
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button disabled={pending} className="w-full rounded-xl bg-[#142236] py-3 text-sm text-white">
              Guardar
            </button>
          </form>
        ) : (
          <>
            <p className="mt-6 text-sm text-[#6f675c]">Validando el enlace…</p>
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
            <p className="mt-4 text-center text-sm">
              <a href="/login/recuperar" className="text-[#142236]">
                Pedir un enlace nuevo
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
