function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Falta variable de entorno: ${name}`);
  return value;
}

export function publicEnv() {
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return {
    platformName: process.env.NEXT_PUBLIC_PLATFORM_NAME ?? "Inex",
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      supabaseAnonKey,
    ),
  };
}

export function serverEnv() {
  return {
    ...publicEnv(),
    supabaseServiceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}
