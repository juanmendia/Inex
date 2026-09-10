export default function Home() {
  const name = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Inex";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8">
      <div className="max-w-md text-center">
        <p className="text-sm tracking-wide text-zinc-500 uppercase">{name}</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          Plataforma de Recursos Humanos
        </h1>
        <p className="mt-3 text-zinc-600">
          Proyecto Supabase: {url.replace("https://", "")}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Corré la migración 0001_core.sql en el SQL Editor de Supabase para
          crear tablas y RLS.
        </p>
      </div>
    </main>
  );
}
