import { Shell } from "@/components/shell";
import { requireEmployee } from "@/lib/auth/session";
import { getMyEmployee } from "@/lib/files";
import { updateMyProfile } from "@/modules/profile/actions";

export default async function PerfilEmpleado() {
  const s = await requireEmployee();
  const me = await getMyEmployee(s);

  return (
    <Shell area="empleado" title="Mi perfil" session={s}>
      {!me ? (
        <p className="text-sm text-zinc-500">No hay ficha asociada a tu usuario.</p>
      ) : (
        <form action={updateMyProfile} className="max-w-md space-y-3 rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">
            {me.last_name}, {me.first_name} · Legajo {me.employee_number}
          </p>
          <input name="email" type="email" defaultValue={me.email ?? ""} className="w-full rounded-lg border px-3 py-2 text-sm" />
          <input name="phone" defaultValue={me.phone ?? ""} placeholder="Teléfono" className="w-full rounded-lg border px-3 py-2 text-sm" />
          <button className="rounded-lg bg-[#142236] px-4 py-2 text-sm text-white">Guardar</button>
        </form>
      )}
    </Shell>
  );
}
