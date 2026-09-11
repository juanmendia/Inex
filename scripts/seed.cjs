const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const file = path.join(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const PASSWORD = "InexDemo123!";
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureUser(email, fullName) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const existing = data.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { ...(existing.app_metadata ?? {}), must_change_password: false },
    });
    return existing;
  }
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.error) throw created.error;
  return created.data.user;
}

async function main() {
  const { error: ping } = await admin.from("tenants").select("id").limit(1);
  if (ping) {
    console.error("No pude leer public.tenants. ¿Corriste 0001_core.sql?");
    console.error(ping.message);
    process.exit(1);
  }

  let { data: tenant } = await admin.from("tenants").select("id").eq("slug", "demo").maybeSingle();
  if (!tenant) {
    const ins = await admin
      .from("tenants")
      .insert({ name: "Empresa Demo", slug: "demo", status: "active" })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    tenant = ins.data;
    await admin.from("tenant_settings").insert({ tenant_id: tenant.id, legal_name: "Empresa Demo S.A." });
  }

  const superUser = await ensureUser("super@inex.demo", "Super Admin");
  const hrUser = await ensureUser("hr@inex.demo", "Admin RRHH");
  const empUser = await ensureUser("empleado@inex.demo", "Juan Empleado");

  await admin.from("profiles").upsert([
    {
      id: superUser.id,
      email: "super@inex.demo",
      full_name: "Super Admin",
      tenant_id: null,
      status: "active",
    },
    {
      id: hrUser.id,
      email: "hr@inex.demo",
      full_name: "Admin RRHH",
      tenant_id: tenant.id,
      status: "active",
    },
    {
      id: empUser.id,
      email: "empleado@inex.demo",
      full_name: "Juan Empleado",
      tenant_id: tenant.id,
      status: "active",
    },
  ]);

  await admin.from("user_roles").delete().in("user_id", [superUser.id, hrUser.id, empUser.id]);
  await admin.from("user_roles").insert([
    { user_id: superUser.id, role: "super_admin", tenant_id: null },
    { user_id: hrUser.id, role: "tenant_admin", tenant_id: tenant.id },
    { user_id: empUser.id, role: "employee", tenant_id: tenant.id },
  ]);

  await admin.auth.admin.updateUserById(superUser.id, {
    app_metadata: { roles: ["super_admin"], must_change_password: false },
  });
  await admin.auth.admin.updateUserById(hrUser.id, {
    app_metadata: { roles: ["tenant_admin"], must_change_password: false },
  });
  await admin.auth.admin.updateUserById(empUser.id, {
    app_metadata: { roles: ["employee"], must_change_password: false },
  });

  const { data: employee } = await admin
    .from("employees")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("employee_number", "1001")
    .maybeSingle();

  if (!employee) {
    const emp = await admin.from("employees").insert({
      tenant_id: tenant.id,
      user_id: empUser.id,
      employee_number: "1001",
      first_name: "Juan",
      last_name: "Empleado",
      email: "empleado@inex.demo",
      status: "active",
      birth_date: `${new Date().getFullYear() - 32}-09-10`,
    });
    if (emp.error) throw emp.error;
  } else {
    await admin
      .from("employees")
      .update({ birth_date: `${new Date().getFullYear() - 32}-09-10`, user_id: empUser.id })
      .eq("id", employee.id);
  }

  const { data: maria } = await admin
    .from("employees")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("employee_number", "1002")
    .maybeSingle();
  if (!maria) {
    const ins = await admin.from("employees").insert({
      tenant_id: tenant.id,
      employee_number: "1002",
      first_name: "María",
      last_name: "Pérez",
      email: "maria@inex.demo",
      status: "active",
      birth_date: "1990-03-21",
    });
    if (ins.error) throw ins.error;
  }

  const { data: ev } = await admin.from("events").select("id").eq("tenant_id", tenant.id).limit(1);
  if (!ev?.length) {
    const starts = new Date();
    starts.setDate(starts.getDate() + 5);
    await admin.from("events").insert({
      tenant_id: tenant.id,
      title: "Capacitación interna",
      type: "training",
      starts_at: starts.toISOString(),
      location: "Sede central",
      created_by: hrUser.id,
    });
  }

  const buckets = await admin.storage.listBuckets();
  if (!buckets.data?.find((b) => b.name === "documents")) {
    const { error: bErr } = await admin.storage.createBucket("documents", {
      public: false,
      fileSizeLimit: 10485760,
    });
    if (bErr) console.warn("bucket:", bErr.message);
  }

  console.log("Seed OK. Abrí http://localhost:3002/login");
  console.log("  super@inex.demo     / InexDemo123!  → /admin");
  console.log("  hr@inex.demo        / InexDemo123!  → /rrhh");
  console.log("  empleado@inex.demo  / InexDemo123!  → /empleado");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
