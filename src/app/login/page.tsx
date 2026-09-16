import { LoginForm } from "./login-form";

export default function LoginPage() {
  const name = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Inex";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#081525] p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Fichaje, recibos y tu equipo. En un solo lugar.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            El empleado ficha con el celular. RRHH ve asistencia, liquida y publica el recibo. Sin planillas sueltas.
          </p>
        </div>
        <p className="mt-16 text-xs text-white/35">Acceso restringido · datos aislados por empresa</p>
      </section>
      <section className="flex items-center justify-center bg-[#e8edf3] p-8">
        <div className="w-full max-w-md rounded-2xl border border-[#d5dee8] bg-white p-8 shadow-[0_24px_80px_rgba(8,21,37,0.08)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={name} className="mx-auto mb-8 h-16 w-auto max-w-[240px] object-contain" />
          <h2 className="text-center text-2xl font-semibold text-[#081525]">Iniciar sesión</h2>
          <p className="mt-1 text-center text-sm text-[#5b6b80]">Portal de Recursos Humanos</p>
          <LoginForm />
          <p className="mt-6 space-y-2 text-center text-sm">
            <a href="/activar" className="block text-[#142236] underline-offset-4 hover:underline">
              Empleado: primera vez (DNI)
            </a>
            <a href="/login/recuperar" className="block text-[#142236] underline-offset-4 hover:underline">
              Me invitaron a una empresa / olvidé la contraseña
            </a>
          </p>
          <div className="mt-8 space-y-1 border-t border-[#d5dee8] pt-4 text-xs text-[#5b6b80]">
            <p className="font-medium text-[#081525]">Cuentas de demostración · clave InexDemo123!</p>
            <p>super@inex.demo — solo alta de empresas</p>
            <p>hr@inex.demo — RRHH de la empresa demo</p>
            <p>empleado@inex.demo — portal de la persona</p>
          </div>
        </div>
      </section>
    </main>
  );
}
