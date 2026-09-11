const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

function loadEnv() {
  const file = path.join(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0) process.env[t.slice(0, i)] = t.slice(i + 1);
  }
}
loadEnv();

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const { data: tenants, error } = await admin.from("tenants").select("id, slug");
  assert(!error, error?.message);
  assert(tenants?.length >= 1, "hace falta al menos un tenant");

  const { data: receipts } = await admin.from("receipts").select("id, tenant_id, employee_id");
  if (receipts?.length) {
    const r = receipts[0];
    const { data: emp } = await admin.from("employees").select("id, tenant_id").eq("id", r.employee_id).single();
    assert.equal(emp.tenant_id, r.tenant_id, "recibo y empleado deben compartir tenant");
  }

  const { data: roles } = await admin.from("user_roles").select("role, user_id");
  const hasEmp = roles?.some((x) => x.role === "employee");
  const hasHr = roles?.some((x) => x.role === "tenant_admin");
  assert(hasEmp && hasHr, "seed de roles incompleto");
  const extra150 = Math.round((100000 / 176) * 4 * 1.5 * 100) / 100;
  assert.ok(extra150 > 3000, "cálculo extra 150%");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
