"use client";

import { useState, useTransition } from "react";
import { punch } from "@/modules/attendance/actions";

export function PunchPad({ next }: { next: "in" | "out" }) {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function go(punch_type: "in" | "out") {
    start(async () => {
      setErr(null);
      setOk(null);
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        });
      });
      if (!pos) {
        setErr("No se pudo leer el GPS. Activá la ubicación y reintentá.");
        return;
      }
      const fd = new FormData();
      fd.set("punch_type", punch_type);
      fd.set("latitude", String(pos.coords.latitude));
      fd.set("longitude", String(pos.coords.longitude));
      try {
        await punch(fd);
        setOk(punch_type === "in" ? "Entrada registrada." : "Salida registrada.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "No se pudo fichar");
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy || next !== "in"}
          className="rounded-2xl py-6 text-lg font-medium disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-fg, #fff)" }}
          onClick={() => go("in")}
        >
          {busy && next === "in" ? "…" : "Entrada"}
        </button>
        <button
          type="button"
          disabled={busy || next !== "out"}
          className="rounded-2xl py-6 text-lg font-medium disabled:opacity-40"
          style={{ background: next === "out" ? "var(--accent)" : "#d7cfc3", color: next === "out" ? "var(--accent-fg, #fff)" : "#3d3830" }}
          onClick={() => go("out")}
        >
          {busy && next === "out" ? "…" : "Salida"}
        </button>
      </div>
      {ok ? <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>{ok}</p> : null}
      {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
      <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
        Se usa el GPS de este momento. Tenés que estar en la sucursal habilitada.
      </p>
    </div>
  );
}
