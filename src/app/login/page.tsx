import { LoginForm } from "./login-form";

export default function LoginPage() {
  const name = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Inex";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#0b0f14] p-12 text-[#eee8d8] lg:flex lg:flex-col lg:justify-between">
        <p className="text-[11px] tracking-[0.35em] uppercase text-[#c9a227]">{name}</p>
        <div>
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Recursos humanos con la seriedad de un producto de empresa.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-white/55">
            Tres espacios: plataforma, RRHH y portal del empleado. Cada uno, una identidad.
          </p>
        </div>
        <p className="text-xs text-white/35">Acceso restringido · datos aislados por empresa</p>
      </section>
      <section className="flex items-center justify-center bg-[#f3efe6] p-8">
        <div className="w-full max-w-md rounded-2xl border border-[#e4d9c7] bg-[#fffcf7] p-8 shadow-[0_24px_80px_rgba(28,25,20,0.08)]">
          <p className="text-[11px] tracking-[0.28em] text-[#1f5c56] uppercase">{name}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1c1914]">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-[#6f675c]">Portal de Recursos Humanos</p>
          <LoginForm />
          <p className="mt-6 text-center text-sm space-y-2">
            <a href="/activar" className="block text-[#1f5c56] underline-offset-4 hover:underline">
              Empleado: primera vez (DNI)
            </a>
            <a href="/login/recuperar" className="block text-[#1f5c56] underline-offset-4 hover:underline">
              Me invitaron a una empresa / olvidé la contraseña
            </a>
          </p>
          <div className="mt-8 space-y-1 border-t border-[#e4d9c7] pt-4 text-xs text-[#6f675c]">
            <p className="font-medium text-[#1c1914]">Cuentas de demostración · clave InexDemo123!</p>
            <p>super@inex.demo — solo alta de empresas</p>
            <p>hr@inex.demo — RRHH de la empresa demo</p>
            <p>empleado@inex.demo — portal de la persona</p>
          </div>
        </div>
      </section>
    </main>
  );
}
