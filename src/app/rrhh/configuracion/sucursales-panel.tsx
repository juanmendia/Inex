"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteWorkLocation, saveWorkLocation } from "@/modules/attendance/actions";

export type Sucursal = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
};

function LocationForm({ loc, onDone }: { loc?: Sucursal; onDone: () => void }) {
  const [message, action, pending] = useActionState(saveWorkLocation, null);

  useEffect(() => {
    if (message?.startsWith("Sucursal")) onDone();
  }, [message, onDone]);

  return (
    <form action={action} className="space-y-3">
      {loc ? <input type="hidden" name="id" value={loc.id} /> : null}
      <label className="block text-sm">
        Nombre
        <input name="name" required defaultValue={loc?.name ?? ""} placeholder="Centro, Palermo…" className="field mt-1" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Latitud
          <input name="latitude" required defaultValue={loc?.latitude ?? ""} className="field mt-1" />
        </label>
        <label className="text-sm">
          Longitud
          <input name="longitude" required defaultValue={loc?.longitude ?? ""} className="field mt-1" />
        </label>
      </div>
      <label className="block text-sm">
        Distancia máxima para fichar (metros)
        <input name="radius_meters" type="number" min="20" defaultValue={loc?.radius_meters ?? 150} className="field mt-1" />
      </label>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        El empleado tiene que estar a esa distancia o menos. Si la sucursal muda, actualizá latitud y longitud.
      </p>
      {message && !message.startsWith("Sucursal") ? <p className="text-sm text-red-700">{message}</p> : null}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancelar
        </button>
        <button disabled={pending} className="btn btn-primary">
          {pending ? "Guardando…" : loc ? "Guardar" : "Agregar"}
        </button>
      </div>
    </form>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-[#122033]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function SucursalesPanel({ locations }: { locations: Sucursal[] }) {
  const [modal, setModal] = useState<null | "new" | Sucursal>(null);
  const close = () => setModal(null);

  return (
    <div className="panel mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--line)" }}>
        <div>
          <p className="text-sm font-medium">Sucursales</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Dónde pueden fichar. En el empleado elegís una o cualquiera.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal("new")}>
          Agregar sucursal
        </button>
      </div>

      {locations.length === 0 ? (
        <p className="px-5 py-8 text-sm" style={{ color: "var(--muted)" }}>
          Todavía no hay sucursales.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
              <th className="px-5 py-2 font-medium">Nombre</th>
              <th className="px-5 py-2 font-medium">Coordenadas</th>
              <th className="px-5 py-2 font-medium">Metros</th>
              <th className="px-5 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-b last:border-0" style={{ borderColor: "var(--line)" }}>
                <td className="px-5 py-3 font-medium">{loc.name}</td>
                <td className="px-5 py-3" style={{ color: "var(--muted)" }}>
                  {loc.latitude}, {loc.longitude}
                </td>
                <td className="px-5 py-3">{loc.radius_meters ?? 150} m</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => setModal(loc)}>
                      Editar
                    </button>
                    <form
                      action={deleteWorkLocation}
                      onSubmit={(e) => {
                        if (!confirm(`¿Quitar ${loc.name}?`)) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="id" value={loc.id} />
                      <button className="btn btn-ghost text-xs text-red-700">Eliminar</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal === "new" ? (
        <Modal title="Nueva sucursal" onClose={close}>
          <LocationForm onDone={close} />
        </Modal>
      ) : null}
      {modal && modal !== "new" ? (
        <Modal title="Editar sucursal" onClose={close}>
          <LocationForm loc={modal} onDone={close} />
        </Modal>
      ) : null}
    </div>
  );
}
