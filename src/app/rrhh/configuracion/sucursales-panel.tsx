"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteWorkLocation, saveWorkLocation } from "@/modules/attendance/actions";
import { ConfirmForm } from "@/components/confirm-dialog";
import { DialogSheet, Overlay } from "@/components/overlay";

export type Sucursal = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  day_start?: string | null;
  day_end?: string | null;
  afternoon_start?: string | null;
  afternoon_end?: string | null;
};

function hhmm(v?: string | null) {
  return v ? String(v).slice(0, 5) : "";
}

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
      <p className="text-sm font-medium">Horario de esta sucursal</p>
      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Jornada corrida: llená inicio y fin (ej. 08:00 a 15:00) y dejá la tarde vacía. Partida: mañana 08:00–12:30 y
        tarde 16:30–20:30.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Inicio (mañana)
          <input name="day_start" type="time" defaultValue={hhmm(loc?.day_start) || "08:00"} className="field mt-1" />
        </label>
        <label className="text-sm">
          Fin mañana / jornada
          <input name="day_end" type="time" defaultValue={hhmm(loc?.day_end) || "15:00"} className="field mt-1" />
        </label>
        <label className="text-sm">
          Inicio tarde (opcional)
          <input name="afternoon_start" type="time" defaultValue={hhmm(loc?.afternoon_start)} className="field mt-1" />
        </label>
        <label className="text-sm">
          Fin tarde (opcional)
          <input name="afternoon_end" type="time" defaultValue={hhmm(loc?.afternoon_end)} className="field mt-1" />
        </label>
      </div>
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
    <Overlay onClose={onClose} wide>
      <DialogSheet>
        <h3 className="mb-4 text-base font-semibold">{title}</h3>
        {children}
      </DialogSheet>
    </Overlay>
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
            Dónde pueden fichar y a qué hora trabajan en esa sede. En el empleado asignás la sucursal.
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
              <th className="px-5 py-2 font-medium">Horario</th>
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
                <td className="px-5 py-3">
                  {hhmm(loc.day_start) || "—"}–{hhmm(loc.day_end) || "—"}
                  {hhmm(loc.afternoon_start) && hhmm(loc.afternoon_end)
                    ? ` / ${hhmm(loc.afternoon_start)}–${hhmm(loc.afternoon_end)}`
                    : ""}
                  <span className="block text-xs opacity-60">{loc.radius_meters ?? 150} m</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-ghost text-xs" onClick={() => setModal(loc)}>
                      Editar
                    </button>
                    <ConfirmForm
                      action={deleteWorkLocation}
                      title={`¿Quitar ${loc.name}?`}
                      body="Los empleados de esta sede quedan sin sucursal asignada."
                      confirm="Quitar"
                    >
                      <input type="hidden" name="id" value={loc.id} />
                      <button className="btn btn-ghost text-xs text-red-700">Eliminar</button>
                    </ConfirmForm>
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
